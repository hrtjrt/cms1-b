import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/* ==========================================================================
   cms1_b 后台管理前端
   dev server 固定 5174（前台占 5173），并把 /api 与 /uploads 代理到后端 3000，
   这样开发期不需要关心跨域，也让「同源请求」与生产部署保持一致。
   生产构建用 .env.production 里的 VITE_API_BASE_URL 直连后端。
   ========================================================================== */

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    // ant-design-vue 全量注册 + echarts 全量引入，主包 1.3 MB（gzip 约 400 KB）。
    // 这是内部管理后台、只在局域网使用，不做按需引入的构建期魔法换取可维护性。
    // 把阈值调高只是为了让构建日志干净，不代表对体积没有概念。
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      // 种子占位图与用户上传的图片都由后端静态托管
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  // vite preview（生产构建本地预览）也走同样的代理，方便交付时本地验证
  preview: {
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  }
})
