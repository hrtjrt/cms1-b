<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsOption } from 'echarts'
import {
  ArrowRightOutlined,
  BellOutlined,
  FileTextOutlined,
  PictureOutlined,
  ShoppingOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined
} from '@ant-design/icons-vue'
import ChartBox from '@/components/ChartBox.vue'
import { fetchDashboard } from '@/api/dashboard'
import { useUserStore } from '@/stores/user'
import type { DashboardData } from '@/types'

/* ==========================================================================
   仪表盘
   10 张统计卡（业务上真正关心的口径）+ 4 张图
   统计卡里的「上产品中心 / 首页产品位 / 已回复留言」是 v2 新增的口径，
   直接对应问题三的展示层级与留言三态。
   ========================================================================== */

const router = useRouter()
const store = useUserStore()

const loading = ref(false)
const data = ref<DashboardData | null>(null)

const stats = computed(() => data.value?.stats)
const charts = computed(() => data.value?.charts)

/** 统计卡定义：label / 取值 / 图标 / 点击去哪个页面 */
const cards = computed(() => {
  const s = stats.value
  return [
    { key: 'news', label: '已发布新闻', value: s?.newsTotal ?? 0, icon: FileTextOutlined, to: '/content/news' },
    { key: 'newsDraft', label: '新闻总数（含草稿）', value: s?.newsDraftTotal ?? 0, icon: FileTextOutlined, to: '/content/news' },
    { key: 'product', label: '商品总数', value: s?.productTotal ?? 0, icon: ShoppingOutlined, to: '/product/list' },
    { key: 'productCenter', label: '上产品中心', value: s?.productOnlineTotal ?? 0, icon: ShoppingOutlined, to: '/product/list' },
    { key: 'homepage', label: '首页产品位', value: s?.homepageTotal ?? 0, icon: StarOutlined, to: '/product/homepage' },
    { key: 'messagePending', label: '待处理留言', value: s?.messagePending ?? 0, icon: BellOutlined, to: '/message/list' },
    { key: 'messageReplied', label: '已回复留言', value: s?.messageReplied ?? 0, icon: BellOutlined, to: '/message/list' },
    { key: 'banner', label: '启用中轮播图', value: s?.bannerTotal ?? 0, icon: PictureOutlined, to: '/content/banner' },
    { key: 'honor', label: '荣誉资质', value: s?.honorTotal ?? 0, icon: TrophyOutlined, to: '/about/honor' },
    { key: 'user', label: '管理员', value: s?.userTotal ?? 0, icon: TeamOutlined, to: '/system/user' }
  ]
})

/* ---------------- 图表配置 ---------------- */

const PALETTE = ['#0a17da', '#2f7ef7', '#13c2c2', '#fa8c16', '#722ed1', '#eb2f96', '#52c41a']

/** 商品分类分布（环形） */
const categoryOption = computed<EChartsOption>(() => ({
  color: PALETTE,
  tooltip: { trigger: 'item', formatter: '{b}: {c} 件（{d}%）' },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
  series: [
    {
      type: 'pie',
      radius: ['42%', '66%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{c}' },
      data: (charts.value?.categoryPie ?? []).map((item) => ({ name: item.name, value: item.value }))
    }
  ]
}))

/** 近 7 天留言趋势 */
const trendOption = computed<EChartsOption>(() => {
  const list = charts.value?.messageTrend ?? []
  return {
    color: ['#0a17da'],
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: list.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: '#e5e9f0' } },
      axisLabel: { color: '#8c8c8c' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#8c8c8c' }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: { opacity: 0.12 },
        data: list.map((item) => item.value)
      }
    ]
  }
})

/** 近 6 个月新闻发布量 */
const monthlyOption = computed<EChartsOption>(() => {
  const list = charts.value?.newsMonthly ?? []
  return {
    color: ['#2f7ef7'],
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: list.map((item) => item.month),
      axisLine: { lineStyle: { color: '#e5e9f0' } },
      axisLabel: { color: '#8c8c8c' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#8c8c8c' }
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: list.map((item) => item.value)
      }
    ]
  }
})

/** 留言处理状态（环形，固定三段） */
const statusOption = computed<EChartsOption>(() => {
  const list = charts.value?.messageStatus ?? []
  const colorMap: Record<string, string> = {
    待处理: '#fa8c16',
    已回复: '#2f7ef7',
    已处理: '#52c41a'
  }

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 条（{d}%）' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    series: [
      {
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '44%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{c}' },
        data: list.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: colorMap[item.name] ?? '#bfbfbf' }
        }))
      }
    ]
  }
})

/* ---------------- 加载 ---------------- */

async function load(): Promise<void> {
  loading.value = true
  try {
    data.value = await fetchDashboard()
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div style="display: flex; align-items: center; gap: 12px">
        <div>
          <div style="font-size: 16px; font-weight: 600; color: #1a2a3a">
            你好，{{ store.displayName }}
          </div>
          <div style="font-size: 13px; color: #8c8c8c; margin-top: 4px">
            当前角色：{{ store.role === 'super_admin' ? '超级管理员' : store.role === 'editor' ? '内容编辑' : '只读访客' }}
            · 共 {{ store.codes.length }} 项权限
          </div>
        </div>
        <div style="flex: 1" />
        <a-button :loading="loading" @click="load">刷新数据</a-button>
      </div>
    </a-card>

    <a-card class="page-card" :bordered="false" title="数据概览">
      <a-spin :spinning="loading">
        <div class="stat-grid">
          <a-card
            v-for="card in cards"
            :key="card.key"
            class="stat-card"
            size="small"
            hoverable
            :bordered="true"
            @click="router.push(card.to)"
          >
            <div style="display: flex; align-items: center; gap: 12px">
              <component :is="card.icon" class="stat-icon" />
              <div>
                <div class="stat-value">{{ card.value }}</div>
                <div class="stat-label">{{ card.label }}</div>
              </div>
              <div style="flex: 1" />
              <ArrowRightOutlined style="color: #ccc" />
            </div>
          </a-card>
        </div>
      </a-spin>
    </a-card>

    <a-card class="page-card" :bordered="false" title="数据分析">
      <a-spin :spinning="loading">
        <div class="chart-grid">
          <a-card size="small" title="商品分类分布">
            <ChartBox :option="categoryOption" :height="300" />
          </a-card>
          <a-card size="small" title="留言处理状态">
            <ChartBox :option="statusOption" :height="300" />
          </a-card>
          <a-card size="small" title="近 7 天留言趋势">
            <ChartBox :option="trendOption" :height="300" />
          </a-card>
          <a-card size="small" title="近 6 个月新闻发布量">
            <ChartBox :option="monthlyOption" :height="300" />
          </a-card>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>
