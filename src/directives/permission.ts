import type { Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/user'

/* ==========================================================================
   v-perm 按钮级权限指令

   用法：
     <a-button v-perm="'news:create'">新增</a-button>
     <a-button v-perm="['news:update', 'news:delete']">批量操作</a-button>   // 任一满足

   无权限时直接把元素从 DOM 移除（而不是 disabled），
   避免用户点到一个「看起来能点但点不动」的按钮。
   ========================================================================== */

function check(binding: DirectiveBinding<string | string[]>): boolean {
  const store = useUserStore()
  const value = binding.value

  if (!value) return true
  if (Array.isArray(value)) return value.length === 0 || store.hasAny(value)
  return store.has(value)
}

export const permissionDirective: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    // 权限码可能晚于组件挂载到达（刷新页面时先拉 profile）；
    // 这里用一个标记位，配合 updated 钩子在权限就绪后再判一次。
    if (!check(binding)) {
      el.parentNode?.removeChild(el)
      el.dataset.permRemoved = '1'
    }
  },
  updated(el, binding) {
    // 已经被移除的元素不再处理
    if (el.dataset.permRemoved === '1') return
    if (!check(binding)) {
      el.parentNode?.removeChild(el)
      el.dataset.permRemoved = '1'
    }
  }
}
