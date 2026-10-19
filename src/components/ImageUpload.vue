<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { uploadImage } from '@/api/upload'
import { assetUrl } from '@/utils/request'

/* ==========================================================================
   图片字段
   两种录入方式并存：
     · 直接粘贴图片地址（种子数据、外部 CDN 都走这条）
     · 上传本地图片（后端存到 uploads/，库里只留相对地址）
   下面给一个缩略图，改完地址能立刻看出对不对。
   ========================================================================== */

const modelValue = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{ placeholder?: string; height?: number }>(), {
  placeholder: '图片地址，例如 /uploads/seed/product-1.svg',
  height: 120
})

const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/** 预览地址：相对地址补成完整地址 */
const previewUrl = computed(() => assetUrl(modelValue.value ?? ''))
const broken = ref(false)

function pick(): void {
  if (uploading.value) return
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploading.value = true
  broken.value = false
  try {
    const result = await uploadImage(file)
    // 库里只存相对地址，换域名不用改数据
    modelValue.value = result.url
    message.success('上传成功')
  } catch {
    /* 错误提示已由 request 层给出 */
  } finally {
    uploading.value = false
  }
}

function clear(): void {
  modelValue.value = ''
  broken.value = false
}
</script>

<template>
  <div class="image-field">
    <a-input-group compact style="display: flex; gap: 8px">
      <a-input
        v-model:value="modelValue"
        :placeholder="props.placeholder"
        allow-clear
        style="flex: 1"
        @change="broken = false"
      />
      <a-button :loading="uploading" @click="pick">
        <template #icon><UploadOutlined /></template>
        上传
      </a-button>
      <a-button v-if="modelValue" @click="clear">
        <template #icon><DeleteOutlined /></template>
      </a-button>
    </a-input-group>

    <div v-if="modelValue" class="image-preview" :style="{ height: `${props.height}px` }">
      <img v-if="!broken" :src="previewUrl" alt="预览" @error="broken = true" />
      <span v-else class="image-broken">图片无法加载：{{ modelValue }}</span>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      style="display: none"
      @change="onFileChange"
    />
  </div>
</template>

<style scoped>
.image-field {
  width: 100%;
}

.image-preview {
  margin-top: 8px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-broken {
  font-size: 12px;
  color: #e63946;
  padding: 0 12px;
  text-align: center;
}
</style>
