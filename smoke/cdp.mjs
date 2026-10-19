/* ==========================================================================
   极简 CDP 客户端（仅测试用，零依赖）

   为什么要自己写：
     后台界面回归需要驱动真实浏览器（登录 / ECharts canvas / 开关联动），
     而 cms1_b 没有装 puppeteer / playwright，也没有 `ws`。
     项目约束是「不引入新框架」，所以这里用 Node 内置的 net + crypto
     实现最小可用的 WebSocket（客户端掩码、16/64 位长度、ping/pong），
     再在其上跑 Chrome DevTools Protocol。

   覆盖范围（够用即止）：
     · 只做客户端 → 服务端的文本帧
     · 支持 16 位与 64 位扩展长度；不支持分片续帧（CDP 消息都是单帧小报文）
     · 收到 ping 自动回 pong
   ========================================================================== */
import net from 'node:net'
import crypto from 'node:crypto'

const OPCODE = { CONT: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa }

function encodeFrame(payload, opcode = OPCODE.TEXT) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8')
  const length = data.length
  let header

  if (length < 126) {
    header = Buffer.alloc(6)
    header[1] = 0x80 | length
  } else if (length <= 0xffff) {
    header = Buffer.alloc(8)
    header[1] = 0x80 | 126
    header.writeUInt16BE(length, 2)
  } else {
    header = Buffer.alloc(14)
    header[1] = 0x80 | 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }

  // 第 0 字节 = FIN(1) + opcode，漏了它服务端会把整帧当非法帧直接丢弃
  header[0] = 0x80 | opcode

  // 掩码键固定写在 header 最后 4 字节
  const maskStart = header.length - 4
  const mask = crypto.randomBytes(4)
  mask.copy(header, maskStart)

  const masked = Buffer.allocUnsafe(length)
  for (let i = 0; i < length; i += 1) masked[i] = data[i] ^ mask[i % 4]

  if (process.env.UI_CDP_DEBUG === '1') {
    console.log('[encode] opcode=' + opcode + ' len=' + length + ' headerHex=' + header.toString('hex'))
  }

  return Buffer.concat([header, masked])
}

/** 解析缓冲区里的完整帧；不足一帧返回 null */
function decodeFrame(buffer) {
  if (buffer.length < 2) return null
  const opcode = buffer[0] & 0x0f
  const masked = (buffer[1] & 0x80) !== 0
  let length = buffer[1] & 0x7f
  let offset = 2

  if (length === 126) {
    if (buffer.length < offset + 2) return null
    length = buffer.readUInt16BE(offset)
    offset += 2
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null
    length = Number(buffer.readBigUInt64BE(offset))
    offset += 8
  }

  let mask = null
  if (masked) {
    if (buffer.length < offset + 4) return null
    mask = buffer.subarray(offset, offset + 4)
    offset += 4
  }
  if (buffer.length < offset + length) return null

  const payload = Buffer.from(buffer.subarray(offset, offset + length))
  if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
  return { opcode, payload, total: offset + length }
}

function connectWebSocket(url, debug = false) {
  const parsed = new URL(url)
  const key = crypto.randomBytes(16).toString('base64')
  const log = (...args) => {
    if (debug) console.log('[ws]', ...args)
  }

  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(parsed.port), parsed.hostname, () => {
      socket.write(
        `GET ${parsed.pathname}${parsed.search} HTTP/1.1\r\n` +
          `Host: ${parsed.host}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n\r\n'
      )
    })

    socket.once('error', reject)

    let handshakeDone = false
    let buffer = Buffer.alloc(0)
    let upgrading = Buffer.alloc(0)

    const ws = {
      onmessage: null,
      onclose: null,
      send(text) {
        try {
          const frame = encodeFrame(text, OPCODE.TEXT)
          log('send', frame.length, 'bytes hex=' + frame.subarray(0, 8).toString('hex'), ':', String(text).slice(0, 60))
          socket.write(frame)
        } catch (error) {
          log('send error', error.message)
        }
      },
      close() {
        try {
          socket.write(encodeFrame(Buffer.alloc(0), OPCODE.CLOSE))
        } catch {
          /* 忽略 */
        }
        socket.destroy()
      }
    }

    const handleFrames = () => {
      log('handleFrames, buffer', buffer.length)
      for (;;) {
        const frame = decodeFrame(buffer)
        if (!frame) {
          log('帧不完整，等待更多数据')
          return
        }
        buffer = buffer.subarray(frame.total)
        log('收到帧 opcode', frame.opcode, 'payload', frame.payload.length)
        if (frame.opcode === OPCODE.TEXT) ws.onmessage?.(frame.payload.toString('utf8'))
        else if (frame.opcode === OPCODE.PING) socket.write(encodeFrame(frame.payload, OPCODE.PONG))
        else if (frame.opcode === OPCODE.CLOSE) {
          socket.destroy()
          ws.onclose?.()
          return
        }
      }
    }

    socket.on('data', (chunk) => {
      log('socket data', chunk.length, 'handshakeDone=' + handshakeDone)
      if (handshakeDone) {
        buffer = Buffer.concat([buffer, chunk])
        handleFrames()
        return
      }
      upgrading = Buffer.concat([upgrading, chunk])
      const end = upgrading.indexOf('\r\n\r\n')
      if (end === -1) return

      const head = upgrading.subarray(0, end).toString('utf8')
      log('握手响应：' + head.split('\r\n')[0])
      if (!/^HTTP\/1\.1 101/.test(head)) {
        reject(new Error('WebSocket 握手失败：' + head.split('\r\n')[0]))
        socket.destroy()
        return
      }
      handshakeDone = true
      buffer = upgrading.subarray(end + 4)
      upgrading = Buffer.alloc(0)
      log('握手完成，残留缓冲 ' + buffer.length)
      upgradeResolve(ws)
      handleFrames()
    })

    socket.on('error', (error) => log('socket error ' + error.message))
    socket.on('close', () => log('socket close'))

    let upgradeResolve
    const upgradePromise = new Promise((r) => {
      upgradeResolve = r
    })
    void upgradePromise

    socket.on('close', () => {
      if (!handshakeDone) reject(new Error('WebSocket 连接被关闭'))
      else ws.onclose?.()
    })

    /* 握手成功后把控制权交给调用方 */
    upgradePromise.then(resolve)
  })
}

/* ---------------- CDP ---------------- */

export async function connectCdp(wsUrl, debug = process.env.UI_CDP_DEBUG === '1') {
  const ws = await connectWebSocket(wsUrl, debug)
  let nextId = 1
  const pending = new Map()

  ws.onmessage = (text) => {
    let message
    try {
      message = JSON.parse(text)
    } catch {
      return
    }
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error(`CDP 超时：${method}`))
        }
      }, 20000)
    })

  return { send, close: () => ws.close() }
}

/* ---------------- 浏览器 / 页面封装 ---------------- */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpJson(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ default: http }) => {
      const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(text))
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('error', reject)
      req.end()
    })
  })
}

/** 等待 CDP 端口就绪，返回浏览器版本 */
export async function waitForBrowser(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return await httpJson(port, '/json/version')
    } catch {
      if (Date.now() > deadline) throw new Error('等待浏览器 CDP 端口超时：' + port)
      await sleep(400)
    }
  }
}

/**
 * 打开一个**全新的页面目标**并连上它。
 * 每个场景一个独立标签：localStorage / 全局状态 / 路由互不影响，
 * 也避免复用同一个 target 时上一次的导航把 CDP 命令拖住。
 */
export async function openPage(port, url) {
  const target = await httpJson(port, '/json/new?' + encodeURIComponent(url), 'PUT')
  if (!target || !target.webSocketDebuggerUrl) throw new Error('创建页面目标失败：' + JSON.stringify(target))

  const cdp = await connectCdp(target.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const page = {
    cdp,
    /**
     * 在页面里执行表达式（支持 await Promise）。
     * 返回 JSON 化后的值，方便直接断言。
     */
    async evaluate(expression) {
      return page.evaluateRaw(`(async () => { ${expression} })()`)
    },
    /** 执行原始表达式（不自动包 async） */
    async evaluateRaw(expression) {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      })
      if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
        throw new Error('页面执行异常：' + detail)
      }
      return result.result.value
    },
    /** 等页面加载完成（document 已就绪），避免 evaluate 时上下文还在重建 */
    async waitForReady(waitMs = 15000) {
      const deadline = Date.now() + waitMs
      for (;;) {
        try {
          const state = await page.evaluateRaw('document.readyState')
          if (state === 'complete' || state === 'interactive') return true
        } catch {
          /* 上下文正在重建，重试 */
        }
        if (Date.now() > deadline) throw new Error('等待页面就绪超时')
        await sleep(200)
      }
    },
    /** 等某个选择器出现（轮询，最多 waitMs） */
    async waitFor(selector, waitMs = 8000) {
      const deadline = Date.now() + waitMs
      for (;;) {
        const found = await page.evaluate(`return Boolean(document.querySelector(${JSON.stringify(selector)}))`)
        if (found) return true
        if (Date.now() > deadline) throw new Error('等待元素超时：' + selector)
        await sleep(200)
      }
    },
    /** 等 URL 命中某个 hash 路由 */
    async waitForHash(hash, waitMs = 10000) {
      const deadline = Date.now() + waitMs
      for (;;) {
        const current = await page.evaluate('return location.hash')
        if (current.includes(hash)) return true
        if (Date.now() > deadline) throw new Error(`等待路由超时：期望 ${hash}，实际 ${current}`)
        await sleep(250)
      }
    },
    async screenshot(file) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(file, Buffer.from(shot.data, 'base64'))
      return file
    },
    /** 等一次 fetch 静默（粗略：等 DOM 稳定） */
    async settle(ms = 900) {
      await sleep(ms)
    },
    close() {
      // 关掉这个标签本身（不只是断开 WebSocket），避免场景之间互相影响
      cdp.send('Target.closeTarget', { targetId: target.id }).catch(() => {})
      cdp.close()
    }
  }

  await page.waitForReady()
  return page
}
