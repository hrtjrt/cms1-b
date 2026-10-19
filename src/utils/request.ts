import { message as antMessage } from 'ant-design-vue'
import type { ApiResult } from '@/types'

/* ==========================================================================
   请求封装（原生 fetch，不引 axios）

   职责：
     · 统一拼 baseURL（开发期为空 → 走 vite 代理；生产期读 .env.production）
     · 自动带 Authorization: Bearer <token>
     · 401 清除登录态并跳登录页（避免每个页面自己判）
     · 业务 code !== 0 统一弹错误提示，调用方只处理成功分支
     · 支持 silent 选项，用于「宁可静默失败」的场景（例如后台启动时探活）
   ========================================================================== */

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

const TOKEN_KEY = 'cms1_b_token'

/** 请求异常：带后端业务码与 HTTP 状态码 */
export class RequestError extends Error {
  readonly code: number
  readonly status: number

  constructor(msg: string, code = -1, status = 0) {
    super(msg)
    this.name = 'RequestError'
    this.code = code
    this.status = status
  }
}

/* ---------------- token ---------------- */

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/* ---------------- 资源地址 ---------------- */

/**
 * 把库里的相对地址（/uploads/xxx.svg）补成可访问的完整地址。
 * 种子占位图与用户上传的图片都以相对地址入库，换域名不用改数据。
 */
export function assetUrl(path: string): string {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/* ---------------- 401 处理 ---------------- */

let redirecting = false

function handleUnauthorized(): void {
  clearToken()
  if (redirecting) return
  redirecting = true
  antMessage.error('登录状态已失效，请重新登录')
  // 用 replace 避免用户回退到失效页面；带上 redirect 便于登录后回到原页
  const current = `${window.location.hash.replace(/^#/, '') || '/'}`
  window.location.hash = `#/login?redirect=${encodeURIComponent(current)}`
  window.setTimeout(() => {
    redirecting = false
  }, 800)
}

/* ---------------- 核心请求 ---------------- */

export interface RequestOptions extends RequestInit {
  /** 业务失败时不弹全局提示（调用方自己处理） */
  silent?: boolean
}

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { silent = false, ...init } = options
  const headers = new Headers(init.headers ?? {})

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    if (!silent) antMessage.error('网络异常，请检查后端服务是否已启动')
    throw new RequestError('网络异常，请检查后端服务是否已启动', -1, 0)
  }

  // 204 之类没有 body 的响应
  const text = await response.text()
  let result: ApiResult<T> | null = null
  if (text) {
    try {
      result = JSON.parse(text) as ApiResult<T>
    } catch {
      result = null
    }
  }

  if (response.status === 401) {
    handleUnauthorized()
    throw new RequestError('登录状态已失效，请重新登录', 401, 401)
  }

  if (!response.ok) {
    const msg = result?.message ?? `请求失败（HTTP ${response.status}）`
    if (!silent) antMessage.error(msg)
    throw new RequestError(msg, result?.code ?? -1, response.status)
  }

  if (!result) {
    const msg = '服务端返回了非 JSON 内容'
    if (!silent) antMessage.error(msg)
    throw new RequestError(msg, -1, response.status)
  }

  if (result.code !== 0) {
    const msg = result.message || '请求失败'
    if (!silent) antMessage.error(msg)
    throw new RequestError(msg, result.code, response.status)
  }

  return result.data
}

/* ---------------- 快捷方法 ---------------- */

export function get<T>(path: string, params?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
  const query = buildQuery(params)
  return http<T>(`${path}${query}`, { method: 'GET', ...options })
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return http<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options
  })
}

export function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return http<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options
  })
}

export function patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return http<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options
  })
}

export function del<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return http<T>(path, {
    method: 'DELETE',
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options
  })
}

/** 上传文件（multipart/form-data），不走 JSON 序列化 */
export async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  return http<T>(path, { method: 'POST', body: form })
}

/** 拼查询串：跳过 undefined / null / 空串 */
function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return ''
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.append(key, String(value))
  }

  const text = search.toString()
  return text ? `?${text}` : ''
}
