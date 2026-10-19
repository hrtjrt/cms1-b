<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  BoldOutlined,
  ClearOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UnorderedListOutlined
} from '@ant-design/icons-vue'
import { uploadImage, validateImageFile } from '@/api/upload'
import { assetUrl } from '@/utils/request'
import { resolveHtmlAssets, toStoredHtml } from '@/utils/html'

/* ==========================================================================
   轻量富文本编辑器

   为什么不用 wangEditor / tiptap：
     后端只允许白名单标签（p / h3 / strong / ul / a / img …），
     后台需要的也只是「加粗、标题、列表、链接、插图」这几件事，
     引一个 200KB+ 的编辑器依赖，还要对着它的输出调后端白名单，不划算。

   实现：contenteditable + document.execCommand。
     execCommand 虽然是旧 API，但在所有现代浏览器里仍然可用，
     对内部管理后台来说够用，且零依赖。
   ========================================================================== */

const modelValue = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    minHeight?: number
    disabled?: boolean
  }>(),
  {
    placeholder: '请输入内容…',
    minHeight: 220,
    disabled: false
  }
)

const bodyRef = ref<HTMLDivElement | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/** 把 modelValue 写进 DOM（显示时补全资源地址） */
function syncToDom(): void {
  const el = bodyRef.value
  if (!el) return
  const html = resolveHtmlAssets(modelValue.value ?? '')
  if (el.innerHTML !== html) el.innerHTML = html
}

/** 从 DOM 读出 HTML（保存时还原成相对地址） */
function syncFromDom(): void {
  const el = bodyRef.value
  if (!el) return
  const html = toStoredHtml(el.innerHTML)
  // 空内容统一成空串，避免存一堆 <br>
  modelValue.value = html.replace(/^(<br\s*\/?>|\s|&nbsp;)+$/i, '')
}

onMounted(() => {
  syncToDom()
})

// 外部改值（例如打开编辑弹窗）时同步进编辑器；正在编辑时不打断光标
watch(modelValue, () => {
  const el = bodyRef.value
  if (!el) return
  if (document.activeElement === el) return
  syncToDom()
})

function exec(command: string, value?: string): void {
  if (props.disabled) return
  bodyRef.value?.focus()
  document.execCommand(command, false, value)
  syncFromDom()
}

function formatBlock(tag: string): void {
  exec('formatBlock', tag)
}

function insertLink(): void {
  const url = window.prompt('请输入链接地址（以 http:// 或 https:// 开头）')
  if (!url) return
  if (!/^https?:\/\//i.test(url)) {
    message.warning('链接必须以 http:// 或 https:// 开头')
    return
  }
  exec('createLink', url)
}

function pickImage(): void {
  if (props.disabled || uploading.value) return
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const invalid = validateImageFile(file)
  if (invalid) {
    message.warning(invalid)
    return
  }

  uploading.value = true
  try {
    const result = await uploadImage(file)
    // 编辑器里插入绝对地址以便立即显示；
    // syncFromDom 会在保存时把它还原成 /uploads/... 存库。
    const src = result.fullUrl || assetUrl(result.url)
    exec(
      'insertHTML',
      `<img src="${src}" alt="${file.name.replace(/"/g, '')}" style="max-width: 100%;" />`
    )
    message.success('图片已插入')
  } catch {
    /* 错误提示已由 request 层给出 */
  } finally {
    uploading.value = false
  }
}

async function insertImageByUrl(): Promise<void> {
  const url = window.prompt('请输入图片地址（http:// 或 https:// 开头，或以 / 开头的站内地址）')
  if (!url) return

  const value = url.trim()
  // 只允许 http(s) 与站内绝对路径，拦掉 javascript: / data: 等危险协议
  if (!/^(?:https?:\/\/|\/(?!\/))/i.test(value)) {
    message.warning('图片地址必须以 http://、https:// 或 / 开头')
    return
  }
  // 转义引号，避免闭合 src 属性后注入 onerror 等事件
  const safe = value.replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  await nextTick()
  exec('insertHTML', `<img src="${safe}" style="max-width: 100%;" />`)
}
</script>

<template>
  <div class="rich-editor">
    <div class="rich-editor-toolbar">
      <a-tooltip title="加粗">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('bold')">
          <BoldOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="斜体">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('italic')">
          <ItalicOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="下划线">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('underline')">
          <UnderlineOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="删除线">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('strikeThrough')">
          <StrikethroughOutlined />
        </a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-tooltip title="正文">
        <a-button type="text" size="small" :disabled="disabled" @click="formatBlock('p')">P</a-button>
      </a-tooltip>
      <a-tooltip title="小标题">
        <a-button type="text" size="small" :disabled="disabled" @click="formatBlock('h3')">H3</a-button>
      </a-tooltip>
      <a-tooltip title="大标题">
        <a-button type="text" size="small" :disabled="disabled" @click="formatBlock('h2')">H2</a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-tooltip title="无序列表">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('insertUnorderedList')">
          <UnorderedListOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="有序列表">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('insertOrderedList')">
          <OrderedListOutlined />
        </a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-tooltip title="插入链接">
        <a-button type="text" size="small" :disabled="disabled" @click="insertLink">
          <LinkOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="上传图片">
        <a-button
          type="text"
          size="small"
          :loading="uploading"
          :disabled="disabled"
          @click="pickImage"
        >
          <PictureOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip title="按地址插图">
        <a-button type="text" size="small" :disabled="disabled" @click="insertImageByUrl">
          URL
        </a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-tooltip title="清除格式">
        <a-button type="text" size="small" :disabled="disabled" @click="exec('removeFormat')">
          <ClearOutlined />
        </a-button>
      </a-tooltip>
    </div>

    <div
      ref="bodyRef"
      class="rich-editor-body"
      :contenteditable="!disabled"
      :data-placeholder="placeholder"
      :style="{ minHeight: `${minHeight}px` }"
      @input="syncFromDom"
      @blur="syncFromDom"
    />

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      style="display: none"
      @change="onFileChange"
    />
  </div>
</template>
