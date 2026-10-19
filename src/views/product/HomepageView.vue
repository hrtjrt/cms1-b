<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, StarFilled } from '@ant-design/icons-vue'
import { productApi } from '@/api/product'
import { useCrud } from '@/composables/useCrud'
import { assetUrl } from '@/utils/request'
import { dash, formatPrice } from '@/utils/format'
import type { Product } from '@/types'

/* ==========================================================================
   首页产品位

   自 v2 起首页产品位不再是独立模块，而是 product 表上的一个开关
   （show_on_homepage = 1），所以这个页面本质是「商品列表的一个固定筛选视图」，
   只是额外提供 home_sort 的上移 / 下移。

   数据来源与商品列表完全一致 —— 同一个接口、同一份数据，
   不会出现「首页展示的商品在商品管理里找不到」这种两套数据的问题。
   ========================================================================== */

const { loading, list, load, removeRow } = useCrud<Product>(productApi, {
  defaultPageSize: 100,
  defaultSortBy: 'homeSort',
  defaultSortOrder: 'asc',
  // 固定只看「已上首页产品位」的商品
  baseParams: () => ({ showOnHomepage: 1 })
})

/** 正在重新排序，避免连点造成顺序错乱 */
const moving = ref(false)

const columns = [
  { title: '序号', key: 'index', width: 80 },
  { title: '调整顺序', key: 'sort', width: 170 },
  { title: '图片', key: 'image', width: 100 },
  { title: '商品', key: 'name' },
  { title: '价格', key: 'price', width: 130 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const }
]

/** 上移 / 下移：把当前顺序整体提交给后端，后端按数组下标重排 home_sort */
async function move(index: number, delta: number): Promise<void> {
  if (moving.value) return
  const target = index + delta
  if (target < 0 || target >= list.value.length) return

  const current = list.value[index]
  const swap = list.value[target]
  if (!current || !swap) return

  // 本地先交换，界面立即有反馈
  list.value[index] = swap
  list.value[target] = current

  moving.value = true
  try {
    await productApi.sort(list.value.map((item) => item.id), 'home')
    message.success('首页顺序已更新')
  } catch {
    /* 已提示 */
  } finally {
    moving.value = false
    await load()
  }
}

/** 移出首页产品位（走 PATCH /flags 的部分更新语义） */
async function removeFromHomepage(row: Product): Promise<void> {
  try {
    const result = await productApi.updateFlags(row.id, { showOnHomepage: 0 })
    message.success(result.notice ?? `「${row.name}」已移出首页产品位`)
    await load()
  } catch {
    /* 已提示 */
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <a-alert type="info" show-icon style="margin-bottom: 16px">
        <template #message>
          <span>
            首页产品位来自商品数据的 <code>show_on_homepage = 1</code>，
            与商品列表是同一份数据，不会出现两套内容不一致的情况。
          </span>
        </template>
        <template #description>
          <span>
            想往首页加商品，去「商品列表」把目标商品的「上首页产品位」开关打开即可（需先上产品中心）；
            这里的上下移动只调整首页展示顺序。
          </span>
        </template>
      </a-alert>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">
            <a-space :size="4">
              <StarFilled v-if="index < 1" style="color: #f0c040" />
              <span>{{ index + 1 }}</span>
            </a-space>
          </template>

          <template v-else-if="column.key === 'sort'">
            <a-space :size="2">
              <a-button
                v-perm="'product:update'"
                type="text"
                size="small"
                :disabled="index === 0 || moving"
                @click="move(index, -1)"
              >
                <ArrowUpOutlined />
              </a-button>
              <a-button
                v-perm="'product:update'"
                type="text"
                size="small"
                :disabled="index === list.length - 1 || moving"
                @click="move(index, 1)"
              >
                <ArrowDownOutlined />
              </a-button>
              <span style="color: #999; font-size: 12px">home_sort={{ record.homeSort }}</span>
            </a-space>
          </template>

          <template v-else-if="column.key === 'image'">
            <img class="cell-thumb" :src="assetUrl(record.image)" alt="商品图" />
          </template>

          <template v-else-if="column.key === 'name'">
            <div class="cell-main">{{ dash(record.name) }}</div>
            <div class="cell-sub">{{ dash(record.category) }} · {{ dash(record.description) }}</div>
          </template>

          <template v-else-if="column.key === 'price'">
            {{ formatPrice(record.price) }}
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-typography-link v-perm="'product:update'" @click="removeFromHomepage(record)">
                移出首页
              </a-typography-link>
              <a-typography-link
                v-perm="'product:delete'"
                type="danger"
                @click="removeRow(record, `商品「${record.name}」`)"
              >
                删除商品
              </a-typography-link>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="首页产品位还没有商品，去「商品列表」打开上首页开关">
            <a-button type="primary" href="#/product/list">去商品列表</a-button>
          </a-empty>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
