<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Result } from 'ant-design-vue'

/* ==========================================================================
   404 / 403 兜底页
   路由守卫拒绝访问时会带 ?denied=1，这里区分「页面不存在」与「没有权限」
   ========================================================================== */

const route = useRoute()
const router = useRouter()

const denied = computed(() => route.query.denied === '1')
</script>

<template>
  <div class="login-page" style="background: #f0f2f5">
    <a-card :bordered="false" style="border-radius: 12px">
      <a-result
        :status="denied ? '403' : '404'"
        :title="denied ? '403' : '404'"
        :sub-title="denied ? '当前账号没有访问该页面的权限，请联系超级管理员' : '页面不存在或已被移除'"
      >
        <template #extra>
          <a-button type="primary" @click="router.replace('/dashboard')">回到仪表盘</a-button>
        </template>
      </a-result>
    </a-card>
  </div>
</template>
