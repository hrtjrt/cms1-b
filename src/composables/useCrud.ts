import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import type { Ref } from 'vue'
import type { ListQuery, PageResult } from '@/types'

/* ==========================================================================
   列表页通用逻辑

   后台 12 个列表页（轮播图 / 新闻 / 商品 / 分类 / 4 个关于我们 / 留言 / 管理员 / 日志）
   的分页、搜索、排序、多选、删除几乎一样，抽成一个 composable，
   各页面只描述「列」与「表单」，不再重复写 loading / pagination。
   ========================================================================== */

/** 列表页需要的接口集合，缺哪个就不渲染对应的按钮 */
export interface CrudApi<T> {
  /**
   * 列表接口。允许两种返回：
   *   · 分页结果 PageResult<T>（新闻 / 商品 / 留言…）
   *   · 直接返回数组 T[]（关于我们的 4 个子模块，条目本来就少、后端不分页）
   */
  list(query?: ListQuery): Promise<PageResult<T> | T[]>
  create?: (data: unknown) => Promise<unknown>
  update?: (id: number, data: unknown) => Promise<unknown>
  remove?: (id: number) => Promise<unknown>
  batchDelete?: (ids: number[]) => Promise<{ affected: number }>
  sort?: (ids: number[]) => Promise<{ affected: number }>
}

export interface UseCrudOptions {
  defaultPageSize?: number
  defaultSortBy?: string
  defaultSortOrder?: 'asc' | 'desc'
  /** 额外的固定筛选条件（例如「只看首页产品位」） */
  baseParams?: () => Record<string, unknown>
  /** 挂载后是否立即加载 */
  immediate?: boolean
}

export function useCrud<T extends { id: number }>(
  api: CrudApi<T>,
  options: UseCrudOptions = {}
) {
  const loading = ref(false)
  // 显式标成 Ref<T[]>：ref() 会把 T[] 推成 UnwrapRef<T[]>，赋值时报错
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(options.defaultPageSize ?? 10)
  const keyword = ref('')
  const sortBy = ref(options.defaultSortBy ?? '')
  const sortOrder = ref<'asc' | 'desc'>(options.defaultSortOrder ?? 'desc')

  /** 各页面自己的筛选条件（状态下拉、分类下拉、日期区间…） */
  const filters = reactive<Record<string, unknown>>({})

  const selectedKeys = ref<number[]>([]) as Ref<number[]>

  const pagination = computed(() => ({
    current: page.value,
    pageSize: pageSize.value,
    total: total.value,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (count: number) => `共 ${count} 条`
  }))

  async function load(): Promise<void> {
    loading.value = true
    try {
      const query: Record<string, unknown> = {
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        ...(options.baseParams?.() ?? {}),
        ...filters
      }
      const result = await api.list(query as ListQuery)
      if (Array.isArray(result)) {
        // 不分页的接口：直接铺满一页，分页器会自动隐藏
        list.value = result
        total.value = result.length
      } else {
        list.value = result.list
        total.value = result.total
      }
    } catch {
      // 错误提示已由 request 层统一弹出，这里只需保证表格不卡在 loading
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 条件变化后从第一页重新查 */
  function search(): void {
    page.value = 1
    void load()
  }

  /** 清空筛选并回到第一页（保留 pageSize） */
  function reset(): void {
    keyword.value = ''
    for (const key of Object.keys(filters)) delete filters[key]
    page.value = 1
    sortBy.value = options.defaultSortBy ?? ''
    sortOrder.value = options.defaultSortOrder ?? 'desc'
    void load()
  }

  /** antd 表格的分页/排序变化 */
  function handleTableChange(
    pag: { current?: number; pageSize?: number },
    _filters: unknown,
    sorter: { field?: string | string[]; order?: 'ascend' | 'descend' | null } | Array<unknown>
  ): void {
    page.value = pag.current ?? 1
    pageSize.value = pag.pageSize ?? pageSize.value

    const single = Array.isArray(sorter) ? sorter[0] : sorter
    const s = single as { field?: string | string[]; order?: 'ascend' | 'descend' | null } | undefined
    if (s?.field && s.order) {
      sortBy.value = Array.isArray(s.field) ? String(s.field[0]) : String(s.field)
      sortOrder.value = s.order === 'ascend' ? 'asc' : 'desc'
    }

    void load()
  }

  /** 删除单条（带二次确认） */
  async function removeRow(row: T, label = '这条记录'): Promise<boolean> {
    if (!api.remove) return false
    const confirmed = await confirm(`确定删除${label}吗？`, '删除后不可恢复。')
    if (!confirmed) return false

    try {
      await api.remove(row.id)
      message.success('删除成功')

      // 删掉当前页最后一条时往前翻一页，避免停在空页
      if (list.value.length === 1 && page.value > 1) page.value -= 1
      await load()
      return true
    } catch {
      return false
    }
  }

  /** 批量删除 */
  async function batchRemove(): Promise<void> {
    if (!api.batchDelete) return
    if (selectedKeys.value.length === 0) {
      message.warning('请先勾选要删除的记录')
      return
    }

    const count = selectedKeys.value.length
    const confirmed = await confirm(`确定删除选中的 ${count} 条记录吗？`, '删除后不可恢复。')
    if (!confirmed) return

    try {
      const result = await api.batchDelete([...selectedKeys.value])
      message.success(`已删除 ${result?.affected ?? count} 条`)
      // 整页被删空时往前翻一页，避免停在空页
      if (list.value.length === count && page.value > 1) page.value -= 1
      selectedKeys.value = []
      await load()
    } catch {
      /* 已提示 */
    }
  }

  /**
   * 上移 / 下移一行（按列表顺序重排 sort）。
   * 只适用于「一页看全」的小列表（轮播图、分类、关于我们的 4 个子模块），
   * 因此这些页面的 pageSize 默认给 100。
   */
  async function moveRow(index: number, delta: number): Promise<void> {
    if (!api.sort) return
    const target = index + delta
    if (target < 0 || target >= list.value.length) return

    const current = list.value[index]
    const swap = list.value[target]
    if (!current || !swap) return

    // 先本地交换，界面立即响应，再提交后端
    list.value[index] = swap
    list.value[target] = current

    try {
      await api.sort(list.value.map((item) => item.id))
      message.success('排序已更新')
      await load()
    } catch {
      await load()
    }
  }

  function clearSelection(): void {
    selectedKeys.value = []
  }

  return {
    loading,
    list,
    total,
    page,
    pageSize,
    keyword,
    sortBy,
    sortOrder,
    filters,
    selectedKeys,
    pagination,
    load,
    search,
    reset,
    handleTableChange,
    removeRow,
    batchRemove,
    moveRow,
    clearSelection
  }
}

/** 统一的二次确认，返回是否点了确定 */
export function confirm(title: string, content?: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
}
