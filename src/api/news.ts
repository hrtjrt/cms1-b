import { del, get, post, put } from '@/utils/request'
import type { ListQuery, NewsItem, PageResult } from '@/types'

/* ==========================================================================
   新闻动态  /api/news
   ========================================================================== */

export interface NewsQuery extends ListQuery {
  status?: number
  isTop?: number
  startDate?: string
  endDate?: string
}

export const newsApi = {
  list(query?: NewsQuery): Promise<PageResult<NewsItem>> {
    return get<PageResult<NewsItem>>('/api/news', query)
  },
  get(id: number): Promise<NewsItem> {
    return get<NewsItem>(`/api/news/${id}`)
  },
  create(data: unknown): Promise<{ id: number }> {
    return post<{ id: number }>('/api/news', data)
  },
  update(id: number, data: unknown): Promise<null> {
    return put<null>(`/api/news/${id}`, data)
  },
  remove(id: number): Promise<null> {
    return del<null>(`/api/news/${id}`)
  },
  batchDelete(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/news/batch-delete', { ids })
  }
}
