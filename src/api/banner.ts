import { del, get, post, put } from '@/utils/request'
import type { Banner, ListQuery, PageResult } from '@/types'

/* ==========================================================================
   首页轮播图  /api/banners
   ========================================================================== */

export const bannerApi = {
  list(query?: ListQuery): Promise<PageResult<Banner>> {
    return get<PageResult<Banner>>('/api/banners', query)
  },
  get(id: number): Promise<Banner> {
    return get<Banner>(`/api/banners/${id}`)
  },
  create(data: unknown): Promise<{ id: number }> {
    return post<{ id: number }>('/api/banners', data)
  },
  update(id: number, data: unknown): Promise<null> {
    return put<null>(`/api/banners/${id}`, data)
  },
  remove(id: number): Promise<null> {
    return del<null>(`/api/banners/${id}`)
  },
  batchDelete(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/banners/batch-delete', { ids })
  },
  sort(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/banners/sort', { ids })
  }
}
