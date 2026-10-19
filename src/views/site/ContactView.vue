<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { contactApi } from '@/api/site'
import { formatDateTime } from '@/utils/format'

/* ==========================================================================
   联系方式（单例）
   前台「联系我们」页左栏与「新闻动态」页侧栏都用这份数据，
   所以同一份内容在两处展示必须一致 —— 后台只维护一处。
   ========================================================================== */

const loading = ref(false)
const submitting = ref(false)
const updatedAt = ref('')
const formRef = ref<FormInstance>()

const form = reactive({
  address: '',
  addressShort: '',
  phoneMain: '',
  phones: '',
  email: '',
  hours: ''
})

const rules = {
  address: [{ max: 255, message: '最多 255 个字符', trigger: 'blur' }],
  addressShort: [{ max: 100, message: '最多 100 个字符', trigger: 'blur' }],
  phoneMain: [{ max: 50, message: '最多 50 个字符', trigger: 'blur' }],
  phones: [{ max: 100, message: '最多 100 个字符', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  hours: [{ max: 100, message: '最多 100 个字符', trigger: 'blur' }]
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await contactApi.get()
    form.address = data.address
    form.addressShort = data.addressShort
    form.phoneMain = data.phoneMain
    form.phones = data.phones
    form.email = data.email
    form.hours = data.hours
    updatedAt.value = data.updatedAt
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await contactApi.update({ ...form })
    message.success('保存成功')
    await load()
  } catch {
    /* 已提示 */
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false" title="联系方式">
      <template #extra>
        <span style="font-size: 12px; color: #999">最后更新：{{ formatDateTime(updatedAt) }}</span>
      </template>

      <a-spin :spinning="loading">
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 16px; max-width: 720px"
          message="这份数据同时用于前台「联系我们」页与「新闻动态」页侧栏"
        />

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" :style="{ maxWidth: '720px' }">
          <a-form-item label="完整地址" name="address" extra="联系我们页展示的完整地址">
            <a-input v-model:value="form.address" :maxlength="255" placeholder="上海市浦东新区xx路xx号xx大厦 20 楼" />
          </a-form-item>

          <a-form-item label="简称地址" name="addressShort" extra="新闻动态页侧栏展示，建议只写到区">
            <a-input v-model:value="form.addressShort" :maxlength="100" placeholder="上海市浦东新区" />
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="主客服电话" name="phoneMain">
                <a-input v-model:value="form.phoneMain" :maxlength="50" placeholder="400-888-8888" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="电话（多行展示）" name="phones">
                <a-input v-model:value="form.phones" :maxlength="100" placeholder="400-888-8888 / 021-1234-5678" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="邮箱" name="email">
                <a-input v-model:value="form.email" :maxlength="120" placeholder="contact@company.com" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="工作时间" name="hours">
                <a-input v-model:value="form.hours" :maxlength="100" placeholder="周一至周五 9:00 - 18:00" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item>
            <a-space>
              <a-button v-perm="'site:update'" type="primary" :loading="submitting" @click="submit">
                保存
              </a-button>
              <a-button @click="load">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-card>
  </div>
</template>
