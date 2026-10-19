import { get, post, put } from '@/utils/request'
import type { AdminProfile, LoginResult, ProfileResult } from '@/types'

/* ==========================================================================
   鉴权
   ========================================================================== */

export function login(username: string, password: string): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login', { username, password })
}

/** 刷新页面时拉一次：登录人 + 权限码 + 菜单树 */
export function fetchProfile(): Promise<ProfileResult> {
  return get<ProfileResult>('/api/auth/profile')
}

export function logout(): Promise<null> {
  return post<null>('/api/auth/logout')
}

/** 修改自己的密码（需原密码） */
export function changeMyPassword(oldPassword: string, newPassword: string): Promise<null> {
  return put<null>('/api/users/me/password', { oldPassword, newPassword })
}

export type { AdminProfile }
