<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import RichEditor from '@/components/RichEditor.vue'
import { categoryApi, productApi } from '@/api/product'
import { useCrud } from '@/composables/useCrud'
import { assetUrl } from '@/utils/request'
import { dash, formatPrice } from '@/utils/format'
import { resolveHtmlAssets } from '@/utils/html'
import type { CategoryOption, Product } from '@/types'

/* ==========================================================================
   商品列表

   展示层级（两级，强约束）：
     showInProductCenter = 1            → 出现在产品中心
     showOnHomepage       = 1（含左侧）  → 出现在首页产品位

   两条路径的语义不一样，前端要分开处理：
     · 列表页快捷开关 → PATCH /:id/flags（部分更新）
         只关掉产品中心时，后端会把首页产品位一起关掉，并返回提示语
     · 编辑弹窗整体保存 → PUT /:id
         两个复选框做联动，避免提交「上首页却不上产品中心」的矛盾状态
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
} = useCrud<Product>(productApi, {
  defaultPageSize: 10,
  defaultSortBy: 'sort',
  defaultSortOrder: 'asc'
})

const categoryOptions = ref<CategoryOption[]>([])

/** 正在切换层级的行 id，用于行内 switch 的 loading */
const togglingIds = ref<number[]>([])

const columns = [
  { title: '图片', key: 'image', width: 100 },
  { title: '商品', key: 'name' },
  { title: '价格', dataIndex: 'price', key: 'price', width: 130, sorter: true },
  { title: '上产品中心', key: 'showInProductCenter', width: 120 },
  { title: '上首页产品位', key: 'showOnHomepage', width: 130 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, sorter: true },
  { title: '首页排序', key: 'homeSort', width: 90 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const }
]

async function loadCategories(): Promise<void> {
  try {
    categoryOptions.value = await categoryApi.options()
  } catch {
    categoryOptions.value = []
  }
}

/* ---------------- 列表页快捷开关 ---------------- */

function isToggling(id: number): boolean {
  return togglingIds.value.includes(id)
}

/** 统一提示：后端说「一并取消」时用警告色，其余用成功提示 */
function notify(notice?: string): void {
  if (!notice) return
  if (notice.includes('一并取消')) message.warning(notice)
  else message.success(notice)
}

async function toggleCenter(row: Product, value: boolean): Promise<void> {
  if (isToggling(row.id)) return
  togglingIds.value = [...togglingIds.value, row.id]
  try {
    const result = await productApi.updateFlags(row.id, { showInProductCenter: value ? 1 : 0 })
    notify(result.notice)
  } catch {
    /* 已提示 */
  } finally {
    togglingIds.value = togglingIds.value.filter((id) => id !== row.id)
    // 无论成功失败都重新拉一次：成功时要看到「首页产品位被连带取消」，
    // 失败时要把开关拨回原状
    await load()
  }
}

async function toggleHomepage(row: Product, value: boolean): Promise<void> {
  if (isToggling(row.id)) return
  togglingIds.value = [...togglingIds.value, row.id]
  try {
    // 未上产品中心时后端会直接 400，这里提前拦一下，提示更友好
    if (value && row.showInProductCenter !== 1) {
      message.warning('商品必须先上产品中心，才能上首页产品位')
      return
    }
    const result = await productApi.updateFlags(row.id, { showOnHomepage: value ? 1 : 0 })
    notify(result.notice)
  } catch {
    /* 已提示 */
  } finally {
    togglingIds.value = togglingIds.value.filter((id) => id !== row.id)
    await load()
  }
}

/* ---------------- 弹窗表单 ---------------- */

const modalOpen = ref(false)
const modalTitle = ref('新增商品')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  price: 0,
  description: '',
  image: '',
  detail: '',
  status: 1,
  showInProductCenter: 1,
  showOnHomepage: 0,
  sort: 0,
  homeSort: 0
})

const rules = {
  name: [
    { required: true, message: '请输入商品名', trigger: 'blur' },
    { max: 120, message: '最多 120 个字符', trigger: 'blur' }
  ],
  categoryId: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  description: [{ max: 255, message: '最多 255 个字符', trigger: 'blur' }],
  image: [{ required: true, message: '请填写或上传商品图', trigger: 'change' }]
}

/** 复选框联动：取消「上产品中心」时，首页产品位自动取消且不可再勾 */
function onCenterChange(): void {
  if (form.showInProductCenter !== 1) form.showOnHomepage = 0
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增商品'
  form.name = ''
  form.categoryId = categoryOptions.value[0]?.id
  form.price = 0
  form.description = ''
  form.image = ''
  form.detail = ''
  form.status = 1
  form.showInProductCenter = 1
  form.showOnHomepage = 0
  form.sort = 0
  form.homeSort = 0
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: Product): void {
  editingId.value = row.id
  modalTitle.value = '编辑商品'
  form.name = row.name
  form.categoryId = row.categoryId
  form.price = Number(row.price)
  form.description = row.description
  form.image = row.image
  form.detail = row.detail
  form.status = row.status
  form.showInProductCenter = row.showInProductCenter
  form.showOnHomepage = row.showOnHomepage
  form.sort = row.sort
  form.homeSort = row.homeSort
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  // 前端先一步拦住矛盾状态，省一次无效请求（后端同样会 400）
  if (form.showOnHomepage === 1 && form.showInProductCenter !== 1) {
    message.warning('商品必须先上产品中心，才能上首页产品位')
    form.showOnHomepage = 0
    return
  }

  submitting.value = true
  try {
    const payload = { ...form, image: form.image.trim() }
    if (editingId.value) {
      await productApi.update(editingId.value, payload)
      message.success('保存成功')
    } else {
      await productApi.create(payload)
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

/* ---------------- 详情预览 ---------------- */

const previewOpen = ref(false)
const previewRow = ref<Product | null>(null)

const previewHtml = computed(() => {
  const raw = previewRow.value?.detail ?? ''
  if (!raw.trim()) return '<p style="color:#999">（该商品没有详情，前台详情页会做兜底展示）</p>'
  return resolveHtmlAssets(raw)
})

function openPreview(row: Product): void {
  previewRow.value = row
  previewOpen.value = true
}

function resetAll(): void {
  reset()
}

onMounted(async () => {
  await Promise.all([loadCategories(), load()])
})
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索商品名或卖点"
          allow-clear
          style="width: 220px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <a-select
          v-model:value="filters.categoryId"
          placeholder="全部分类"
          allow-clear
          style="width: 140px"
          :options="categoryOptions.map((item) => ({ value: item.id, label: item.name }))"
          @change="search"
        />

        <a-select
          v-model:value="filters.showInProductCenter"
          placeholder="产品中心"
          allow-clear
          style="width: 130px"
          :options="[
            { value: 1, label: '已上产品中心' },
            { value: 0, label: '未上产品中心' }
          ]"
          @change="search"
        />

        <a-select
          v-model:value="filters.showOnHomepage"
          placeholder="首页产品位"
          allow-clear
          style="width: 140px"
          :options="[
            { value: 1, label: '在首页产品位' },
            { value: 0, label: '不在首页' }
          ]"
          @change="search"
        />

        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allow-clear
          style="width: 110px"
          :options="[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' }
          ]"
          @change="search"
        />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="resetAll">重置</a-button>

        <div class="spacer" />

        <a-button v-perm="'product:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增商品
        </a-button>
        <a-button
          v-perm="'product:delete'"
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
        :scroll="{ x: 1400 }"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys: (string | number)[]) => (selectedKeys = keys as number[])
        }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'image'">
            <img class="cell-thumb" :src="assetUrl(record.image)" alt="商品图" />
          </template>

          <template v-else-if="column.key === 'name'">
            <div class="cell-main">{{ dash(record.name) }}</div>
            <div class="cell-sub">
              {{ dash(record.category) }}
              <span v-if="record.description"> · {{ record.description }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'price'">
            {{ formatPrice(record.price) }}
          </template>

          <template v-else-if="column.key === 'showInProductCenter'">
            <a-switch
              :checked="record.showInProductCenter === 1"
              :loading="isToggling(record.id)"
              :disabled="!$perm('product:update')"
              checked-children="上架"
              un-checked-children="下架"
              @change="(value: boolean) => toggleCenter(record, value)"
            />
          </template>

          <template v-else-if="column.key === 'showOnHomepage'">
            <a-switch
              :checked="record.showOnHomepage === 1"
              :loading="isToggling(record.id)"
              :disabled="!$perm('product:update')"
              checked-children="在首页"
              un-checked-children="不在"
              @change="(value: boolean) => toggleHomepage(record, value)"
            />
          </template>

          <template v-else-if="column.key === 'homeSort'">
            <span v-if="record.showOnHomepage === 1">{{ record.homeSort }}</span>
            <span v-else style="color: #bbb">—</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openPreview(record)"><EyeOutlined /> 详情</a>
              <a v-perm="'product:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a-typography-link
                v-perm="'product:delete'"
                type="danger"
                @click="removeRow(record, `商品「${record.name}」`)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无商品" />
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
          <a-col :span="14">
            <a-form-item label="商品名" name="name">
              <a-input v-model:value="form.name" placeholder="例如：智能平板电脑" :maxlength="120" />
            </a-form-item>
          </a-col>
          <a-col :span="10">
            <a-form-item label="所属分类" name="categoryId">
              <a-select
                v-model:value="form.categoryId"
                placeholder="请选择分类"
                :options="categoryOptions.map((item) => ({ value: item.id, label: item.name }))"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="价格（元）" name="price">
              <a-input-number
                v-model:value="form.price"
                :min="0"
                :max="99999999"
                :precision="2"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="一句话卖点" name="description" extra="显示在首页产品位与列表副标题">
              <a-input v-model:value="form.description" :maxlength="255" placeholder="例如：高性能 · 低功耗 · 全球认证" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="商品图" name="image">
          <ImageUpload v-model="form.image" :height="140" />
        </a-form-item>

        <a-form-item label="商品详情">
          <template #extra>入库前会做白名单清洗，过滤脚本与事件属性</template>
          <RichEditor v-model="form.detail" placeholder="请输入商品详情…" />
        </a-form-item>

        <a-divider orientation="left" style="font-size: 13px">展示层级</a-divider>

        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 16px"
          message="上首页产品位必须先上产品中心"
          description="取消「上产品中心」后，「上首页产品位」会自动取消。"
        />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="上产品中心" name="showInProductCenter">
              <a-switch
                :checked="form.showInProductCenter === 1"
                checked-children="上架"
                un-checked-children="下架"
                @change="(value: boolean) => { form.showInProductCenter = value ? 1 : 0; onCenterChange() }"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="上首页产品位" name="showOnHomepage">
              <a-switch
                :checked="form.showOnHomepage === 1"
                :disabled="form.showInProductCenter !== 1"
                checked-children="展示"
                un-checked-children="不展示"
                @change="(value: boolean) => (form.showOnHomepage = value ? 1 : 0)"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="产品中心排序" name="sort">
              <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="首页排序" name="homeSort">
              <a-input-number
                v-model:value="form.homeSort"
                :min="0"
                :max="99999"
                :disabled="form.showOnHomepage !== 1"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
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

    <!-- 详情预览 -->
    <a-modal v-model:open="previewOpen" title="商品详情预览" :width="760" :footer="null">
      <template v-if="previewRow">
        <a-descriptions :column="2" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item label="商品名" :span="2">{{ previewRow.name }}</a-descriptions-item>
          <a-descriptions-item label="分类">{{ previewRow.category }}</a-descriptions-item>
          <a-descriptions-item label="价格">{{ formatPrice(previewRow.price) }}</a-descriptions-item>
          <a-descriptions-item label="产品中心">
            {{ previewRow.showInProductCenter === 1 ? '已上架' : '未上架' }}
          </a-descriptions-item>
          <a-descriptions-item label="首页产品位">
            {{ previewRow.showOnHomepage === 1 ? `在首页（第 ${previewRow.homeSort} 位）` : '不在首页' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="rich-preview" v-html="previewHtml" />
      </template>
    </a-modal>
  </div>
</template>
