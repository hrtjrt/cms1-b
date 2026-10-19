<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { valueApi } from '@/api/about'
import { useCrud } from '@/composables/useCrud'
import { dash } from '@/utils/format'
import type { ValueItem } from '@/types'

/* ==========================================================================
   核心价值观
   icon 字段存 emoji（前台直接渲染），所以用普通输入框而不是图标选择器。
   ========================================================================== */

const { loading, list, load, removeRow, moveRow } = useCrud<ValueItem>(valueApi, {
  defaultPageSize: 100,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: '排序', key: 'sort', width: 130 },
  { title: '图标', key: 'icon', width: 90 },
  { title: '标题', key: 'title', width: 180 },
  { title: '描述', key: 'description' },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const }
]

const modalOpen = ref(false)
const modalTitle = ref('新增价值观')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({ icon: '', title: '', description: '', sort: 0 })

const rules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { max: 50, message: '最多 50 个字符', trigger: 'blur' }
  ],
  description: [{ max: 255, message: '最多 255 个字符', trigger: 'blur' }]
}

const emojiOptions = ['🎯', '💡', '🤝', '🏆', '🚀', '🌱', '❤️', '🔒', '⚙️', '🌍']

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增价值观'
  form.icon = '🎯'
  form.title = ''
  form.description = ''
  form.sort = list.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: ValueItem): void {
  editingId.value = row.id
  modalTitle.value = '编辑价值观'
  form.icon = row.icon
  form.title = row.title
  form.description = row.description
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
      await valueApi.update(editingId.value, { ...form })
      message.success('保存成功')
    } else {
      await valueApi.create({ ...form })
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
    <a-card class="page-card" :bordered="false" title="核心价值观">
      <template #extra>
        <a-button v-perm="'about:update'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增价值观
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

          <template v-else-if="column.key === 'icon'">
            <span style="font-size: 22px">{{ dash(record.icon) }}</span>
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="cell-main">{{ dash(record.title) }}</div>
          </template>

          <template v-else-if="column.key === 'description'">
            <div class="cell-wrap">{{ dash(record.description) }}</div>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'about:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link
                v-perm="'about:update'"
                type="danger"
                @click="removeRow(record, `价值观「${record.title}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无价值观" />
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
        <a-form-item label="图标" name="icon" extra="前台直接渲染该字符，可用 emoji">
          <a-input v-model:value="form.icon" :maxlength="8" placeholder="🎯" style="width: 120px" />
          <div style="margin-top: 8px">
            <a-space wrap>
              <a-tag
                v-for="emoji in emojiOptions"
                :key="emoji"
                style="cursor: pointer; font-size: 16px"
                @click="form.icon = emoji"
              >
                {{ emoji }}
              </a-tag>
            </a-space>
          </div>
        </a-form-item>
        <a-form-item label="标题" name="title">
          <a-input v-model:value="form.title" placeholder="例如：客户至上" :maxlength="50" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" :rows="3" :maxlength="255" show-count />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
