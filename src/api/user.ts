import { del, get, post, put } from '@/utils/request'
import type { AdminUser, ListQuery, PageResult } from '@/types'

/* ==========================================================================
   管理员  /api/users
   ========================================================================== */

export interface UserQuery extends ListQuery {
  role?: string
  status?: number
}

export const userApi = {
  list(query?: UserQuery): Promise<PageResult<AdminUser>> {
    return get<PageResult<AdminUser>>('/api/users', query)
  },
  get(id: number): Promise<AdminUser> {
    return get<AdminUser>(`/api/users/${id}`)
  },
  create(data: unknown): Promise<{ id: number }> {
    return post<{ id: number }>('/api/users', data)
  },
  update(id: number, data: unknown): Promise<null> {
    return put<null>(`/api/users/${id}`, data)
  },
  /** 超管重置他人密码，不需要原密码 */
  resetPassword(id: number, newPassword: string): Promise<null> {
    return put<null>(`/api/users/${id}/password`, { newPassword })
  },
  remove(id: number): Promise<null> {
    return del<null>(`/api/users/${id}`)
  }
}
