<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { historyApi } from '@/api/about'
import { useCrud } from '@/composables/useCrud'
import { dash } from '@/utils/format'
import type { TimelineItem } from '@/types'

/* ==========================================================================
   发展历程
   条目很少（6 条），直接全量返回、不分页，排序用上下移动。
   ========================================================================== */

const { loading, list, load, removeRow, moveRow } = useCrud<TimelineItem>(historyApi, {
  defaultPageSize: 100,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: '排序', key: 'sort', width: 130 },
  { title: '年份', key: 'year', width: 140 },
  { title: '事件描述', key: 'content' },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const }
]

const modalOpen = ref(false)
const modalTitle = ref('新增历程')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({ year: '', content: '', sort: 0 })

const rules = {
  year: [
    { required: true, message: '请输入年份', trigger: 'blur' },
    { max: 20, message: '最多 20 个字符', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入事件描述', trigger: 'blur' },
    { max: 500, message: '最多 500 个字符', trigger: 'blur' }
  ]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增历程'
  form.year = ''
  form.content = ''
  form.sort = list.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: TimelineItem): void {
  editingId.value = row.id
  modalTitle.value = '编辑历程'
  form.year = row.year
  form.content = row.content
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
    if (editingId.value) {
      await historyApi.update(editingId.value, { ...form })
      message.success('保存成功')
    } else {
      await historyApi.create({ ...form })
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

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false" title="发展历程">
      <template #extra>
        <a-button v-perm="'about:update'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增历程
        </a-button>
      </template>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 800 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'sort'">
            <a-space :size="2">
              <a-button
                v-perm="'about:update'"
                type="text"
                size="small"
                :disabled="index === 0"
                @click="moveRow(index, -1)"
              >
                <ArrowUpOutlined />
              </a-button>
              <a-button
                v-perm="'about:update'"
                type="text"
                size="small"
                :disabled="index === list.length - 1"
                @click="moveRow(index, 1)"
              >
                <ArrowDownOutlined />
              </a-button>
              <span style="color: #999; font-size: 12px">{{ record.sort }}</span>
            </a-space>
          </template>

          <template v-else-if="column.key === 'year'">
            <a-tag color="blue">{{ dash(record.year) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'content'">
            <div class="cell-wrap">{{ dash(record.content) }}</div>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'about:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link
                v-perm="'about:update'"
                type="danger"
                @click="removeRow(record, `历程「${record.year}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无历程" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="520"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="年份" name="year">
          <a-input v-model:value="form.year" placeholder="例如：2026" :maxlength="20" />
        </a-form-item>
        <a-form-item label="事件描述" name="content">
          <a-textarea v-model:value="form.content" :rows="3" :maxlength="500" show-count placeholder="这一年发生了什么" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
