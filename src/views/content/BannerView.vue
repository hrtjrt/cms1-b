<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import { bannerApi } from '@/api/banner'
import { useCrud } from '@/composables/useCrud'
import { assetUrl } from '@/utils/request'
import { dash, formatDateTime } from '@/utils/format'
import type { Banner } from '@/types'

/* ==========================================================================
   轮播图管理
   sort 决定首页轮播顺序，用「上移 / 下移」按钮调，比让用户手填数字直观。
   一次拉 100 条（本项目只有 3 条），这样上下移动可以直接提交完整顺序。
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
} = useCrud<Banner>(bannerApi, {
  defaultPageSize: 100,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: '排序', key: 'sort', width: 130 },
  { title: '轮播图', key: 'image', width: 140 },
  { title: '轮播文案', key: 'title' },
  { title: '跳转地址', key: 'link', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '更新时间', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const }
]

/* ---------------- 弹窗表单 ---------------- */

const modalOpen = ref(false)
const modalTitle = ref('新增轮播图')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({
  title: '',
  image: '',
  link: '',
  sort: 0,
  status: 1
})

const rules = {
  title: [
    { required: true, message: '请输入轮播文案', trigger: 'blur' },
    { max: 120, message: '最多 120 个字符', trigger: 'blur' }
  ],
  image: [{ required: true, message: '请填写或上传轮播图', trigger: 'change' }],
  link: [{ max: 200, message: '最多 200 个字符', trigger: 'blur' }]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增轮播图'
  form.title = ''
  form.image = ''
  form.link = ''
  form.sort = list.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
  form.status = 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: Banner): void {
  editingId.value = row.id
  modalTitle.value = '编辑轮播图'
  form.title = row.title
  form.image = row.image
  form.link = row.link
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
    const payload = { ...form, image: form.image.trim() }
    if (editingId.value) {
      await bannerApi.update(editingId.value, payload)
      message.success('保存成功')
    } else {
      await bannerApi.create(payload)
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
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索轮播文案"
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

        <a-button v-perm="'banner:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增轮播图
        </a-button>
        <a-button
          v-perm="'banner:delete'"
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
        :scroll="{ x: 1000 }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys: (string | number)[]) => (selectedKeys = keys as number[])
        }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'sort'">
            <a-space :size="2">
              <a-button
                v-perm="'banner:update'"
                type="text"
                size="small"
                :disabled="index === 0"
                @click="moveRow(index, -1)"
              >
                <ArrowUpOutlined />
              </a-button>
              <a-button
                v-perm="'banner:update'"
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
            <img class="cell-thumb" :src="assetUrl(record.image)" alt="轮播图" />
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="cell-main">{{ dash(record.title) }}</div>
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
              <a v-perm="'banner:update'" @click="openEdit(record)">
                <EditOutlined /> 编辑
              </a>
              <a-typography-link
                v-perm="'banner:delete'"
                type="danger"
                @click="removeRow(record, `轮播图「${record.title}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无轮播图" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="600"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="轮播文案" name="title">
          <a-input v-model:value="form.title" placeholder="例如：欢迎来到我们的公司" :maxlength="120" />
        </a-form-item>

        <a-form-item label="轮播图" name="image">
          <ImageUpload v-model="form.image" />
        </a-form-item>

        <a-form-item
          label="跳转地址"
          name="link"
          extra="前台路由路径，例如 /about、/products；留空则点击不跳转"
        >
          <a-input v-model:value="form.link" placeholder="/about" :maxlength="200" />
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
