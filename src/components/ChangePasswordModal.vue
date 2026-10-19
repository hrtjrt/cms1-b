<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { changeMyPassword } from '@/api/auth'
import { useUserStore } from '@/stores/user'

/* ==========================================================================
   修改密码（当前登录人）
   需要填原密码，由后端校验。
   ========================================================================== */

const open = defineModel<boolean>('open', { default: false })

const store = useUserStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 50, message: '密码长度 6 ~ 50 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: async (_rule: unknown, value: string) => {
        if (value !== form.newPassword) throw new Error('两次输入的密码不一致')
        return true
      },
      trigger: 'blur'
    }
  ]
}

watch(open, (value) => {
  if (value) {
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    void formRef.value?.clearValidate()
  }
})

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await changeMyPassword(form.oldPassword, form.newPassword)
    message.success('密码已修改，请重新登录')
    open.value = false
    // 密码变更后旧 token 仍有效，但按惯例要求重新登录更安全
    await store.doLogout()
    window.location.hash = '#/login'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:open="open"
    title="修改密码"
    :width="440"
    :confirm-loading="submitting"
    ok-text="保存"
    cancel-text="取消"
    @ok="submit"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="原密码" name="oldPassword">
        <a-input-password v-model:value="form.oldPassword" placeholder="请输入原密码" />
      </a-form-item>
      <a-form-item label="新密码" name="newPassword">
        <a-input-password v-model:value="form.newPassword" placeholder="6 ~ 50 个字符" />
      </a-form-item>
      <a-form-item label="确认新密码" name="confirmPassword">
        <a-input-password v-model:value="form.confirmPassword" placeholder="再次输入新密码" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
