import { del, get, post, put } from '@/utils/request'
import type { ContactMessage, ListQuery, PageResult } from '@/types'

/* ==========================================================================
   留言管理  /api/messages

   状态流转（后端强校验，前端只按状态给按钮）：
     0 待处理 ──回复──> 1 已回复 ──标记已处理──> 2 已处理
         └──────────── 直接标记已处理 ───────────> 2 已处理
   ========================================================================== */

export interface MessageQuery extends ListQuery {
  status?: number
  subject?: string
  startDate?: string
  endDate?: string
}

/** 状态流转接口的返回 */
export interface MessageFlowResult {
  status: number
  statusLabel: string
}

export const messageApi = {
  list(query?: MessageQuery): Promise<PageResult<ContactMessage>> {
    return get<PageResult<ContactMessage>>('/api/messages', query)
  },
  get(id: number): Promise<ContactMessage> {
    return get<ContactMessage>(`/api/messages/${id}`)
  },
  subjects(): Promise<string[]> {
    return get<string[]>('/api/messages/subjects')
  },

  /** 回复 → status 1；已处理(2) 的留言会被后端拒绝 */
  reply(id: number, replyContent: string, remark?: string): Promise<MessageFlowResult> {
    return post<MessageFlowResult>(`/api/messages/${id}/reply`, { replyContent, remark })
  },

  /** 标记已处理 → status 2 */
  handle(id: number, remark?: string): Promise<MessageFlowResult> {
    return post<MessageFlowResult>(`/api/messages/${id}/handle`, { remark })
  },

  /** 重新打开 → status 0（会清空回复与处理记录） */
  reopen(id: number): Promise<MessageFlowResult> {
    return post<MessageFlowResult>(`/api/messages/${id}/reopen`)
  },

  /** 只改内部备注，不动状态 */
  updateRemark(id: number, remark: string): Promise<null> {
    return put<null>(`/api/messages/${id}/remark`, { remark })
  },

  remove(id: number): Promise<null> {
    return del<null>(`/api/messages/${id}`)
  },
  batchDelete(ids: number[]): Promise<{ affected: number }> {
    return post<{ affected: number }>('/api/messages/batch-delete', { ids })
  }
}
