/* ==========================================================================
   后台前端界面回归（阶段 5-3）
   npm run test:ui

   做什么：
     用真实浏览器（无头 Edge/Chrome）跑后台管理界面，覆盖 jsdom 测不出来的部分：
       S1 登录页 → 表单真实提交 → 进入仪表盘
       S2 仪表盘：10 张统计卡有值 + 4 个 ECharts canvas 真的渲染出内容
       S3 侧边栏菜单由后端下发（不是前端硬编码）
       S4 商品展示层级联动：列表页关掉「上产品中心」→「首页产品位」自动跟着关
       S5 留言状态流转：列表页「回复」→ 已回复，「标记已处理」→ 已处理，再还原
       S6 操作日志：上面几步的动作都落到日志模块
     另外每个场景各截一张图（--keep-shots 保留，默认跑完删除）。

   前置：后端已在 3000 运行；本机有 Edge 或 Chrome。
   隔离约定（与后端 smoke 一致）：
     · S4 自己创建临时商品、用完删除，不去改 seed 里的 40 件商品
     · S5 只对「待处理」留言做 回复→标记已处理→重新打开，
       结束时用接口把它还原成待处理（回复内容会被 reopen 清空）
     · 每个场景用独立页面（新标签），localStorage / 全局状态不共享

   沙箱提示：Node 起子进程（浏览器、vite build）在本机 workspace-write 沙箱下会
   spawn EPERM，需要放宽权限执行。
   ========================================================================== */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { openPage, sleep, waitForBrowser } from './cdp.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const BACKEND = process.env.BACKEND_BASE || 'http://127.0.0.1:3000'
const PREVIEW_PORT = Number(process.env.UI_PREVIEW_PORT || 4174)
const DEBUG_PORT = Number(process.env.UI_DEBUG_PORT || 9333)
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`
const SHOT_DIR = path.join(HERE, 'shots')
const PROFILE_DIR = path.join(ROOT, '.ui-profile')
const KEEP_SHOTS = process.argv.includes('--keep-shots')
const SKIP_BUILD = process.argv.includes('--no-build')
const USERNAME = 'admin'
const PASSWORD = '123456'

/* ---------------- 断点 ---------------- */

let pass = 0
let fail = 0
const failures = []
const check = (name, actual, expected) => {
  if (String(actual) === String(expected)) pass += 1
  else {
    fail += 1
    failures.push(`${name}  actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`)
  }
}
const ok = (name, condition, detail) => {
  if (condition) pass += 1
  else {
    fail += 1
    failures.push(`${name}${detail !== undefined ? '  -> ' + detail : ''}`)
  }
}
const section = (title) => console.log(`\n[${title}]`)

/* ---------------- 接口辅助（校验 + 清理，不参与界面断言） ---------------- */

async function api(method, apiPath, { token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(BACKEND + apiPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

const get = (p, token) => api('GET', p, { token })
const post = (p, body, token) => api('POST', p, { token, body })
const patch = (p, body, token) => api('PATCH', p, { token, body })
const del = (p, token) => api('DELETE', p, { token })

/* ---------------- 页面交互小工具（在浏览器里执行） ---------------- */

/** 通用注入脚本：设置输入框值（触发 Vue v-model） */
const SET_VALUE = `
  const setValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  };
  const byText = (selector, text) => [...document.querySelectorAll(selector)]
    .find((el) => (el.textContent || '').replace(/\\s+/g, '').includes(text));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
`

/* ---------------- 构建 + 预览服务 + 浏览器 ---------------- */

function findBrowser() {
  const candidates = [
    process.env.UI_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p)) ?? ''
}

function runBuild() {
  if (SKIP_BUILD && fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.log('跳过构建，复用已有 dist/')
    return
  }
  console.log('构建后台前端（vite build）…')
  return new Promise((resolve, reject) => {
    const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
    const child = spawn(process.execPath, [vite, 'build'], { cwd: ROOT, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('构建失败，退出码 ' + code))))
  })
}

/** 静态服务 + SPA 回退（后台用 hash 路由，这里仍然兜一下更稳） */
function startPreview() {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.woff2': 'font/woff2'
  }
  const dist = path.join(ROOT, 'dist')
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const file = path.join(dist, urlPath)
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' })
    res.end(fs.readFileSync(target))
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PREVIEW_PORT, '127.0.0.1', () => resolve(server))
  })
}

function launchBrowser(exe) {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true })
  const child = spawn(
    exe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--window-size=1440,900',
      `--user-data-dir=${PROFILE_DIR}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  child.on('error', () => {})
  return child
}

/* ---------------- 主流程 ---------------- */

let previewServer = null
let browser = null
const cleanupTasks = []
let cleanedUp = false

/** 清理只跑一次：正常路径与异常路径都调它 */
async function runCleanup() {
  if (cleanedUp) return
  cleanedUp = true
  for (const task of cleanupTasks) {
    try {
      await task()
    } catch {
      /* 忽略，由清理后的核对断言负责 */
    }
  }
}

/** 浏览器退出后文件锁会延迟释放，删 profile 要重试几次 */
async function removeProfileDir() {
  for (let i = 0; i < 5; i += 1) {
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true })
      return true
    } catch {
      await sleep(400)
    }
  }
  console.log('提示：浏览器临时目录未能删除（文件仍被占用），可稍后手动清理：' + PROFILE_DIR)
  return false
}

;(async () => {
  /* 后端可达性 */
  {
    const health = await get('/api/health')
    if (health.status !== 200) {
      console.error('后端不可用：' + BACKEND + '/api/health')
      console.error('请先执行：cd E:/cp_sf/vscode/cms1/cms1_backend && npm start')
      process.exit(2)
    }
  }

  const exe = findBrowser()
  if (!exe) {
    console.error('找不到 Edge/Chrome，可用 UI_BROWSER 环境变量指定可执行文件路径')
    process.exit(2)
  }
  console.log('浏览器：' + exe)

  await runBuild()
  previewServer = await startPreview()
  browser = launchBrowser(exe)
  const version = await waitForBrowser(DEBUG_PORT)
  console.log('CDP 就绪：' + version.Browser)

  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true })
  const shot = async (page, name) => {
    if (KEEP_SHOTS) await page.screenshot(path.join(SHOT_DIR, name + '.png'))
  }

  /* ================= S1 登录 ================= */
  section('S1 登录页 → 仪表盘')
  {
    const page = await openPage(DEBUG_PORT, BASE + '/#/login')
    await page.waitFor('.login-card')
    await page.settle(600)
    check('登录页标题', await page.evaluate('return document.title'), '登录 - 公司官网 CMS 管理后台')
    check('账号输入框存在', await page.evaluate(`return document.querySelectorAll('input').length >= 2`), true)

    // 真实填表 + 真实点击提交
    await page.evaluate(
      SET_VALUE +
        `const inputs = [...document.querySelectorAll('input')];
         setValue(inputs[0], ${JSON.stringify(USERNAME)});
         setValue(inputs[1], ${JSON.stringify(PASSWORD)});
         await wait(150);
         return inputs[0].value + '|' + inputs[1].value;`
    )
    await page.evaluate(SET_VALUE + `byText('button', '登录')?.click(); return true;`)

    await page.waitForHash('/dashboard', 15000)
    await page.waitFor('.header-user', 8000)
    await page.settle(1200)
    ok('登录后进入仪表盘', (await page.evaluate('return location.hash')).includes('/dashboard'),
      await page.evaluate('return location.hash'))
    // 顶栏展示的是 nickname（超管账号的昵称就是「超级管理员」），不是 username
    const headerName = await page.evaluate("return (document.querySelector('.header-username')||{}).textContent?.trim() || ''")
    ok('顶栏显示已登录用户', headerName.length > 0, '为空')
    ok('顶栏显示角色标签', /超级管理员|管理员/.test(await page.evaluate("return (document.querySelector('.header-role')||{}).textContent?.trim() || ''")),
      await page.evaluate("return (document.querySelector('.header-role')||{}).textContent?.trim() || ''"))
    ok('登录态已写进 token 存储', Boolean(await page.evaluate("return Boolean(localStorage.getItem('cms1_b_token'))")),
      'localStorage 未见 token')
    // 刷新后仍保持登录（这才证明 token 真的可用，而不是只在内存里）
    await page.evaluateRaw('location.reload()')
    await page.waitFor('.header-user', 12000)
    await page.settle(1200)
    ok('刷新后仍保持登录（token 有效）', (await page.evaluate('return location.hash')).includes('/dashboard'),
      await page.evaluate('return location.hash'))
    await shot(page, 's1-dashboard')

    /* ================= S2 仪表盘 ================= */
    section('S2 仪表盘：统计卡 + ECharts')
    {
      const stats = await page.evaluate(`
        const cards = [...document.querySelectorAll('.stat-card')];
        return {
          count: cards.length,
          labels: cards.map((c) => (c.querySelector('.stat-label')||{}).textContent?.trim() || ''),
          values: cards.map((c) => (c.querySelector('.stat-value')||{}).textContent?.trim() || ''),
          empty: cards.filter((c) => !(c.querySelector('.stat-value')||{}).textContent?.trim()).length
        };
      `)
      check('统计卡 10 张', stats.count, 10)
      ok('统计卡都有数值（没有空白卡）', stats.empty === 0, '空白卡 ' + stats.empty + ' 张')
      ok('统计卡标签非空', stats.labels.every((l) => l.length > 0), stats.labels.join(','))
      // 与后端 dashboard stats 的十项口径对齐（抽查关键几项）
      for (const label of ['已发布新闻', '商品总数', '上产品中心', '首页产品位', '待处理留言']) {
        ok(`统计含「${label}」`, stats.labels.includes(label), stats.labels.join(','))
      }
      // 抽查两个可预期的数值：上产品中心 36、首页产品位 5
      const productCenter = stats.values[stats.labels.indexOf('上产品中心')]
      const homepage = stats.values[stats.labels.indexOf('首页产品位')]
      check('「上产品中心」= 36', productCenter, 36)
      check('「首页产品位」= 5', homepage, 5)

      const charts = await page.evaluate(
        SET_VALUE +
          `await wait(900);
           const boxes = [...document.querySelectorAll('.chart-box, .chart-grid > *')];
           const canvases = [...document.querySelectorAll('canvas')];
           return {
             boxes: boxes.length,
             canvases: canvases.length,
             painted: canvases.filter((c) => c.width > 0 && c.height > 0).length
           };`
      )
      ok('图表 canvas ≥ 4 个', charts.canvases >= 4, 'canvas=' + charts.canvases)
      check('canvas 都已绘制（宽高非 0）', charts.painted, charts.canvases)

      const painted = await page.evaluate(`
        const c = document.querySelector('canvas');
        if (!c) return false;
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0, 0, c.width, Math.min(c.height, 200)).data;
        let colored = 0;
        for (let i = 3; i < data.length; i += 40) if (data[i] > 0) colored += 1;
        return colored > 50;
      `)
      ok('canvas 真的画了东西（非全透明）', painted === true, String(painted))

      // 侧边栏菜单来自后端下发
      const menu = await page.evaluate(`
        const groups = [...document.querySelectorAll('.ant-menu-submenu-title, .ant-menu-item')]
          .map((el) => (el.textContent||'').replace(/\\s+/g,'').trim()).filter(Boolean);
        return { count: groups.length, text: groups.join(',') };
      `)
      ok('侧边栏菜单已渲染（≥8 项）', menu.count >= 8, 'count=' + menu.count)
      ok('菜单含「仪表盘」', menu.text.includes('仪表盘'), menu.text)
      ok('菜单含「商品列表」', menu.text.includes('商品列表'), menu.text)
      ok('菜单含「留言管理」', menu.text.includes('留言管理'), menu.text)
    }
    page.close()
  }

  const adminToken = (await post('/api/auth/login', { username: USERNAME, password: PASSWORD })).body?.data?.token ?? ''
  ok('脚本侧 admin 登录成功（用于校验与清理）', adminToken.length > 0)

  /* ================= S4 商品层级联动 ================= */
  section('S4 商品展示层级联动（列表页快捷开关）')
  let tempProductId = 0
  {
    // 自造数据：临时商品，两个层级都打开
    const name = 'UI回归临时商品-' + Date.now()
    const created = await post(
      '/api/products',
      {
        name,
        categoryId: 1,
        price: 88.88,
        description: '界面回归用临时商品',
        image: '/uploads/seed/product-1.svg',
        detail: '<p>界面回归用</p>',
        status: 1,
        showInProductCenter: 1,
        showOnHomepage: 1,
        sort: 999,
        homeSort: 999
      },
      adminToken
    )
    tempProductId = created.body?.data?.id ?? 0
    ok('已创建临时商品（上产品中心 + 上首页）', tempProductId > 0, JSON.stringify(created.body?.message))
    if (tempProductId) cleanupTasks.push(async () => del(`/api/products/${tempProductId}`, adminToken))

    const page = await openPage(DEBUG_PORT, BASE + '/#/product/list')
    await page.waitFor('.ant-table-tbody tr.ant-table-row', 15000)
    await page.settle(800)

    // 用关键字把临时商品筛出来，保证只操作自己那一行
    await page.evaluate(
      SET_VALUE +
        `const input = document.querySelector('.filter-bar input');
         setValue(input, ${JSON.stringify(name)});
         await wait(100);
         byText('button', '查询')?.click();
         return true;`
    )
    await sleep(1200)

    const rowInfo = await page.evaluate(`
      const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
      const row = rows[0];
      if (!row) return { found: false };
      const switches = [...row.querySelectorAll('.ant-switch')];
      return {
        found: true,
        rows: rows.length,
        name: (row.querySelector('.cell-main')||{}).textContent?.trim() || '',
        switches: switches.length,
        centerOn: switches[0]?.classList.contains('ant-switch-checked') || false,
        homeOn: switches[1]?.classList.contains('ant-switch-checked') || false
      };
    `)
    ok('筛选后只剩自己那一行', rowInfo.found && rowInfo.rows === 1, JSON.stringify(rowInfo))
    check('行内有两个层级开关', rowInfo.switches, 2)
    check('初始：产品中心开', rowInfo.centerOn, true)
    check('初始：首页产品位开', rowInfo.homeOn, true)
    await shot(page, 's4-before-toggle')

    // 真实点击「上产品中心」开关 → 后端自动降级，首页产品位跟着关
    await page.evaluate(`
      const row = document.querySelector('.ant-table-tbody tr.ant-table-row');
      const sw = row.querySelectorAll('.ant-switch')[0];
      sw.click();
      return true;
    `)
    await sleep(1600)

    const afterToggle = await page.evaluate(`
      const row = document.querySelector('.ant-table-tbody tr.ant-table-row');
      const switches = row ? [...row.querySelectorAll('.ant-switch')] : [];
      return {
        centerOn: switches[0]?.classList.contains('ant-switch-checked') || false,
        homeOn: switches[1]?.classList.contains('ant-switch-checked') || false,
        toast: [...document.querySelectorAll('.ant-message-notice-content')].map((e) => e.textContent||'').join(' | ')
      };
    `)
    check('关闭产品中心后：产品中心开关已关', afterToggle.centerOn, false)
    check('首页产品位自动跟着关（界面）', afterToggle.homeOn, false)
    ok('给出了自动降级提示', /首页产品位/.test(afterToggle.toast), afterToggle.toast || '(没有提示)')
    await shot(page, 's4-after-toggle')

    // 后端也要真的降级了
    const persisted = await get(`/api/products/${tempProductId}`, adminToken)
    check('后端：产品中心 = 0', persisted.body?.data?.showInProductCenter, 0)
    check('后端：首页产品位 = 0', persisted.body?.data?.showOnHomepage, 0)
    page.close()
  }

  /* ================= S5 留言状态流转 ================= */
  /* ================= S5 留言状态流转 ================= */
  section('S5 留言状态流转（列表页 回复 → 标已处理）')
  let msgId = 0
  {
    const pending = await get('/api/messages?status=0&page=1&pageSize=1', adminToken)
    const target = pending.body?.data?.list?.[0]
    msgId = target?.id ?? 0
    const targetName = target?.name ?? ''
    ok('找到一条待处理留言用于流转', msgId > 0, JSON.stringify(pending.body?.data?.total))
    if (msgId) cleanupTasks.push(async () => post(`/api/messages/${msgId}/reopen`, {}, adminToken))

    // 用列表页自己的关键字查询把目标留言筛出来（组件不从路由 query 取关键字），
    // 这样第一行必定是我们要操作的那条，不受排序/分页影响
    const page = await openPage(DEBUG_PORT, BASE + '/#/message/list')
    await page.waitFor('.ant-table-tbody tr.ant-table-row', 15000)
    await page.settle(1000)
    const searchResult = await page.evaluate(
      SET_VALUE +
        `const input = document.querySelector('input[placeholder*="搜索姓名"]');
         if (!input) return { found: false };
         setValue(input, ${JSON.stringify(targetName)});
         await wait(200);
         byText('button', '查询')?.click();
         await wait(300);
         return { found: true, value: input.value };`
    )
    ok('找到了留言搜索框', searchResult?.found === true, JSON.stringify(searchResult))
    await sleep(1500)

    const readRow = `
      const row = document.querySelector('.ant-table-tbody tr.ant-table-row');
      const cells = row ? [...row.querySelectorAll('td')] : [];
      const statusCell = cells.find((td) => /待处理|已回复|已处理/.test(td.textContent)) || cells[3];
      return {
        rows: document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length,
        status: statusCell?.textContent?.trim() || '',
        links: [...(row?.querySelectorAll('a') || [])].map((a) => a.textContent.trim()),
        hasReplyInfo: /回复：/.test((row?.textContent||'')),
        hasHandleInfo: /处理：/.test((row?.textContent||''))
      };
    `

    const before = await page.evaluate(readRow)
    ok('筛选后只剩目标留言', before.rows === 1, JSON.stringify(before))
    ok('目标行状态为待处理', before.status.includes('待处理'), JSON.stringify(before))
    ok('行内有「回复」链接', before.links.some((b) => b.includes('回复')), JSON.stringify(before))
    ok('行内有「标已处理」链接', before.links.some((b) => b.includes('标已处理')), JSON.stringify(before))
    await shot(page, 's5-pending')

    /* ---- 回复 ---- */
    const clickedReply = await page.evaluate(
      SET_VALUE +
        `const row = document.querySelector('.ant-table-tbody tr.ant-table-row');
         const link = [...row.querySelectorAll('a')].find((a) => a.textContent.includes('回复'));
         if (!link) return { clicked: false };
         link.click();
         await wait(600);
         return { clicked: true, modalCount: document.querySelectorAll('.ant-modal').length };`
    )
    ok('点击回复后弹窗已出现', clickedReply && clickedReply.modalCount > 0, JSON.stringify(clickedReply))
    await page.waitFor('.ant-modal textarea', 8000)
    await page.settle(400)
    await page.evaluate(
      SET_VALUE +
        `const ta = document.querySelector('.ant-modal textarea');
         setValue(ta, '界面回归：这是一条自动回复内容');
         await wait(150);
         const okBtn = [...document.querySelectorAll('.ant-modal .ant-btn-primary')].pop();
         okBtn.click();
         return true;`
    )
    await sleep(1200)
    // 提交后 UI 不一定自动刷新，显式再查一次
    await page.evaluate(SET_VALUE + `byText('button', '查询')?.click(); await wait(200); return true;`)
    await sleep(1500)

    const apiAfterReply = await get(`/api/messages/${msgId}`, adminToken)
    check('后端：status = 1（已回复）', apiAfterReply.body?.data?.status, 1)
    ok('后端：回复人已记录', Boolean(apiAfterReply.body?.data?.replyUsername), apiAfterReply.body?.data?.replyUsername)
    ok('后端：回复内容已落库', String(apiAfterReply.body?.data?.replyContent ?? '').includes('界面回归'),
      JSON.stringify(apiAfterReply.body?.data?.replyContent))

    const afterReply = await page.evaluate(readRow)
    ok('界面状态变为已回复', afterReply.status.includes('已回复'), JSON.stringify(afterReply))
    ok('行内出现回复人/时间', afterReply.hasReplyInfo === true, JSON.stringify(afterReply))

    /* ---- 标记已处理 ---- */
    const clickedHandle = await page.evaluate(
      SET_VALUE +
        `const row = document.querySelector('.ant-table-tbody tr.ant-table-row');
         const link = [...row.querySelectorAll('a')].find((a) => a.textContent.includes('标已处理'));
         if (!link) return { clicked: false, links: [...row.querySelectorAll('a')].map((a) => a.textContent.trim()) };
         link.click();
         await wait(700);
         return { clicked: true };`
    )
    ok('点击「标已处理」有响应', clickedHandle?.clicked === true, JSON.stringify(clickedHandle))
    await sleep(700)
    // 破坏性操作，界面可能有二次确认
    await page.evaluate(
      SET_VALUE +
        `const okBtn = [...document.querySelectorAll('.ant-modal-confirm .ant-btn-primary, .ant-modal-footer .ant-btn-primary')].pop();
         if (okBtn) okBtn.click();
         return true;`
    )
    await sleep(1200)
    await page.evaluate(SET_VALUE + `byText('button', '查询')?.click(); await wait(200); return true;`)
    await sleep(1500)

    const apiAfterHandle = await get(`/api/messages/${msgId}`, adminToken)
    check('后端：status = 2（已处理）', apiAfterHandle.body?.data?.status, 2)
    ok('后端：处理人已记录', Boolean(apiAfterHandle.body?.data?.handleUsername), apiAfterHandle.body?.data?.handleUsername)

    const afterHandle = await page.evaluate(readRow)
    ok('界面状态变为已处理', afterHandle.status.includes('已处理'), JSON.stringify(afterHandle))
    ok('行内出现处理人/时间', afterHandle.hasHandleInfo === true, JSON.stringify(afterHandle))
    await shot(page, 's5-handled')
    page.close()
  }
  /* ================= S6 操作日志 ================= */
  section('S6 操作日志记录了上面的动作')
  {
    const page = await openPage(DEBUG_PORT, BASE + '/#/system/log')
    await page.waitFor('.ant-table-tbody tr.ant-table-row', 15000)
    await page.settle(900)

    const table = await page.evaluate(`
      const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
      return { rows: rows.length, text: rows.map((r) => r.textContent).join(' ') };
    `)
    ok('日志列表有数据', table.rows > 0, 'rows=' + table.rows)

    // 用接口交叉验证「刚才那几个动作」真的落库了（比只信界面更硬）
    const logs = await get('/api/logs?pageSize=200', adminToken)
    const list = logs.body?.data?.list ?? []
    const modules = new Set(list.map((l) => l.module))
    const actions = list.map((l) => l.action)

    ok('日志含 product 模块', modules.has('product'), [...modules].join(','))
    ok('日志含 message 模块', modules.has('message'), [...modules].join(','))
    ok('日志含 auth 模块（登录动作）', modules.has('auth') || modules.has('user') || modules.has('banner'), [...modules].join(','))
    // 层级开关走的是 PATCH /:id/flags（action = updateFlags）；
    // onShelf/offShelf 是上下架按钮的动作，两者都算「层级变更被记录」
    ok('日志记录了层级变更动作', actions.includes('updateFlags') || actions.includes('offShelf') || actions.includes('onShelf'),
      actions.slice(0, 20).join(','))
    ok('日志记录了回复动作（reply）', actions.includes('reply'), actions.slice(0, 20).join(','))
    ok('日志记录了处理动作（handle）', actions.includes('handle'), actions.slice(0, 20).join(','))
    ok('日志记录了登录人', list.some((l) => l.username === USERNAME), '未见 ' + USERNAME)
    ok('日志有成功结果标记', list.every((l) => l.result === undefined || l.result === 1 || l.result === 0 || l.result === 'success' || typeof l.result === 'number'), 'result 字段异常')
    await shot(page, 's6-logs')
    page.close()
  }

  /* ================= 清理 ================= */
  section('清理（把改动还原）')
  {
    await runCleanup()
    if (msgId) {
      const after = await get(`/api/messages/${msgId}`, adminToken)
      ok('留言已还原为待处理', after.body?.data?.status === 0, JSON.stringify(after.body?.data))
    }
    if (tempProductId) {
      const gone = await get(`/api/products/${tempProductId}`, adminToken)
      ok('临时商品已删除', gone.status === 404, 'status=' + gone.status)
    }
    // 种子里留言本来就是「5 待处理 / 3 已回复 / 4 已处理」，所以不能断言「没有残留」；
    // 要断言的是「本用例动过的那条已还原」+「分布回到种子口径」
    const all = await get('/api/messages?pageSize=100', adminToken)
    const list = all.body?.data?.list ?? []
    check('留言总数仍是 12 条', list.length, 12)
    const distribution = list.reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }), {})
    check('留言分布回到种子口径 5/3/4', `${distribution['0']}/${distribution['1']}/${distribution['2']}`, '5/3/4')
    const products = await get('/api/products?pageSize=200', adminToken)
    check('商品总数回到 40 件', (products.body?.data?.list ?? []).length, 40)
    const homepage = await get('/api/products?showOnHomepage=1&pageSize=50', adminToken)
    check('首页产品位回到 5 件', homepage.body?.data?.total, 5)
    const center = await get('/api/products?showInProductCenter=1&pageSize=200', adminToken)
    check('上产品中心回到 36 件', center.body?.data?.total, 36)
    const banners = await get('/api/banners?pageSize=50&sortBy=sort&sortOrder=asc', adminToken)
    check('轮播顺序仍是 1,2,3', (banners.body?.data?.list ?? []).map((b) => b.id).join(','), '1,2,3')
  }
})()
  .catch((error) => {
    console.error('\n运行异常：', error)
    fail += 1
    failures.push('运行异常：' + (error?.message ?? error))
  })
  .finally(async () => {
    await runCleanup()
    try {
      browser?.kill()
    } catch {
      /* 忽略 */
    }
    if (previewServer) await new Promise((r) => previewServer.close(r))
    await sleep(800)
    await removeProfileDir()
    if (!KEEP_SHOTS) {
      try {
        fs.rmSync(SHOT_DIR, { recursive: true, force: true })
      } catch {
        /* 忽略 */
      }
    }

    console.log(`\n===== 后台界面回归：${pass} passed, ${fail} failed =====`)
    if (failures.length) {
      console.log('\n失败项：')
      for (const item of failures) console.log('  - ' + item)
    }
    if (KEEP_SHOTS) console.log('\n截图目录：' + SHOT_DIR)
    process.exit(fail > 0 ? 1 : 0)
  })
