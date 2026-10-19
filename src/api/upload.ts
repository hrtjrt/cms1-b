import { upload } from '@/utils/request'
import type { UploadResult } from '@/types'

/* ==========================================================================
   图片上传  /api/upload/image
   返回相对地址与完整地址，库里只存相对地址（换域名不用改数据）。
   ========================================================================== */

export function uploadImage(file: File): Promise<UploadResult> {
  return upload<UploadResult>('/api/upload/image', file)
}
