<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined } from '@ant-design/icons-vue'
import ImageUpload from '@/components/ImageUpload.vue'
import { pageHeroApi } from '@/api/site'
import { assetUrl } from '@/utils/request'
import { dash } from '@/utils/format'
import type { PageHeroConfig } from '@/types'

/* ==========================================================================
   页面 Banner
   固定三条（about / news / contact），页面标识只读，只允许改文案与样式。
   前台的 PageHero 组件把这些字段当作 CSS 变量用，所以高度、字间距、遮罩色
   都是「字符串」而不是数字（例如 '420px'、'rgba(10,23,218,0.55)'）。
   ========================================================================== */

const loading = ref(false)
const list = ref<PageHeroConfig[]>([])

const modalOpen = ref(false)
const submitting = ref(false)
const editingId = ref(0)

const form = reactive({
  title: '',
  subtitle: '',
  image: '',
  height: '',
  heightSm: '',
  mask: '',
  letterSpacing: '',
  subtitleSize: '',
  subtitleSpacing: '',
  subtitleOpacity: '',
  sort: 0
})

async function load(): Promise<void> {
  loading.value = true
  try {
    list.value = await pageHeroApi.list()
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false
  }
}

function openEdit(row: PageHeroConfig): void {
  editingId.value = row.id
  form.title = row.title
  form.subtitle = row.subtitle
  form.image = row.image
  form.height = row.height
  form.heightSm = row.heightSm
  form.mask = row.mask
  form.letterSpacing = row.letterSpacing
  form.subtitleSize = row.subtitleSize
  form.subtitleSpacing = row.subtitleSpacing
  form.subtitleOpacity = row.subtitleOpacity
  form.sort = row.sort
  modalOpen.value = true
}

async function submit(): Promise<void> {
  submitting.value = true
  try {
    await pageHeroApi.update(editingId.value, {
      ...form,
      image: form.image.trim()
    })
    message.success('保存成功')
    modalOpen.value = false
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
    <a-card class="page-card" :bordered="false" title="页面 Banner">
      <template #extra>
        <span style="font-size: 12px; color: #999">
          前台只有「关于我们 / 新闻动态 / 联系我们」三页使用 Banner，页面标识不可修改
        </span>
      </template>

      <a-spin :spinning="loading">
        <a-row :gutter="16">
          <a-col v-for="item in list" :key="item.id" :xs="24" :md="8">
            <a-card size="small" :title="item.pageName" style="margin-bottom: 16px">
              <img
                :src="assetUrl(item.image)"
                alt="Banner"
                style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #eee"
              />

              <div style="margin-top: 12px; font-size: 13px; line-height: 2">
                <div>
                  <span style="color: #999">页面标识：</span>
                  <code>{{ item.pageKey }}</code>
                </div>
                <div>
                  <span style="color: #999">主标题：</span>{{ dash(item.title) }}
                </div>
                <div>
                  <span style="color: #999">副标题：</span>{{ dash(item.subtitle) }}
                </div>
                <div>
                  <span style="color: #999">高度：</span>{{ dash(item.height) }}
                  <span style="color: #999">（窄屏 {{ dash(item.heightSm) }}）</span>
                </div>
              </div>

              <a-button
                v-perm="'site:update'"
                block
                style="margin-top: 12px"
                @click="openEdit(item)"
              >
                <template #icon><EditOutlined /></template>
                编辑
              </a-button>
            </a-card>
          </a-col>
        </a-row>

        <a-empty v-if="!loading && list.length === 0" description="暂无页面 Banner" />
      </a-spin>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      title="编辑页面 Banner"
      :width="640"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      :body-style="{ maxHeight: '66vh', overflowY: 'auto' }"
      @ok="submit"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="主标题">
          <a-input v-model:value="form.title" :maxlength="120" />
        </a-form-item>
        <a-form-item label="副标题">
          <a-input v-model:value="form.subtitle" :maxlength="120" />
        </a-form-item>
        <a-form-item label="背景图">
          <ImageUpload v-model="form.image" :height="120" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="常规高度" extra="带单位，如 420px">
              <a-input v-model:value="form.height" placeholder="420px" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="窄屏高度" extra="带单位，如 320px">
              <a-input v-model:value="form.heightSm" placeholder="320px" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sort" :min="0" :max="99999" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="遮罩色" extra="rgba 字符串，用来压暗背景以便叠白字">
          <a-input v-model:value="form.mask" placeholder="rgba(10, 23, 218, 0.55)" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="标题字间距">
              <a-input v-model:value="form.letterSpacing" placeholder="2px" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="副标题字号">
              <a-input v-model:value="form.subtitleSize" placeholder="1.2rem" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="副标题字间距">
              <a-input v-model:value="form.subtitleSpacing" placeholder="4px" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="副标题透明度" extra="0 ~ 1 之间的小数，例如 0.9">
          <a-input v-model:value="form.subtitleOpacity" placeholder="0.9" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
