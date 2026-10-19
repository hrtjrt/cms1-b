<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import RichEditor from '@/components/RichEditor.vue'
import { introApi } from '@/api/about'
import { assetUrl } from '@/utils/request'
import { formatDateTime } from '@/utils/format'
import { resolveHtmlAssets } from '@/utils/html'

/* ==========================================================================
   公司简介（单例）
   前台「关于我们」页左栏的正文 + 配图。
   ========================================================================== */

const loading = ref(false)
const submitting = ref(false)
const updatedAt = ref('')

const form = reactive({
  content: '',
  image: ''
})

/** 段落数统计：让编辑者对正文规模有个概念 */
const paragraphCount = ref(0)

/** 预览用的 HTML（补全相对资源地址） */
const previewHtml = computed(() => {
  if (!form.content.trim()) return '<p style="color:#999">（暂无内容）</p>'
  return resolveHtmlAssets(form.content)
})

function countParagraphs(): void {
  const text = form.content.trim()
  paragraphCount.value = text ? text.split(/<\/p>|<br\s*\/?>/i).filter((item) => item.trim()).length : 0
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await introApi.get()
    form.content = data.content
    form.image = data.image
    updatedAt.value = data.updatedAt
    countParagraphs()
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  submitting.value = true
  try {
    await introApi.update({ content: form.content, image: form.image.trim() })
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
    <a-card class="page-card" :bordered="false" title="公司简介">
      <template #extra>
        <span style="font-size: 12px; color: #999">
          最后更新：{{ formatDateTime(updatedAt) }}
        </span>
      </template>

      <a-spin :spinning="loading">
        <a-form layout="vertical">
          <a-form-item
            label="简介正文"
            extra="显示在「关于我们」页；入库前会做白名单清洗（过滤脚本与事件属性）"
          >
            <RichEditor v-model="form.content" :min-height="260" placeholder="请输入公司简介…" />
          </a-form-item>

          <a-form-item label="配图" extra="显示在简介右侧">
            <ImageUpload v-model="form.image" :height="160" />
          </a-form-item>

          <a-form-item>
            <a-space>
              <a-button v-perm="'about:update'" type="primary" :loading="submitting" @click="submit">
                保存
              </a-button>
              <a-button @click="load">重置</a-button>
              <span style="color: #999; font-size: 12px">约 {{ paragraphCount }} 段</span>
            </a-space>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-card>

    <a-card class="page-card" :bordered="false" title="前台效果预览">
      <div style="display: flex; gap: 24px; flex-wrap: wrap">
        <div style="flex: 1; min-width: 320px">
          <div class="rich-preview" v-html="previewHtml" />
        </div>
        <div v-if="form.image" style="width: 280px">
          <img
            :src="assetUrl(form.image)"
            alt="简介配图"
            style="width: 100%; border-radius: 8px; border: 1px solid #eee"
          />
        </div>
      </div>
    </a-card>
  </div>
</template>
