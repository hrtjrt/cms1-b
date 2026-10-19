/* ==========================================================================
   类型定义
   与后端 cms1_backend/src/types/index.ts 逐字段对齐（camelCase）。
   这里刻意「抄一遍」而不是 import：前后端是两个独立工程，
   共享一份 d.ts 需要额外的工作区配置，得不偿失；
   字段一旦不一致会被接口契约测试（scripts/verify*.mjs）挡下来。
   ========================================================================== */

/* ---------------- 通用 ---------------- */

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 列表页通用查询参数 */
export interface ListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}

/* ---------------- 鉴权 ---------------- */

export type RoleCode = 'super_admin' | 'editor' | 'viewer'

export interface AdminProfile {
  id: number
  username: string
  nickname: string
  avatar: string
  role: RoleCode
  status: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

/** 后端下发的菜单节点 */
export interface MenuNode {
  key: string
  title: string
  path: string
  icon: string
  perm?: string
  children?: MenuNode[]
}

export interface LoginResult {
  token: string
  profile: AdminProfile
  codes: string[]
  menus: MenuNode[]
}

export interface ProfileResult {
  profile: AdminProfile
  codes: string[]
  menus: MenuNode[]
}

/* ---------------- 内容 ---------------- */

export interface Banner {
  id: number
  title: string
  image: string
  link: string
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface NewsItem {
  id: number
  title: string
  date: string
  summary: string
  content: string
  image: string
  isTop: number
  status: number
  sort: number
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: number
  name: string
  categoryId: number
  category: string
  price: number
  description: string
  image: string
  detail: string
  status: number
  showInProductCenter: number
  showOnHomepage: number
  sort: number
  homeSort: number
  createdAt: string
  updatedAt: string
}

export interface ProductCategory {
  id: number
  name: string
  sort: number
  status: number
  createdAt: string
  updatedAt: string
  productCount?: number
}

export interface CategoryOption {
  id: number
  name: string
  status: number
}

/* ---------------- 关于我们 ---------------- */

export interface AboutIntro {
  id: number
  content: string
  image: string
  updatedAt: string
}

export interface StatItem {
  id: number
  num: string
  unit: string
  label: string
  sort: number
}

export interface TimelineItem {
  id: number
  year: string
  content: string
  sort: number
}

export interface ValueItem {
  id: number
  icon: string
  title: string
  description: string
  sort: number
}

export interface HonorItem {
  id: number
  name: string
  image: string
  sort: number
}

/* ---------------- 站点 ---------------- */

export interface SiteContact {
  id: number
  address: string
  addressShort: string
  phoneMain: string
  phones: string
  email: string
  hours: string
  updatedAt: string
}

export interface SiteConfig {
  id: number
  siteName: string
  footerText: string
  logoUrl: string
  mapEmbedUrl: string
  companyName: string
  updatedAt: string
}

export interface PageHeroConfig {
  id: number
  pageKey: string
  pageName: string
  title: string
  subtitle: string
  image: string
  height: string
  heightSm: string
  mask: string
  letterSpacing: string
  subtitleSize: string
  subtitleSpacing: string
  subtitleOpacity: string
  sort: number
}

/* ---------------- 留言 ---------------- */

/**
 * 留言状态：
 *   0 待处理 → 1 已回复 → 2 已处理
 */
export interface ContactMessage {
  id: number
  name: string
  email: string
  phone: string
  subject: string
  message: string
  status: number
  replyContent: string
  replyUserId: number
  replyUsername: string
  replyAt: string | null
  handleUserId: number
  handleUsername: string
  handledAt: string | null
  remark: string
  createdAt: string
}

/* ---------------- 管理员 ---------------- */

export interface AdminUser {
  id: number
  username: string
  nickname: string
  avatar: string
  role: RoleCode
  status: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

/* ---------------- 日志 ---------------- */

export interface OperationLog {
  id: number
  userId: number
  username: string
  module: string
  action: string
  method: string
  path: string
  targetId: number
  detail: string
  result: number
  errorMessage: string
  ip: string
  createdAt: string
}

/* ---------------- 仪表盘 ---------------- */

export interface DashboardStats {
  newsTotal: number
  newsDraftTotal: number
  productTotal: number
  productOnlineTotal: number
  homepageTotal: number
  messagePending: number
  messageReplied: number
  honorTotal: number
  bannerTotal: number
  userTotal: number
}

export interface DashboardCharts {
  categoryPie: Array<{ name: string; value: number }>
  messageTrend: Array<{ date: string; value: number }>
  newsMonthly: Array<{ month: string; value: number }>
  messageStatus: Array<{ name: string; value: number }>
}

export interface DashboardData {
  stats: DashboardStats
  charts: DashboardCharts
}

/* ---------------- 上传 ---------------- */

export interface UploadResult {
  url: string
  fullUrl: string
  filename: string
  size: number
}

/* ---------------- 选项 ---------------- */

export const MESSAGE_STATUS_OPTIONS = [
  { value: 0, label: '待处理', color: 'processing' },
  { value: 1, label: '已回复', color: 'warning' },
  { value: 2, label: '已处理', color: 'success' }
] as const

export const ROLE_OPTIONS = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'editor', label: '内容编辑' },
  { value: 'viewer', label: '只读访客' }
] as const
