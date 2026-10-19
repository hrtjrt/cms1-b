import { del, get, post, put } from '@/utils/request'
import type { AboutIntro, HonorItem, StatItem, TimelineItem, ValueItem } from '@/types'

/* ==========================================================================
   关于我们  /api/about
   简介是单例（GET/PUT），其余四个模块是条目很少的排序列表（直接返回数组、不分页）。
   四个列表结构一致，用一个工厂生成，避免写四遍。
   ========================================================================== */

export interface AboutListApi<T> {
  list(): Promise<T[]>
  create(data: unknown): Promise<{ id: number }>
  update(id: number, data: unknown): Promise<null>
  remove(id: number): Promise<null>
  sort(ids: number[]): Promise<{ affected: number }>
}

function createAboutListApi<T>(path: string): AboutListApi<T> {
  return {
    list: () => get<T[]>(`/api/about/${path}`),
    create: (data) => post<{ id: number }>(`/api/about/${path}`, data),
    update: (id, data) => put<null>(`/api/about/${path}/${id}`, data),
    remove: (id) => del<null>(`/api/about/${path}/${id}`),
    sort: (ids) => post<{ affected: number }>(`/api/about/${path}/sort`, { ids })
  }
}

export const statApi = createAboutListApi<StatItem>('stats')
export const historyApi = createAboutListApi<TimelineItem>('history')
export const valueApi = createAboutListApi<ValueItem>('values')
export const honorApi = createAboutListApi<HonorItem>('honors')

export const introApi = {
  get(): Promise<AboutIntro> {
    return get<AboutIntro>('/api/about/intro')
  },
  update(data: { content: string; image: string }): Promise<null> {
    return put<null>('/api/about/intro', data)
  }
}
