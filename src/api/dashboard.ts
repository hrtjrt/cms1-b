import { get } from '@/utils/request'
import type { DashboardData } from '@/types'

/* ==========================================================================
   仪表盘
   ========================================================================== */

export function fetchDashboard(): Promise<DashboardData> {
  return get<DashboardData>('/api/dashboard')
}
