<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { messageApi } from '@/api/message'
import { useCrud } from '@/composables/useCrud'
import { dash, formatDateTime, messageStatusColor, messageStatusText } from '@/utils/format'
import type { ContactMessage } from '@/types'

/* ==========================================================================
   留言管理

   状态机（后端强校验，前端按当前状态决定显示哪些按钮）：
     0 待处理 ──回复──> 1 已回复 ──标记已处理──> 2 已处理
         └──────────── 直接标记已处理 ───────────> 2 已处理

   前端不做「哪些动作合法」的判断，全部依赖后端返回的 400 + 提示语兜底，
   这样规则只有一份（后端），不会出现前后端理解不一致。
   ========================================================================== */

const {
  loading,
  list,
  keyword,
  filters,
  selectedKeys,
  pagination,
  load,
  search,
  reset,
  removeRow,
  batchRemove,
  handleTableChange
} = useCrud<ContactMessage>(messageApi, {
  defaultPageSize: 10,
  defaultSortBy: 'createdAt',
  defaultSortOrder: 'desc'
})

const subjectOptions = ref<string[]>([])
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | undefined>(undefined)

/** 状态快捷切换：全部 / 待处理 / 已回复 / 已处理 */
const statusTabs = [
  { value: undefined, label: '全部' },
  { value: 0, label: '待处理' },
  { value: 1, label: '已回复' },
  { value: 2, label: '已处理' }
] as const

const activeStatus = ref<number | undefined>(undefined)

function switchStatus(value: number | undefined): void {
  activeStatus.value = value
  filters.status = value
  search()
}

const columns = [
  { title: '留言人', key: 'name', width: 170 },
  { title: '主题', key: 'subject', width: 110 },
  { title: '留言内容', key: 'message' },
  { title: '状态', key: 'status', width: 100 },
  { title: '流转记录', key: 'flow', width: 200 },
  { title: '留言时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, sorter: true },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const }
]

/** 状态计数：当前页的分布，用于快速感知；精确统计在仪表盘 */
const counts = computed(() => {
  const result = { 0: 0, 1: 0, 2: 0 } as Record<number, number>
  for (const item of list.value) result[item.status] = (result[item.status] ?? 0) + 1
  return result
})

async function loadSubjects(): Promise<void> {
  try {
    subjectOptions.value = await messageApi.subjects()
  } catch {
    subjectOptions.value = []
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
  activeStatus.value = undefined
  filters.startDate = undefined
  filters.endDate = undefined
  reset()
}

/* ---------------- 详情抽屉 ---------------- */

const drawerOpen = ref(false)
const current = ref<ContactMessage | null>(null)

function openDetail(row: ContactMessage): void {
  current.value = row
  drawerOpen.value = true
}

/** 动作完成后刷新抽屉里的数据与列表 */
async function refreshCurrent(): Promise<void> {
  if (!current.value) return
  try {
    current.value = await messageApi.get(current.value.id)
  } catch {
    /* 已提示 */
  }
  await load()
}

/* ---------------- 回复 ---------------- */

const replyOpen = ref(false)
const replySubmitting = ref(false)
const replyForm = reactive({ replyContent: '', remark: '' })

function openReply(row: ContactMessage): void {
  current.value = row
  replyForm.replyContent = row.replyContent
  replyForm.remark = row.remark
  replyOpen.value = true
}

async function submitReply(): Promise<void> {
  if (!current.value) return
  if (!replyForm.replyContent.trim()) {
    message.warning('请填写回复内容')
    return
  }

  replySubmitting.value = true
  try {
    await messageApi.reply(current.value.id, replyForm.replyContent.trim(), replyForm.remark)
    message.success('回复成功')
    replyOpen.value = false
    await refreshCurrent()
  } catch {
    /* 已提示（例如「该留言已处理，不能再回复」） */
  } finally {
    replySubmitting.value = false
  }
}

/* ---------------- 标记已处理 ---------------- */

async function handleOne(row: ContactMessage): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '标记为已处理？',
      content: '标记后这条留言将不能再次回复，如需修改可用「重新打开」。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
  if (!confirmed) return

  try {
    await messageApi.handle(row.id)
    message.success('已标记为已处理')
    await refreshCurrent()
  } catch {
    /* 已提示 */
  }
}

/* ---------------- 重新打开 ---------------- */

async function reopen(row: ContactMessage): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '重新打开这条留言？',
      content: '会清空已有的回复内容与处理记录，状态回到「待处理」。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
  if (!confirmed) return

  try {
    await messageApi.reopen(row.id)
    message.success('已重新打开为待处理')
    await refreshCurrent()
  } catch {
    /* 已提示 */
  }
}

/* ---------------- 备注 ---------------- */

const remarkOpen = ref(false)
const remarkSubmitting = ref(false)
const remarkForm = reactive({ remark: '' })

function openRemark(row: ContactMessage): void {
  current.value = row
  remarkForm.remark = row.remark
  remarkOpen.value = true
}

async function submitRemark(): Promise<void> {
  if (!current.value) return

  remarkSubmitting.value = true
  try {
    await messageApi.updateRemark(current.value.id, remarkForm.remark)
    message.success('备注已保存')
    remarkOpen.value = false
    await refreshCurrent()
  } catch {
    /* 已提示 */
  } finally {
    remarkSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadSubjects(), load()])
})
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-radio-group
          :value="activeStatus"
          button-style="solid"
          @change="(event: { target: { value: number | undefined } }) => switchStatus(event.target.value)"
        >
          <a-radio-button v-for="item in statusTabs" :key="String(item.value)" :value="item.value">
            {{ item.label }}
          </a-radio-button>
        </a-radio-group>

        <a-input
          v-model:value="keyword"
          placeholder="搜索姓名 / 邮箱 / 电话 / 内容"
          allow-clear
          style="width: 260px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <a-select
          v-model:value="filters.subject"
          placeholder="全部主题"
          allow-clear
          style="width: 140px"
          :options="subjectOptions.map((item) => ({ value: item, label: item }))"
          @change="search"
        />

        <a-range-picker v-model:value="dateRange" @change="onDateChange" />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="resetAll">重置</a-button>

        <div class="spacer" />

        <a-button
          v-perm="'message:delete'"
          danger
          :disabled="selectedKeys.length === 0"
          @click="batchRemove"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除
        </a-button>
      </div>

      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        :message="`当前页分布：待处理 ${counts[0] ?? 0} 条 · 已回复 ${counts[1] ?? 0} 条 · 已处理 ${counts[2] ?? 0} 条`"
      />

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1300 }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys: (string | number)[]) => (selectedKeys = keys as number[])
        }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="cell-main">{{ dash(record.name) }}</div>
            <div class="cell-sub">{{ dash(record.email) }}</div>
            <div class="cell-sub">{{ dash(record.phone) }}</div>
          </template>

          <template v-else-if="column.key === 'subject'">
            <a-tag>{{ dash(record.subject) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'message'">
            <a-typography-paragraph
              :content="record.message"
              :ellipsis="{ rows: 2, tooltip: record.message }"
              style="margin-bottom: 0; max-width: 420px"
            />
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="messageStatusColor(record.status)">
              {{ messageStatusText(record.status) }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'flow'">
            <div v-if="record.replyAt" class="cell-sub">
              回复：{{ record.replyUsername }} · {{ formatDateTime(record.replyAt) }}
            </div>
            <div v-if="record.handledAt" class="cell-sub">
              处理：{{ record.handleUsername }} · {{ formatDateTime(record.handledAt) }}
            </div>
            <div v-if="!record.replyAt && !record.handledAt" class="cell-sub">尚未流转</div>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space wrap>
              <a @click="openDetail(record)">详情</a>
              <a
                v-if="record.status !== 2"
                v-perm="'message:reply'"
                @click="openReply(record)"
              >
                {{ record.status === 1 ? '改回复' : '回复' }}
              </a>
              <a
                v-if="record.status !== 2"
                v-perm="'message:handle'"
                @click="handleOne(record)"
              >
                标已处理
              </a>
              <a v-if="record.status === 2" v-perm="'message:handle'" @click="reopen(record)">
                重新打开
              </a>
              <a-typography-link
                v-perm="'message:delete'"
                type="danger"
                @click="removeRow(record, `来自「${record.name}」的留言`)"
              >
                删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无留言" />
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="留言详情" :width="640">
      <template v-if="current">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="状态">
            <a-tag :color="messageStatusColor(current.status)">
              {{ messageStatusText(current.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="留言人">
            {{ dash(current.name) }}
          </a-descriptions-item>
          <a-descriptions-item label="邮箱">{{ dash(current.email) }}</a-descriptions-item>
          <a-descriptions-item label="电话">{{ dash(current.phone) }}</a-descriptions-item>
          <a-descriptions-item label="主题">{{ dash(current.subject) }}</a-descriptions-item>
          <a-descriptions-item label="留言时间">
            {{ formatDateTime(current.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item label="留言内容">
            <div style="white-space: pre-wrap">{{ current.message }}</div>
          </a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left" style="font-size: 13px">流转记录</a-divider>

        <a-list size="small" :data-source="[
          current.replyAt
            ? { label: '回复', who: current.replyUsername, at: current.replyAt, text: current.replyContent }
            : null,
          current.handledAt
            ? { label: '标记已处理', who: current.handleUsername, at: current.handledAt, text: '' }
            : null
        ].filter(Boolean)">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <a-tag :color="item.label === '回复' ? 'blue' : 'green'">{{ item.label }}</a-tag>
                  <span style="color: #666; font-size: 12px">
                    {{ item.who }} · {{ formatDateTime(item.at) }}
                  </span>
                </template>
                <template #description>
                  <div v-if="item.text" style="white-space: pre-wrap">{{ item.text }}</div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>

        <div v-if="current.remark" style="margin-top: 8px">
          <a-alert type="warning" show-icon :message="`内部备注：${current.remark}`" />
        </div>

        <a-divider />

        <a-space wrap>
          <a-button
            v-if="current.status !== 2"
            v-perm="'message:reply'"
            type="primary"
            @click="openReply(current)"
          >
            {{ current.status === 1 ? '修改回复' : '回复' }}
          </a-button>
          <a-button v-if="current.status !== 2" v-perm="'message:handle'" @click="handleOne(current)">
            标记已处理
          </a-button>
          <a-button v-if="current.status === 2" v-perm="'message:handle'" danger @click="reopen(current)">
            重新打开
          </a-button>
          <a-button v-perm="'message:reply'" @click="openRemark(current)">编辑备注</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 回复 -->
    <a-modal
      v-model:open="replyOpen"
      title="回复留言"
      :width="600"
      :confirm-loading="replySubmitting"
      ok-text="提交回复"
      cancel-text="取消"
      @ok="submitReply"
    >
      <template v-if="current">
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 16px"
          :message="`${current.name}：${current.message}`"
        />

        <a-form layout="vertical">
          <a-form-item label="回复内容" required>
            <a-textarea
              v-model:value="replyForm.replyContent"
              :rows="5"
              :maxlength="2000"
              show-count
              placeholder="回复内容会展示给留言人"
            />
          </a-form-item>
          <a-form-item label="内部备注" extra="仅后台可见，不会对外展示">
            <a-textarea v-model:value="replyForm.remark" :rows="2" :maxlength="500" show-count />
          </a-form-item>
        </a-form>
      </template>
    </a-modal>

    <!-- 备注 -->
    <a-modal
      v-model:open="remarkOpen"
      title="编辑内部备注"
      :width="520"
      :confirm-loading="remarkSubmitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitRemark"
    >
      <a-form layout="vertical">
        <a-form-item label="内部备注" extra="只改备注，不影响留言状态">
          <a-textarea v-model:value="remarkForm.remark" :rows="4" :maxlength="500" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
