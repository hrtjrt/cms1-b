<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import { honorApi } from '@/api/about'
import { useCrud } from '@/composables/useCrud'
import { assetUrl } from '@/utils/request'
import { dash } from '@/utils/format'
import type { HonorItem } from '@/types'

/* ==========================================================================
   荣誉资质
   ========================================================================== */

const { loading, list, load, removeRow, moveRow } = useCrud<HonorItem>(honorApi, {
  defaultPageSize: 100,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: '排序', key: 'sort', width: 130 },
  { title: '证书图', key: 'image', width: 140 },
  { title: '名称', key: 'name' },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const }
]

const modalOpen = ref(false)
const modalTitle = ref('新增荣誉')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({ name: '', image: '', sort: 0 })

const rules = {
  name: [
    { required: true, message: '请输入荣誉名称', trigger: 'blur' },
    { max: 100, message: '最多 100 个字符', trigger: 'blur' }
  ],
  image: [{ required: true, message: '请填写或上传证书图', trigger: 'change' }]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增荣誉'
  form.name = ''
  form.image = ''
  form.sort = list.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: HonorItem): void {
  editingId.value = row.id
  modalTitle.value = '编辑荣誉'
  form.name = row.name
  form.image = row.image
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
      await honorApi.update(editingId.value, payload)
      message.success('保存成功')
    } else {
      await honorApi.create(payload)
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
    <a-card class="page-card" :bordered="false" title="荣誉资质">
      <template #extra>
        <a-button v-perm="'about:update'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增荣誉
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

          <template v-else-if="column.key === 'image'">
            <img class="cell-thumb" :src="assetUrl(record.image)" alt="证书" />
          </template>

          <template v-else-if="column.key === 'name'">
            <div class="cell-main">{{ dash(record.name) }}</div>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'about:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link
                v-perm="'about:update'"
                type="danger"
                @click="removeRow(record, `荣誉「${record.name}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无荣誉" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="560"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="荣誉名称" name="name">
          <a-input v-model:value="form.name" placeholder="例如：国家高新技术企业" :maxlength="100" />
        </a-form-item>
        <a-form-item label="证书图" name="image">
          <ImageUpload v-model="form.image" :height="150" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
