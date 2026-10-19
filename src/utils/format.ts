import { MESSAGE_STATUS_OPTIONS, ROLE_OPTIONS } from '@/types'

/* ==========================================================================
   展示层格式化
   后端返回的都是原始值，这里统一转成界面文案，避免各页面各写一套
   ========================================================================== */

/** 空值兜底：表格里空字符串很难看，统一显示成 — */
export function dash(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

/** 日期时间：2026-09-18 16:30:00 → 2026-09-18 16:30 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length >= 16 ? value.slice(0, 16) : value
}

/** 纯日期 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

/** 金额：¥1,234.56 */
export function formatPrice(value: number | string | null | undefined): string {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '—'
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 0 / 1 → 启用 / 停用 */
export function statusText(value: number): string {
  return Number(value) === 1 ? '启用' : '停用'
}

/** 留言状态文案与颜色 */
export function messageStatusText(value: number): string {
  return MESSAGE_STATUS_OPTIONS.find((item) => item.value === Number(value))?.label ?? '未知'
}

export function messageStatusColor(value: number): string {
  return MESSAGE_STATUS_OPTIONS.find((item) => item.value === Number(value))?.color ?? 'default'
}

/** 角色文案 */
export function roleText(value: string): string {
  return ROLE_OPTIONS.find((item) => item.value === value)?.label ?? value
}

/** 角色标签颜色 */
export function roleColor(value: string): string {
  if (value === 'super_admin') return 'red'
  if (value === 'editor') return 'blue'
  return 'default'
}

/** 截断长文本 */
export function ellipsis(value: string, max = 40): string {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 去掉 HTML 标签，用于在列表里预览富文本 */
export function stripHtml(value: string): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
