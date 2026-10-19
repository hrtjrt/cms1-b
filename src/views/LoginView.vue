<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

/* ==========================================================================
   登录页
   演示账号直接写在页面上（本地演示项目，方便验收；正式部署请删掉这段）
   ========================================================================== */

const store = useUserStore()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: 'admin',
  password: '123456'
})

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const demoAccounts = [
  { username: 'admin', role: '超级管理员（全部权限）' },
  { username: 'editor', role: '内容编辑（无系统管理）' },
  { username: 'viewer', role: '只读访客（只有查看）' }
]

function fill(username: string): void {
  form.username = username
  form.password = '123456'
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await store.doLogin(form.username.trim(), form.password)
    message.success(`欢迎回来，${store.displayName}`)

    const redirect = route.query.redirect
    const target = typeof redirect === 'string' && redirect ? redirect : '/dashboard'
    await router.replace(target)
  } catch {
    /* 错误提示已由 request 层给出 */
  } finally {
    loading.value = false
  }
}
</script>







<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <h1>公司官网 CMS 管理后台</h1>
        <p>内容 · 商品 · 留言 · 站点配置</p>
      </div>

      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        style="padding: 12px 20px 0"
        @finish="submit"
      >
        <a-form-item label="账号" name="username">
          <a-input v-model:value="form.username" size="large" placeholder="请输入账号">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="密码" name="password">
          <a-input-password
            v-model:value="form.password"
            size="large"
            placeholder="请输入密码"
            @press-enter="submit"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item>
          <a-button type="primary" size="large" block :loading="loading" html-type="submit">
            登录
          </a-button>
        </a-form-item>
      </a-form>

      <div style="padding: 0 20px 20px">
        <div class="login-hint">
          <div><strong>演示账号</strong>（密码统一 <code>123456</code>，点击可自动填入）</div>
          <div v-for="item in demoAccounts" :key="item.username">
            <a @click="fill(item.username)">{{ item.username }}</a>
            <span style="margin-left: 6px">— {{ item.role }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
