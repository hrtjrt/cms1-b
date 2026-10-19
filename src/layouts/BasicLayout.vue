<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { CloseOutlined } from '@ant-design/icons-vue'
import SiderMenu from '@/components/SiderMenu.vue'
import HeaderBar from '@/components/HeaderBar.vue'
import { useUserStore } from '@/stores/user'

/* ==========================================================================
   后台主布局
     左侧：可折叠侧边栏（菜单来自后端）
     顶栏：折叠按钮 + 刷新/全屏 + 用户下拉
     标签页：记录打开过的页面，可点击切换、可关闭
     内容：RouterView + 面包屑
   ========================================================================== */

const store = useUserStore()
const route = useRoute()
const router = useRouter()

const collapsed = ref(false)

interface OpenedTab {
  path: string
  title: string
}

const tabs = ref<OpenedTab[]>([])

/** 面包屑：仪表盘下的页面显示「分组 / 页面」 */
const breadcrumb = computed<string[]>(() => {
  const title = (route.meta.title as string | undefined) ?? ''
  if (!title || route.path === '/dashboard') return [title || '仪表盘']
  return ['首页', title]
})

/** 从后端菜单树里找某个 path 对应的标题，用于标签页命名 */
function titleOf(path: string): string {
  for (const node of store.menus) {
    if (node.path === path) return node.title
    for (const child of node.children ?? []) {
      if (child.path === path) return child.title
    }
  }
  return (route.meta.title as string | undefined) ?? path
}

watch(
  () => route.path,
  (path) => {
    if (path === '/login' || route.name === 'notFound') return
    if (tabs.value.some((tab) => tab.path === path)) return
    tabs.value.push({ path, title: titleOf(path) })
  },
  { immediate: true }
)

function gotoTab(path: string): void {
  if (path !== route.path) void router.push(path)
}

function closeTab(path: string): void {
  const index = tabs.value.findIndex((tab) => tab.path === path)
  if (index === -1) return

  tabs.value.splice(index, 1)

  if (path === route.path) {
    const next = tabs.value[index] ?? tabs.value[index - 1]
    void router.push(next ? next.path : '/dashboard')
  }
}
</script>

<template>
  <a-layout class="layout-root">
    <a-layout-sider
      v-model:collapsed="collapsed"
      :width="220"
      :collapsed-width="64"
      collapsible
      :trigger="null"
      class="layout-sider"
    >
      <div class="layout-logo">
        <img src="/favicon.ico" alt="logo" />
        <span v-if="!collapsed">CMS 管理后台</span>
      </div>
      <SiderMenu :menus="store.menus" :collapsed="collapsed" />
    </a-layout-sider>

    <a-layout>
      <HeaderBar v-model:collapsed="collapsed" />

      <div class="layout-tabs">
        <span
          v-for="tab in tabs"
          :key="tab.path"
          class="layout-tab"
          :class="{ active: tab.path === route.path }"
          @click="gotoTab(tab.path)"
        >
          {{ tab.title }}
          <CloseOutlined
            v-if="tabs.length > 1"
            class="close"
            @click.stop="closeTab(tab.path)"
          />
        </span>
      </div>

      <a-layout-content class="layout-content">
        <div class="breadcrumb-bar">
          <a-breadcrumb>
            <a-breadcrumb-item v-for="(item, index) in breadcrumb" :key="index">
              {{ item }}
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
