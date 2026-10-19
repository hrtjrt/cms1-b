<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import RichEditor from '@/components/RichEditor.vue'
import { newsApi } from '@/api/news'
import { useCrud } from '@/composables/useCrud'
import { assetUrl } from '@/utils/request'
import { dash, formatDate } from '@/utils/format'
import { resolveHtmlAssets } from '@/utils/html'
import type { NewsItem } from '@/types'

/* ==========================================================================
   新闻管理
   content 是详情页正文（HTML），用自研的轻量富文本编辑器，
   入库前由后端做白名单清洗，前台详情页直接渲染。
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
} = useCrud<NewsItem>(newsApi, {
  defaultPageSize: 10,
  defaultSortBy: 'date',
  defaultSortOrder: 'desc'
})

/** 日期区间：antd 的 range picker 给的是 [dayjs, dayjs] */
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | undefined>(undefined)

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

const columns = [
  { title: '封面', key: 'image', width: 110 },
  { title: '标题', key: 'title' },
  { title: '发布日期', dataIndex: 'date', key: 'date', width: 120, sorter: true },
  { title: '置顶', key: 'isTop', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, sorter: true },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const }
]

/* ---------------- 弹窗表单 ---------------- */

const modalOpen = ref(false)
const modalTitle = ref('新增新闻')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({
  title: '',
  date: dayjs().format('YYYY-MM-DD'),
  summary: '',
  content: '',
  image: '',
  isTop: 0,
  status: 1,
  sort: 0
})

const rules = {
  title: [
    { required: true, message: '请输入新闻标题', trigger: 'blur' },
    { max: 200, message: '最多 200 个字符', trigger: 'blur' }
  ],
  date: [{ required: true, message: '请选择发布日期', trigger: 'change' }],
  summary: [{ max: 500, message: '最多 500 个字符', trigger: 'blur' }],
  image: [{ required: true, message: '请填写或上传封面图', trigger: 'change' }]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增新闻'
  form.title = ''
  form.date = dayjs().format('YYYY-MM-DD')
  form.summary = ''
  form.content = ''
  form.image = ''
  form.isTop = 0
  form.status = 1
  form.sort = 0
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: NewsItem): void {
  editingId.value = row.id
  modalTitle.value = '编辑新闻'
  form.title = row.title
  form.date = row.date
  form.summary = row.summary
  form.content = row.content
  form.image = row.image
  form.isTop = row.isTop
  form.status = row.status
  form.sort = row.sort
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = { ...form, image: form.image.trim() }
    if (editingId.value) {
      await newsApi.update(editingId.value, payload)
      message.success('保存成功')
    } else {
      await newsApi.create(payload)
      message.success('新增成功')
    }
    modalOpen.value = false
    await load()
  } catch {
    /* 已提示 */
  } finally {
    submitting.value = false
  }
}

/* ---------------- 正文预览 ---------------- */

const previewOpen = ref(false)
const previewRow = ref<NewsItem | null>(null)

/** 预览用的 HTML：补全资源地址；没有正文时给一句提示，避免弹窗一片空白 */
const previewHtml = computed(() => {
  const raw = previewRow.value?.content ?? ''
  if (!raw.trim()) {
    return '<p style="color:#999">（本条新闻没有正文，前台详情页会做兜底展示）</p>'
  }
  return resolveHtmlAssets(raw)
})

function openPreview(row: NewsItem): void {
  previewRow.value = row
  previewOpen.value = true
}

function insertTemplate(): void {
  if (form.content.trim()) {
    message.info('已有正文内容，未覆盖')
    return
  }
  form.content = [
    `<p>${form.summary || '这里写导语…'}</p>`,
    '<h3>详细情况</h3>',
    '<p>这里写正文…</p>',
    '<h3>后续安排</h3>',
    '<p>这里写后续计划…</p>'
  ].join('\n')
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索标题或摘要"
          allow-clear
          style="width: 220px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allow-clear
          style="width: 110px"
          :options="[
            { value: 1, label: '已发布' },
            { value: 0, label: '草稿' }
          ]"
          @change="search"
        />

        <a-select
          v-model:value="filters.isTop"
          placeholder="置顶"
          allow-clear
          style="width: 110px"
          :options="[
            { value: 1, label: '置顶' },
            { value: 0, label: '普通' }
          ]"
          @change="search"
        />

        <a-range-picker v-model:value="dateRange" @change="onDateChange" />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="resetAll">重置</a-button>

        <div class="spacer" />

        <a-button v-perm="'news:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增新闻
        </a-button>
        <a-button
          v-perm="'news:delete'"
          danger
          :disabled="selectedKeys.length === 0"
          @click="batchRemove"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除
        </a-button>
      </div>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1100 }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys: (string | number)[]) => (selectedKeys = keys as number[])
        }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'image'">
            <img class="cell-thumb" :src="assetUrl(record.image)" alt="封面" />
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="cell-main">{{ dash(record.title) }}</div>
            <div class="cell-sub cell-wrap">{{ dash(record.summary).slice(0, 40) }}</div>
          </template>

          <template v-else-if="column.key === 'date'">
            {{ formatDate(record.date) }}
          </template>

          <template v-else-if="column.key === 'isTop'">
            <a-tag v-if="record.isTop === 1" color="gold">置顶</a-tag>
            <span v-else style="color: #bbb">—</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '已发布' : '草稿' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openPreview(record)"><EyeOutlined /> 正文</a>
              <a v-perm="'news:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link
                v-perm="'news:delete'"
                type="danger"
                @click="removeRow(record, `新闻「${record.title}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无新闻" />
        </template>
      </a-table>
    </a-card>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="860"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      :body-style="{ maxHeight: '68vh', overflowY: 'auto' }"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="16">
            <a-form-item label="新闻标题" name="title">
              <a-input v-model:value="form.title" placeholder="请输入新闻标题" :maxlength="200" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="发布日期" name="date">
              <a-date-picker
                v-model:value="form.date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="列表摘要" name="summary" extra="显示在新闻列表页，最多 500 字">
          <a-textarea
            v-model:value="form.summary"
            :rows="3"
            :maxlength="500"
            show-count
            placeholder="一句话概括这条新闻"
          />
        </a-form-item>

        <a-form-item label="封面图" name="image">
          <ImageUpload v-model="form.image" :height="140" />
        </a-form-item>

        <a-form-item label="详情页正文">
          <template #extra>
            <span>入库前会做白名单清洗（只保留排版标签，脚本 / 事件属性会被剥掉）</span>
            <a-divider type="vertical" />
            <a @click="insertTemplate">插入正文模板</a>
          </template>
          <RichEditor v-model="form.content" placeholder="请输入新闻正文…" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="置顶" name="isTop">
              <a-radio-group v-model:value="form.isTop">
                <a-radio :value="1">置顶</a-radio>
                <a-radio :value="0">普通</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态" name="status">
              <a-radio-group v-model:value="form.status">
                <a-radio :value="1">已发布</a-radio>
                <a-radio :value="0">草稿</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="排序" name="sort">
              <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 正文预览 -->
    <a-modal v-model:open="previewOpen" title="正文预览" :width="760" :footer="null">
      <template v-if="previewRow">
        <a-descriptions :column="2" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item label="标题" :span="2">{{ previewRow.title }}</a-descriptions-item>
          <a-descriptions-item label="发布日期">{{ previewRow.date }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            {{ previewRow.status === 1 ? '已发布' : '草稿' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="rich-preview" v-html="previewHtml" />
      </template>
    </a-modal>
  </div>
</template>
