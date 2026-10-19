<script setup lang="ts">
import { RouterView } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

/* ==========================================================================
   根组件
   只做两件事：注册中文语言包 + 覆盖主题色（与前台 --c-primary 保持一致）
   ========================================================================== */

dayjs.locale('zh-cn')

/** 主题令牌：主色与前台设计令牌 --c-primary 一致 */
const theme = {
  token: {
    colorPrimary: '#0a17da',
    colorInfo: '#0a17da',
    borderRadius: 6,
    fontSize: 14
  }
}
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <RouterView />
  </a-config-provider>
</template>
