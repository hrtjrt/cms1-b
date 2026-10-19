import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import BasicLayout from '@/layouts/BasicLayout.vue'
import type { RouteRecordRaw } from 'vue-router'

/* ==========================================================================
   路由

   用 hash 模式（createWebHashHistory）：后台管理是内部系统，不需要 SEO，
   hash 模式让构建产物可以放在任意静态目录、甚至直接双击 index.html 打开，
   不依赖服务器的 history fallback 配置，交付时省事很多。

   侧边栏菜单不用这份路由表渲染 —— 菜单完全由后端下发（/api/auth/menus），
   这里只负责「路径 → 组件」的映射，以及 meta 里的权限码用于路由级拦截。
   ========================================================================== */

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: BasicLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '仪表盘', perm: 'dashboard:view' }
      },

      /* ---------------- 内容管理 ---------------- */
      {
        path: 'content/banner',
        name: 'banner',
        component: () => import('@/views/content/BannerView.vue'),
        meta: { title: '轮播图管理', perm: 'banner:view' }
      },
      {
        path: 'content/news',
        name: 'news',
        component: () => import('@/views/content/NewsView.vue'),
        meta: { title: '新闻管理', perm: 'news:view' }
      },

      /* ---------------- 商品管理 ---------------- */
      {
        path: 'product/list',
        name: 'productList',
        component: () => import('@/views/product/ProductListView.vue'),
        meta: { title: '商品列表', perm: 'product:view' }
      },
      {
        path: 'product/homepage',
        name: 'productHomepage',
        component: () => import('@/views/product/HomepageView.vue'),
        meta: { title: '首页产品位', perm: 'product:view' }
      },
      {
        path: 'product/category',
        name: 'category',
        component: () => import('@/views/product/CategoryView.vue'),
        meta: { title: '产品分类', perm: 'category:view' }
      },

      /* ---------------- 关于我们 ---------------- */
      {
        path: 'about/intro',
        name: 'aboutIntro',
        component: () => import('@/views/about/IntroView.vue'),
        meta: { title: '公司简介', perm: 'about:view' }
      },
      {
        path: 'about/history',
        name: 'aboutHistory',
        component: () => import('@/views/about/HistoryView.vue'),
        meta: { title: '发展历程', perm: 'about:view' }
      },
      {
        path: 'about/values',
        name: 'aboutValues',
        component: () => import('@/views/about/ValueView.vue'),
        meta: { title: '核心价值观', perm: 'about:view' }
      },
      {
        path: 'about/honor',
        name: 'aboutHonor',
        component: () => import('@/views/about/HonorView.vue'),
        meta: { title: '荣誉资质', perm: 'about:view' }
      },

      /* ---------------- 站点管理 ---------------- */
      {
        path: 'site/config',
        name: 'siteConfig',
        component: () => import('@/views/site/ConfigView.vue'),
        meta: { title: '站点配置', perm: 'site:view' }
      },
      {
        path: 'site/contact',
        name: 'siteContact',
        component: () => import('@/views/site/ContactView.vue'),
        meta: { title: '联系方式', perm: 'site:view' }
      },
      {
        path: 'site/page-hero',
        name: 'pageHero',
        component: () => import('@/views/site/PageHeroView.vue'),
        meta: { title: '页面 Banner', perm: 'site:view' }
      },

      /* ---------------- 留言管理 ---------------- */
      {
        path: 'message/list',
        name: 'message',
        component: () => import('@/views/message/MessageView.vue'),
        meta: { title: '留言管理', perm: 'message:view' }
      },

      /* ---------------- 系统管理 ---------------- */
      {
        path: 'system/user',
        name: 'user',
        component: () => import('@/views/system/UserView.vue'),
        meta: { title: '管理员', perm: 'user:view' }
      },
      {
        path: 'system/log',
        name: 'log',
        component: () => import('@/views/system/LogView.vue'),
        meta: { title: '操作日志', perm: 'log:view' }
      },

      /* ---------------- 个人 ---------------- */
      {
        path: 'profile/password',
        name: 'changePassword',
        component: () => import('@/views/profile/PasswordView.vue'),
        meta: { title: '修改密码' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在', public: true }
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

/* ==========================================================================
   全局守卫

   1. 未登录 → 去登录页（带上 redirect）
   2. 已登录但还没拉过 profile → 先拉一次（刷新页面时走这条）
   3. 路由 meta.perm 不满足 → 去 403 提示页
   ========================================================================== */
router.beforeEach(async (to) => {
  const store = useUserStore()

  if (to.meta.public) {
    // 已登录时再访问登录页，直接回首页
    if (to.name === 'login' && store.isLogin && store.loaded) return { path: '/' }
    return true
  }

  if (!store.isLogin) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (!store.loaded) {
    try {
      await store.loadProfile()
    } catch {
      store.reset()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  const perm = to.meta.perm as string | undefined
  if (perm && !store.has(perm)) {
    return { name: 'notFound', query: { denied: '1' } }
  }

  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? ''
  const base = import.meta.env.VITE_APP_TITLE ?? 'CMS 管理后台'
  document.title = title ? `${title} - ${base}` : base
})

export default router
