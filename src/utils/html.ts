import { API_BASE_URL } from '@/utils/request'

/* ==========================================================================
   富文本里的资源地址处理

   约定：库里只存相对地址（/uploads/xxx.png），换域名不用改数据。
   但富文本（新闻正文 / 商品详情）里的 <img> 是 HTML 片段，
   浏览器直接渲染时相对地址会打到「当前站点」，后台与后端不同源时会 404。

   所以：
     · 显示前  resolveHtmlAssets()  —— 把 /uploads/... 补成完整地址
     · 保存前  toStoredHtml()       —— 把完整地址还原成 /uploads/...
   两个函数互为逆运算，只在富文本边界上使用。
   ========================================================================== */

const UPLOAD_PREFIX = '/uploads/'

/** 显示用：相对资源地址 → 可访问的完整地址 */
export function resolveHtmlAssets(html: string): string {
  const text = String(html ?? '')
  if (!text || !API_BASE_URL) return text

  return text.replace(
    /(\s(?:src|href|data-src)\s*=\s*["'])(\/uploads\/[^"']*)(["'])/gi,
    (_match, head: string, path: string, tail: string) => `${head}${API_BASE_URL}${path}${tail}`
  )
}

/** 保存用：完整地址 → 相对地址（只处理指向本服务 /uploads 的地址） */
export function toStoredHtml(html: string): string {
  const text = String(html ?? '')
  if (!text || !API_BASE_URL) return text

  const escaped = API_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(
    new RegExp(`(\\s(?:src|href|data-src)\\s*=\\s*["'])${escaped}(/uploads/[^"']*)(["'])`, 'gi'),
    (_match, head: string, path: string, tail: string) => `${head}${path}${tail}`
  )
}

/** 去掉全部标签，得到纯文本（列表页预览用） */
export function stripHtml(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 富文本是否为空（只有空白标签也算空） */
export function isEmptyHtml(html: string): boolean {
  return stripHtml(html).length === 0
}
