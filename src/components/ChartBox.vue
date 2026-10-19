<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

/* ==========================================================================
   ECharts 容器
   只干三件事：初始化、跟随 option 更新、跟随容器尺寸 resize。
   图表配置由调用方（各页面）自己写，这里不掺业务。
   ========================================================================== */

const props = withDefaults(defineProps<{ option: echarts.EChartsOption; height?: number }>(), {
  height: 300
})

const rootRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null

function render(): void {
  if (!chart) return
  // notMerge=true：切换筛选条件时避免上一次的 series 残留
  chart.setOption(props.option, true)
}

onMounted(() => {
  if (!rootRef.value) return

  chart = echarts.init(rootRef.value)
  render()

  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(rootRef.value)
})

watch(
  () => props.option,
  () => render(),
  { deep: true }
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="rootRef" :style="{ height: `${props.height}px`, width: '100%' }" />
</template>
