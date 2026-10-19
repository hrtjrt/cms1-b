<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  DownOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  UserOutlined,
  KeyOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import { roleText, roleColor } from '@/utils/format'

/* ==========================================================================
   顶栏
   左侧折叠按钮，右侧：刷新当前页、全屏、用户下拉（改密码 / 退出）
   面包屑放在内容区上方（见 BasicLayout），这里保持清爽。
   ========================================================================== */

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ (event: 'update:collapsed', value: boolean): void }>()

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const fullscreen = ref(false)
const passwordOpen = ref(false)

const title = computed(() => (route.meta.title as string | undefined) ?? '')
const roleLabel = computed(() => roleText(store.role))
const roleTagColor = computed(() => roleColor(store.role))

function toggleCollapse(): void {
  emit('update:collapsed', !props.collapsed)
}

/** 重新拉一次当前页面：交给路由做一次 replace 触发组件重载 */
function reloadPage(): void {
  window.location.reload()
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
    fullscreen.value = false
  } else {
    void document.documentElement.requestFullscreen()
    fullscreen.value = true
  }
}

async function handleLogout(): Promise<void> {
  Modal.confirm({
    title: '确定退出登录吗？',
    okText: '退出',
    cancelText: '取消',
    onOk: async () => {
      await store.doLogout()
      message.success('已退出登录')
      void router.replace({ name: 'login' })
    }
  })
}

function handleMenuClick({ key }: { key: string | number }): void {
  if (key === 'password') passwordOpen.value = true
  if (key === 'logout') void handleLogout()
}
</script>

<template>
  <div class="layout-header">
    <a-button type="text" @click="toggleCollapse">
      <MenuUnfoldOutlined v-if="collapsed" />
      <MenuFoldOutlined v-else />
    </a-button>

    <span class="header-title">{{ title }}</span>

    <div class="spacer" />

    <a-tooltip title="刷新页面">
      <a-button type="text" @click="reloadPage"><ReloadOutlined /></a-button>
    </a-tooltip>

    <a-tooltip title="全屏">
      <a-button type="text" @click="toggleFullscreen">
        <FullscreenExitOutlined v-if="fullscreen" />
        <FullscreenOutlined v-else />
      </a-button>
    </a-tooltip>

    <a-dropdown placement="bottomRight">
      <div class="header-user">
        <a-avatar :src="store.avatar || undefined" :size="30">
          <template #icon><UserOutlined /></template>
        </a-avatar>
        <span class="header-username">{{ store.displayName }}</span>
        <a-tag :color="roleTagColor" class="header-role">{{ roleLabel }}</a-tag>
        <DownOutlined class="header-caret" />
      </div>

      <template #overlay>
        <a-menu @click="handleMenuClick">
          <a-menu-item key="password">
            <KeyOutlined />
            <span style="margin-left: 8px">修改密码</span>
          </a-menu-item>
          <a-menu-divider />
          <a-menu-item key="logout">
            <LogoutOutlined />
            <span style="margin-left: 8px">退出登录</span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <ChangePasswordModal v-model:open="passwordOpen" />
  </div>
</template>

<style scoped>
.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a2a3a;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.header-user:hover {
  background: #f5f7fa;
}

.header-username {
  font-size: 13px;
  color: #333;
}

.header-role {
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
}

.header-caret {
  font-size: 11px;
  color: #999;
}
</style>
