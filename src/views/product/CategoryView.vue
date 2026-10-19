<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { categoryApi } from '@/api/product'
import { useCrud } from '@/composables/useCrud'
import { dash, formatDateTime } from '@/utils/format'
import type { ProductCategory } from '@/types'

/* ==========================================================================
   产品分类
   分类被商品引用时不允许删除（后端 + 数据库外键双重拦截），
   列表里直接显示引用数量，避免用户点了才被拒绝。
   ========================================================================== */

const {
  loading,
  list,
  keyword,
  filters,
  selectedKeys,
  load,
  search,
  reset,
  removeRow,
  batchRemove,
  moveRow
} = useCrud<ProductCategory>(categoryApi, {
  defaultPageSize: 100,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: '排序', key: 'sort', width: 130 },
  { title: '分类名称', key: 'name' },
  { title: '商品数量', key: 'productCount', width: 110 },
  { title: '状态', key: 'status', width: 90 },
  { title: '更新时间', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const }
]

const modalOpen = ref(false)
const modalTitle = ref('新增分类')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({ name: '', sort: 0, status: 1 })

const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { max: 50, message: '最多 50 个字符', trigger: 'blur' }
  ]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增分类'
  form.name = ''
  form.sort = list.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
  form.status = 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: ProductCategory): void {
  editingId.value = row.id
  modalTitle.value = '编辑分类'
  form.name = row.name
  form.sort = row.sort
  form.status = row.status
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
    const payload = { ...form }
    if (editingId.value) {
      await categoryApi.update(editingId.value, payload)
      message.success('保存成功')
    } else {
      await categoryApi.create(payload)
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

async function handleRemove(row: ProductCategory): Promise<void> {
  if ((row.productCount ?? 0) > 0) {
    message.warning(`「${row.name}」下还有 ${row.productCount} 件商品，请先移出或删除这些商品`)
    return
  }
  await removeRow(row, `分类「${row.name}」`)
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索分类名称"
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
          style="width: 120px"
          :options="[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' }
          ]"
          @change="search"
        />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="reset">重置</a-button>

        <div class="spacer" />

        <a-button v-perm="'category:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增分类
        </a-button>
        <a-button
          v-perm="'category:delete'"
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
        :pagination="false"
        :scroll="{ x: 900 }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys: (string | number)[]) => (selectedKeys = keys as number[])
        }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'sort'">
            <a-space :size="2">
              <a-button
                v-perm="'category:update'"
                type="text"
                size="small"
                :disabled="index === 0"
                @click="moveRow(index, -1)"
              >
                <ArrowUpOutlined />
              </a-button>
              <a-button
                v-perm="'category:update'"
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

          <template v-else-if="column.key === 'name'">
            <div class="cell-main">{{ dash(record.name) }}</div>
          </template>

          <template v-else-if="column.key === 'productCount'">
            <a-tag :color="(record.productCount ?? 0) > 0 ? 'blue' : 'default'">
              {{ record.productCount ?? 0 }} 件
            </a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'category:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link v-perm="'category:delete'" type="danger" @click="handleRemove(record)">
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无分类" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="460"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="分类名称" name="name">
          <a-input v-model:value="form.name" placeholder="例如：电子产品" :maxlength="50" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="排序" name="sort">
              <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-radio-group v-model:value="form.status">
                <a-radio :value="1">启用</a-radio>
                <a-radio :value="0">停用</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>
