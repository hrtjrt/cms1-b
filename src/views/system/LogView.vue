<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Modal, message } from 'ant-design-vue'
import { ClearOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { logApi } from '@/api/log'
import { useCrud } from '@/composables/useCrud'
import { dash, formatDateTime } from '@/utils/format'
import type { OperationLog } from '@/types'

/* ==========================================================================
   操作日志

   日志在写操作结束后由后端中间件异步落库，成功与失败都记：
     result = 1 成功 / 0 失败，失败时 error_message 里是原因。
   本页可以按模块、动作、结果、时间区间筛选，也支持清空（演示时重置用）。
   ========================================================================== */

const {
  loading,
  list,
  keyword,
  filters,
  pagination,
  load,
  search,
  reset,
  handleTableChange
} = useCrud<OperationLog>(logApi, {
  defaultPageSize: 15,
  defaultSortBy: 'createdAt',
  defaultSortOrder: 'desc'
})

const moduleOptions = ref<string[]>([])
const actionOptions = ref<string[]>([])
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | undefined>(undefined)

/** 模块名 → 中文 */
const MODULE_LABELS: Record<string, string> = {
  auth: '鉴权',
  banner: '轮播图',
  news: '新闻',
  product: '商品',
  category: '产品分类',
  about: '关于我们',
  site: '站点',
  message: '留言',
  user: '管理员',
  log: '日志'
}

/** 动作名 → 中文。展示层级相关的动作是 v2 新增的（上下架 / 上首页） */
const ACTION_LABELS: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  batchDelete: '批量删除',
  sort: '排序',
  reply: '回复留言',
  handle: '标记已处理',
  reopen: '重新打开',
  updateRemark: '改备注',
  onShelf: '上产品中心',
  offShelf: '下产品中心',
  toHomepage: '上首页产品位',
  offHomepage: '下首页产品位',
  updateFlags: '改展示设置',
  logout: '退出登录',
  login: '登录',
  loginFailed: '登录失败',
  clear: '清空日志',
  updateIntro: '改公司简介',
  updateContact: '改联系方式',
  updateConfig: '改站点配置',
  updatePageHero: '改页面 Banner',
  resetPassword: '重置密码'
}

/** 高亮「层级变更」与「留言流转」这类业务动作，一眼能看到 */
const IMPORTANT_ACTIONS = new Set(['onShelf', 'offShelf', 'toHomepage', 'offHomepage'])

function moduleText(value: string): string {
  return MODULE_LABELS[value] ?? value
}

function actionText(value: string): string {
  return ACTION_LABELS[value] ?? value
}

async function loadOptions(): Promise<void> {
  try {
    const options = await logApi.options()
    moduleOptions.value = options.modules
    actionOptions.value = options.actions
  } catch {
    moduleOptions.value = []
    actionOptions.value = []
  }
}

function onDateChange(): void {
  const range = dateRange.value
  filters.startDate = range?.[0] ? range[0].format('YYYY-MM-DD') : undefined
  filters.endDate = range?.[1] ? range[1].format('YYYY-MM-DD') : undefined
  search()
}

function resetAll(): void {
  dateRange.value = undefined
  filters.startDate = undefined
  filters.endDate = undefined
  reset()
}

function clearAll(): void {
  Modal.confirm({
    title: '确定清空全部操作日志吗？',
    content: '清空后不可恢复（仅影响日志，不影响业务数据）。',
    okText: '确定清空',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const result = await logApi.clear()
      message.success(`已清空 ${result.affected} 条日志`)
      await Promise.all([load(), loadOptions()])
    }
  })
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80, sorter: true },
  { title: '操作人', key: 'username', width: 110 },
  { title: '模块', key: 'module', width: 110 },
  { title: '动作', key: 'action', width: 130 },
  { title: '请求', key: 'request', width: 240 },
  { title: '对象', key: 'targetId', width: 80 },
  { title: '补充说明', key: 'detail' },
  { title: '结果', key: 'result', width: 90 },
  { title: 'IP', key: 'ip', width: 130 },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, sorter: true }
]

onMounted(async () => {
  await Promise.all([loadOptions(), load()])
})
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索操作人 / 路径 / 说明"
          allow-clear
          style="width: 240px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <a-select
          v-model:value="filters.module"
          placeholder="全部模块"
          allow-clear
          style="width: 150px"
          :options="moduleOptions.map((item) => ({ value: item, label: moduleText(item) }))"
          @change="search"
        />

        <a-select
          v-model:value="filters.action"
          placeholder="全部动作"
          allow-clear
          show-search
          style="width: 170px"
          :options="actionOptions.map((item) => ({ value: item, label: actionText(item) }))"
          @change="search"
        />

        <a-select
          v-model:value="filters.result"
          placeholder="结果"
          allow-clear
          style="width: 120px"
          :options="[
            { value: 1, label: '成功' },
            { value: 0, label: '失败' }
          ]"
          @change="search"
        />

        <a-range-picker v-model:value="dateRange" @change="onDateChange" />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="resetAll">重置</a-button>

        <div class="spacer" />

        <a-button v-perm="'log:view'" danger @click="clearAll">
          <template #icon><ClearOutlined /></template>
          清空日志
        </a-button>
      </div>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1600 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'username'">
            {{ record.username ? dash(record.username) : '（未登录）' }}
          </template>

          <template v-else-if="column.key === 'module'">
            <a-tag>{{ moduleText(record.module) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-tag :color="IMPORTANT_ACTIONS.has(record.action) ? 'purple' : 'blue'">
              {{ actionText(record.action) }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'request'">
            <div class="cell-sub" style="margin-top: 0">
              <code>{{ record.method }}</code> {{ record.path }}
            </div>
          </template>

          <template v-else-if="column.key === 'detail'">
            <div class="cell-wrap">{{ dash(record.detail) }}</div>
          </template>

          <template v-else-if="column.key === 'result'">
            <a-tag :color="record.result === 1 ? 'green' : 'red'">
              {{ record.result === 1 ? '成功' : '失败' }}
            </a-tag>
            <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
              <div class="cell-sub" style="margin-top: 4px; max-width: 90px">
                {{ record.errorMessage.slice(0, 10) }}…
              </div>
            </a-tooltip>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无操作日志" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>
