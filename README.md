# cms1_b —— 公司官网 CMS 后台管理前端

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Ant Design Vue + ECharts。
数据全部来自后端 `cms1_backend`（`/api/*`），**不使用 mock + localStorage 作为主方案**。

- 开发：`npm run dev` → http://localhost:5174（`/api` 与 `/uploads` 代理到后端 3000）
- 演示账号：`admin` / `editor` / `viewer`，密码统一 `123456`
- 路由用 hash 模式，构建产物可放任意静态目录

## 常用命令

```sh
npm install
npm run dev            # 开发（5174）
npm run type-check     # vue-tsc，必须 0 错误
npm run build          # 类型检查 + 生产构建到 dist/
npm run test:ui        # 后台界面回归（无头浏览器）
```

## 界面回归（`npm run test:ui`）

用真实浏览器（无头 Edge/Chrome）+ Chrome DevTools Protocol 跑，覆盖 jsdom 测不出来的部分：

| 场景 | 覆盖点 |
|---|---|
| S1 登录 | 真实填表提交 → 进入仪表盘；token 落 localStorage；**刷新后仍保持登录** |
| S2 仪表盘 | 10 张统计卡都有值；`上产品中心 = 36`、`首页产品位 = 5`；4 个 ECharts canvas 已绘制且非全透明；侧边栏菜单由后端下发 |
| S5 留言流转 | 列表页「回复」→ 已回复；「标已处理」→ 已处理；界面与后端 `status` 双向核对 |
| S4 商品层级 | 列表页关掉「上产品中心」→「首页产品位」自动跟着关（界面 + 后端都验证） |
| S6 操作日志 | 上面几步的动作都落到日志模块（product / message / auth） |

**隔离约定**（与后端 `smoke` 一致，务必遵守）：

- 自己造数、自己清理：S4 创建临时商品（`UI回归临时商品-<时间戳>`）跑完删除，
  **不去改 seed 里的 40 件商品**
- S5 只对一条「待处理」留言做 回复→标已处理，结束时用 `/reopen` 还原，
  因此种子的 5/3/4 分布会保持不变（脚本会断言这一点）
- 每个场景用**独立页面标签**，localStorage / 全局状态不共享

前置：后端在 3000 运行；本机有 Edge 或 Chrome（可用 `UI_BROWSER` 指定路径）。

```sh
npm run test:ui                    # 会先构建 dist/，再起 4174 静态服务
npm run test:ui -- --no-build      # 复用已有 dist/，快很多
npm run test:ui -- --keep-shots    # 保留各场景截图到 smoke/shots/
```

> 本机沙箱对命名管道有限制时，`vite` 与无头浏览器会 `spawn EPERM`，这两类命令需要放宽权限执行。

## 目录补充

```
smoke/
├── ui.mjs    界面回归用例（场景编排 + 断言 + 清理）
└── cdp.mjs   极简 CDP 客户端（自写 WebSocket，零依赖，避免引入 puppeteer/playwright）
```
