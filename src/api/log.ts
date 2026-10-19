import { del, get } from '@/utils/request'
import type { ListQuery, OperationLog, PageResult } from '@/types'

/* ==========================================================================
   操作日志  /api/logs
   ========================================================================== */

export interface LogQuery extends ListQuery {
  module?: string
  action?: string
  result?: number
  startDate?: string
  endDate?: string
}

export interface LogOptions {
  modules: string[]
  actions: string[]
}

export const logApi = {
  list(query?: LogQuery): Promise<PageResult<OperationLog>> {
    return get<PageResult<OperationLog>>('/api/logs', query)
  },
  options(): Promise<LogOptions> {
    return get<LogOptions>('/api/logs/options')
  },
  clear(): Promise<{ affected: number }> {
    return del<{ affected: number }>('/api/logs')
  }
}
