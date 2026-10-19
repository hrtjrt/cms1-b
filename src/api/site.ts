import { get, put } from '@/utils/request'
import type { PageHeroConfig, SiteConfig, SiteContact } from '@/types'

/* ==========================================================================
   站点管理  /api/site
   联系方式与站点配置都是单例；页面 Banner 是固定 3 条（about/news/contact），
   只允许改文案与样式，不允许增删。
   ========================================================================== */

export const contactApi = {
  get(): Promise<SiteContact> {
    return get<SiteContact>('/api/site/contact')
  },
  update(data: Omit<SiteContact, 'id' | 'updatedAt'>): Promise<null> {
    return put<null>('/api/site/contact', data)
  }
}

export const configApi = {
  get(): Promise<SiteConfig> {
    return get<SiteConfig>('/api/site/config')
  },
  update(data: Omit<SiteConfig, 'id' | 'updatedAt'>): Promise<null> {
    return put<null>('/api/site/config', data)
  }
}

export const pageHeroApi = {
  list(): Promise<PageHeroConfig[]> {
    return get<PageHeroConfig[]>('/api/site/page-heroes')
  },
  get(id: number): Promise<PageHeroConfig> {
    return get<PageHeroConfig>(`/api/site/page-heroes/${id}`)
  },
  /** pageKey / pageName 只读，后端会忽略 */
  update(id: number, data: Partial<PageHeroConfig>): Promise<null> {
    return put<null>(`/api/site/page-heroes/${id}`, data)
  }
}
