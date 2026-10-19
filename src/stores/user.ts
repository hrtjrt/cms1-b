import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { clearToken, getToken, setToken } from '@/utils/request'
import * as authApi from '@/api/auth'
import type { AdminProfile, MenuNode, RoleCode } from '@/types'

/* ==========================================================================
   登录态 / 权限码 / 菜单
   菜单与权限码全部由后端下发，前端不维护第二份权限表 ——
   角色调整只需要改后端 config/permissions.ts 与 config/menus.ts。
   ========================================================================== */

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken())
  const profile = ref<AdminProfile | null>(null)
  const codes = ref<string[]>([])
  const menus = ref<MenuNode[]>([])
  /** 是否已经拉过一次 profile（路由守卫用它避免重复请求） */
  const loaded = ref(false)

  const isLogin = computed(() => Boolean(token.value))
  const role = computed<RoleCode | ''>(() => profile.value?.role ?? '')
  const displayName = computed(() => profile.value?.nickname || profile.value?.username || '未登录')
  const avatar = computed(() => profile.value?.avatar ?? '')

  /** 是否拥有某个权限码 */
  function has(code?: string): boolean {
    if (!code) return true
    return codes.value.includes(code)
  }

  /** 是否拥有其中任意一个 */
  function hasAny(list: readonly string[]): boolean {
    if (list.length === 0) return true
    return list.some((code) => codes.value.includes(code))
  }

  function apply(data: { profile: AdminProfile; codes: string[]; menus: MenuNode[] }): void {
    profile.value = data.profile
    codes.value = data.codes
    menus.value = data.menus
    loaded.value = true
  }

  async function doLogin(username: string, password: string): Promise<void> {
    const result = await authApi.login(username, password)
    token.value = result.token
    setToken(result.token)
    apply(result)
  }

  /** 刷新页面后恢复登录态；silent=true 时不弹错误（用于守卫里探测） */
  async function loadProfile(force = false): Promise<void> {
    if (loaded.value && !force) return
    if (!token.value) throw new Error('未登录')
    apply(await authApi.fetchProfile())
  }

  function reset(): void {
    token.value = ''
    profile.value = null
    codes.value = []
    menus.value = []
    loaded.value = false
    clearToken()
  }

  async function doLogout(): Promise<void> {
    // 后端只是记一条操作日志，失败也不影响前端登出
    try {
      await authApi.logout()
    } catch {
      /* 忽略 */
    }
    reset()
  }

  return {
    token,
    profile,
    codes,
    menus,
    loaded,
    isLogin,
    role,
    displayName,
    avatar,
    has,
    hasAny,
    doLogin,
    loadProfile,
    doLogout,
    reset
  }
})
