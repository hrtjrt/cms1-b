<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import { configApi } from '@/api/site'
import { formatDateTime } from '@/utils/format'

/* ==========================================================================
   站点配置（单例）
   logo 与页脚文案会被前台全站使用；地图如果留空，前台的联系我们页不渲染地图区域。
   ========================================================================== */

const loading = ref(false)
const submitting = ref(false)
const updatedAt = ref('')
const formRef = ref<FormInstance>()

const form = reactive({
  siteName: '',
  companyName: '',
  footerText: '',
  logoUrl: '',
  mapEmbedUrl: ''
})

const rules = {
  siteName: [{ required: true, message: '请输入站点名称', trigger: 'blur' }],
  footerText: [{ max: 255, message: '最多 255 个字符', trigger: 'blur' }],
  logoUrl: [{ required: true, message: '请填写或上传 LOGO', trigger: 'change' }],
  mapEmbedUrl: [{ max: 1000, message: '最多 1000 个字符', trigger: 'blur' }]
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await configApi.get()
    form.siteName = data.siteName
    form.companyName = data.companyName
    form.footerText = data.footerText
    form.logoUrl = data.logoUrl
    form.mapEmbedUrl = data.mapEmbedUrl
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
    await configApi.update({ ...form, logoUrl: form.logoUrl.trim() })
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
    <a-card class="page-card" :bordered="false" title="站点配置">
      <template #extra>
        <span style="font-size: 12px; color: #999">最后更新：{{ formatDateTime(updatedAt) }}</span>
      </template>

      <a-spin :spinning="loading">
        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" :style="{ maxWidth: '720px' }">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="站点名称" name="siteName" extra="用于浏览器标题后缀">
                <a-input v-model:value="form.siteName" :maxlength="100" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="公司名称" name="companyName">
                <a-input v-model:value="form.companyName" :maxlength="100" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="页脚版权文案" name="footerText">
            <a-input v-model:value="form.footerText" :maxlength="255" placeholder="© 2026 公司名称. All rights reserved." />
          </a-form-item>

          <a-form-item label="站点 LOGO" name="logoUrl" extra="前台每个页面顶部左上角都会用到">
            <ImageUpload v-model="form.logoUrl" :height="90" />
          </a-form-item>

          <a-form-item
            label="地图嵌入地址"
            name="mapEmbedUrl"
            extra="留空则前台「联系我们」页不显示地图；填完整 iframe 的 src 地址即可"
          >
            <a-textarea v-model:value="form.mapEmbedUrl" :rows="3" placeholder="https://..." />
          </a-form-item>

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
