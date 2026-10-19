import 'vue-router'

/* ==========================================================================
   扩展 RouteMeta：让 route.meta.title / .perm / .public 有类型
   ========================================================================== */

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题（用于 document.title 与面包屑） */
    title?: string
    /** 访问该路由需要的权限码；不满足则拦截 */
    perm?: string
    /** 是否无需登录即可访问 */
    public?: boolean
  }
}
