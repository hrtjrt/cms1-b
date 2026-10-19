<template>
  <a-menu
    v-model:openKeys="openKeys"
    :selected-keys="selectedKeys"
    theme="dark"
    mode="inline"
  >
    <template v-for="node in menus" :key="node.key">
      <!-- 分组 -->
      <a-sub-menu v-if="node.children && node.children.length > 0" :key="node.key">
        <template #icon>
          <component :is="resolveIcon(node.icon)" v-if="resolveIcon(node.icon)" />
        </template>
        <template #title>{{ node.title }}</template>

        <a-menu-item v-for="child in node.children" :key="child.path" @click="open(child.path)">
          <template #icon>
            <component :is="resolveIcon(child.icon)" v-if="resolveIcon(child.icon)" />
          </template>
          <span>{{ child.title }}</span>
        </a-menu-item>
      </a-sub-menu>


      
      <!-- 单项 -->
      <a-menu-item v-else :key="node.path" @click="open(node.path)">
        <template #icon>
          <component :is="resolveIcon(node.icon)" v-if="resolveIcon(node.icon)" />
        </template>
        <span>{{ node.title }}</span>
      </a-menu-item>
    </template>
  </a-menu>
</template>










<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveIcon } from '@/utils/icons'
import type { MenuNode } from '@/types'

/* ==========================================================================
   侧边栏菜单
   菜单数据完全由后端下发（/api/auth/menus），这里只负责渲染：
     · 分组节点（有 children）→ a-sub-menu
     · 叶子节点 → a-menu-item，key 就是路由 path
   图标是字符串名，通过 resolveIcon 解析成 antd 图标组件。
   ========================================================================== */

const props = defineProps<{
  menus: MenuNode[]
  collapsed: boolean
}>()

const route = useRoute()
const router = useRouter()

/** 当前高亮项 = 当前路由 path */
const selectedKeys = computed<string[]>(() => [route.path])

/** 展开的分组：默认展开当前路由所在分组 */
const openKeys = ref<string[]>([])

function parentKeysOf(path: string): string[] {
  const keys: string[] = []
  for (const node of props.menus) {
    if ((node.children ?? []).some((child) => child.path === path)) keys.push(node.key)
  }
  return keys
}

watch(
  () => route.path,
  (path) => {
    const parents = parentKeysOf(path)
    if (parents.length > 0 && !props.collapsed) {
      openKeys.value = Array.from(new Set([...openKeys.value, ...parents]))
    }
  },
  { immediate: true }
)

// 折叠时不保留展开态，展开后恢复当前分组
watch(
  () => props.collapsed,
  (value) => {
    openKeys.value = value ? [] : parentKeysOf(route.path)
  }
)

function open(path: string): void {
  if (path && path !== route.path) void router.push(path)
}
</script>