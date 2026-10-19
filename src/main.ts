import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import App from './App.vue'
import router from './router'
import { permissionDirective } from './directives/permission'
import { useUserStore } from './stores/user'
import './styles/global.css'

/* ==========================================================================
   入口
   ant-design-vue 采用「全量注册」而不是按需引入：
   后台管理只有 18 个页面、构建体积不是瓶颈，全量注册省掉
   unplugin-vue-components 等构建期魔法，改组件时不会有「忘了引」的坑。
   ========================================================================== */

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Antd)

// v-perm="'news:create'"   —— 无权限时移除元素
app.directive('perm', permissionDirective)

// $perm('product:update')  —— 模板里做布尔判断（保留元素但置灰）
app.config.globalProperties.$perm = (code?: string): boolean => useUserStore().has(code)

app.mount('#app')
