import { upload } from '@/utils/request'
import type { UploadResult } from '@/types'

/* ==========================================================================
   图片上传  /api/upload/image
   返回相对地址与完整地址，库里只存相对地址（换域名不用改数据）。

   前端预校验（后端也有同样的 MIME / 大小限制，这里是提前拦截 + 明确提示）：
     · 只接受 JPG / PNG / WEBP / GIF，明确拒绝 SVG（SVG 可内嵌脚本）
     · 单文件不超过 5MB（与后端 UPLOAD_MAX_SIZE 默认值一致）
   ========================================================================== */

/** 允许的图片 MIME（不含 image/svg+xml） */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

/** 单文件大小上限：5MB */
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024

/**
 * 上传前校验文件。
 * @returns 错误提示；通过校验时返回 null
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return '只支持 JPG / PNG / WEBP / GIF 格式的图片（不支持 SVG）'
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return `图片不能超过 ${Math.round(IMAGE_MAX_SIZE / 1024 / 1024)}MB`
  }
  return null
}

export function uploadImage(file: File): Promise<UploadResult> {
  return upload<UploadResult>('/api/upload/image', file)
}
