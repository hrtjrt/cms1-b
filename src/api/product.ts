import { del, get, patch, post, put } from '@/utils/request'
import type { CategoryOption, ListQuery, PageResult, Product, ProductCategory } from '@/types'

/* ==========================================================================
   商品与产品分类
   商品展示层级：
     showInProductCenter = 1            → 出现在产品中心
     showOnHomepage       = 1（含左侧）  → 出现在首页产品位（为 1 时前者必须为 1）
   ========================================================================== */

export interface ProductQuery extends ListQuery {
  status?: number
  categoryId?: number
  showInProductCenter?: number
  showOnHomepage?: number
}

/** 层级变更接口的返回：notice 是后端给的人话提示，直接拿来弹 */
export interface ProductMutationResult {
  id: number
  hierarchy?: string
  /** 例如「已取消产品中心展示，首页产品位也一并取消」 */
  notice?: string
}

export const productApi = {
  list(query?: ProductQuery): Promise<PageResult<Product>> {
    return get<PageResult<Product>>('/api/products', query)
  },
  get(id: number): Promise<Product> {
    return get<Product>(`/api/products/${id}`)
  },
  create(data: unknown): Promise<ProductMutationResult> {
    return post<ProductMutationResult>('/api/products', data)
  },
  update(id: number, data: unknown): Promise<ProductMutationResult> {
    return put<ProductMutationResult>(`/api/products/${id}`, data)
  },
  /** 列表页快捷开关：只改层级，未传的字段保持原值 */
  updateFlags(
    id: number,
    flags: { showInProductCenter?: number; showOnHomepage?: number }
  ): Promise<ProductMutationResult> {
    return patch<ProductMutationResult>(`/api/products/${id}/flags`, flags)
  },
  remove(id: number): Promise<null> {
    return del<null>(`/api/products/${id}`)
  },
  batchDelete(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/products/batch-delete', { ids })
  },
  /** mode='home' 时重排首页产品位顺序 */
  sort(ids: number[], mode?: 'home'): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/products/sort', { ids, mode })
  }
}

export const categoryApi = {
  list(query?: ListQuery): Promise<PageResult<ProductCategory>> {
    return get<PageResult<ProductCategory>>('/api/categories', query)
  },
  options(): Promise<CategoryOption[]> {
    return get<CategoryOption[]>('/api/categories/options')
  },
  get(id: number): Promise<ProductCategory> {
    return get<ProductCategory>(`/api/categories/${id}`)
  },
  create(data: unknown): Promise<{ id: number }> {
    return post<{ id: number }>('/api/categories', data)
  },
  update(id: number, data: unknown): Promise<null> {
    return put<null>(`/api/categories/${id}`, data)
  },
  remove(id: number): Promise<null> {
    return del<null>(`/api/categories/${id}`)
  },
  batchDelete(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/categories/batch-delete', { ids })
  },
  sort(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/categories/sort', { ids })
  }
}
