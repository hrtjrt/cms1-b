<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { userApi } from '@/api/user'
import { useCrud } from '@/composables/useCrud'
import { useUserStore } from '@/stores/user'
import { dash, formatDateTime, roleColor, roleText } from '@/utils/format'
import { ROLE_OPTIONS } from '@/types'
import type { AdminUser } from '@/types'

/* ==========================================================================
   管理员

   两条约束由后端保证，前端提前拦一下给出更友好的提示：
     · 不能修改自己的角色（避免把自己降权后锁死）
     · 不能删除自己
   ========================================================================== */

const store = useUserStore()

const {
  loading,
  list,
  keyword,
  filters,
  pagination,
  load,
  search,
  reset,
  removeRow,
  handleTableChange
} = useCrud<AdminUser>(userApi, {
  defaultPageSize: 10,
  defaultSortBy: 'id',
  defaultSortOrder: 'asc'
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: true },
  { title: '账号', key: 'username', width: 160 },
  { title: '昵称', key: 'nickname', width: 150 },
  { title: '角色', key: 'role', width: 120 },
  { title: '状态', key: 'status', width: 90 },
  { title: '最近登录', key: 'lastLoginAt', width: 170 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' as const }
]

function isSelf(row: AdminUser): boolean {
  return row.id === store.profile?.id
}

/** 正在编辑的就是自己 —— 角色下拉要禁用（后端也会拒绝改自己的角色） */
const editingSelf = computed(() => editingId.value > 0 && editingId.value === store.profile?.id)

/* ---------------- 新增 / 编辑 ---------------- */

const modalOpen = ref(false)
const modalTitle = ref('新增管理员')
const submitting = ref(false)
const editingId = ref(0)
const formRef = ref<FormInstance>()

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  role: 'editor' as string,
  status: 1
})

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_]{3,50}$/,
      message: '账号只能包含字母、数字与下划线，长度 3 ~ 50',
      trigger: 'blur'
    }
  ],
  nickname: [{ max: 50, message: '最多 50 个字符', trigger: 'blur' }],
  password: [{ min: 6, max: 50, message: '密码长度 6 ~ 50 个字符', trigger: 'blur' }]
}

function openCreate(): void {
  editingId.value = 0
  modalTitle.value = '新增管理员'
  form.username = ''
  form.nickname = ''
  form.password = ''
  form.role = 'editor'
  form.status = 1
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

function openEdit(row: AdminUser): void {
  editingId.value = row.id
  modalTitle.value = `编辑管理员：${row.username}`
  form.username = row.username
  form.nickname = row.nickname
  form.password = ''
  form.role = row.role
  form.status = row.status
  modalOpen.value = true
  void formRef.value?.clearValidate()
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (editingId.value) {
      // 编辑时不提交账号与密码（账号不可改，密码走「重置密码」）
      await userApi.update(editingId.value, {
        nickname: form.nickname,
        role: form.role,
        status: form.status
      })
      message.success('保存成功')
    } else {
      if (!form.password) {
        message.warning('请为新管理员设置初始密码')
        submitting.value = false
        return
      }
      await userApi.create({
        username: form.username.trim(),
        nickname: form.nickname,
        password: form.password,
        role: form.role,
        status: form.status
      })
      message.success('新增成功')
    }
    modalOpen.value = false
    await load()
    // 改的可能是自己，刷新一下本地登录态
    await store.loadProfile(true).catch(() => undefined)
  } catch {
    /* 已提示 */
  } finally {
    submitting.value = false
  }
}

/* ---------------- 重置密码 ---------------- */

const passwordOpen = ref(false)
const passwordSubmitting = ref(false)
const passwordForm = reactive({ id: 0, username: '', newPassword: '' })

function openResetPassword(row: AdminUser): void {
  passwordForm.id = row.id
  passwordForm.username = row.username
  passwordForm.newPassword = ''
  passwordOpen.value = true
}

async function submitResetPassword(): Promise<void> {
  if (passwordForm.newPassword.length < 6) {
    message.warning('密码长度至少 6 个字符')
    return
  }

  passwordSubmitting.value = true
  try {
    await userApi.resetPassword(passwordForm.id, passwordForm.newPassword)
    message.success(`已重置「${passwordForm.username}」的密码`)
    passwordOpen.value = false
  } catch {
    /* 已提示 */
  } finally {
    passwordSubmitting.value = false
  }
}

/* ---------------- 删除 ---------------- */

async function handleRemove(row: AdminUser): Promise<void> {
  if (isSelf(row)) {
    message.warning('不能删除自己的账号')
    return
  }
  await removeRow(row, `管理员「${row.username}」`)
}

function confirmToggleStatus(row: AdminUser, value: number): void {
  if (isSelf(row) && value === 0) {
    message.warning('不能停用自己的账号')
    return
  }
  Modal.confirm({
    title: value === 1 ? `启用「${row.username}」？` : `停用「${row.username}」？`,
    content: value === 0 ? '停用后该账号将立即无法登录。' : undefined,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      await userApi.update(row.id, { nickname: row.nickname, role: row.role, status: value })
      message.success('状态已更新')
      await load()
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <a-card class="page-card" :bordered="false">
      <div class="filter-bar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索账号或昵称"
          allow-clear
          style="width: 200px"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <a-select
          v-model:value="filters.role"
          placeholder="全部角色"
          allow-clear
          style="width: 150px"
          :options="ROLE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))"
          @change="search"
        />

        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allow-clear
          style="width: 120px"
          :options="[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' }
          ]"
          @change="search"
        />

        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="reset">重置</a-button>

        <div class="spacer" />

        <a-button v-perm="'user:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增管理员
        </a-button>
      </div>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1200 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'username'">
            <div class="cell-main">
              {{ dash(record.username) }}
              <a-tag v-if="isSelf(record)" color="blue" style="margin-left: 6px">当前登录</a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'nickname'">
            {{ dash(record.nickname) }}
          </template>

          <template v-else-if="column.key === 'role'">
            <a-tag :color="roleColor(record.role)">{{ roleText(record.role) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-switch
              :checked="record.status === 1"
              :disabled="!$perm('user:update')"
              checked-children="启用"
              un-checked-children="停用"
              @change="(value: boolean) => confirmToggleStatus(record, value ? 1 : 0)"
            />
          </template>

          <template v-else-if="column.key === 'lastLoginAt'">
            {{ formatDateTime(record.lastLoginAt) }}
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a v-perm="'user:update'" @click="openEdit(record)"><EditOutlined /> 编辑</a>
              <a v-perm="'user:update'" @click="openResetPassword(record)">
                <KeyOutlined /> 重置密码
              </a>
              <a-typography-link
                v-perm="'user:delete'"
                type="danger"
                :disabled="isSelf(record)"
                @click="handleRemove(record)"
              >
                <DeleteOutlined /> 删除
              </a-typography-link>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="520"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="账号" name="username" :extra="editingId ? '账号不可修改' : '字母、数字、下划线，3 ~ 50 位'">
          <a-input v-model:value="form.username" :disabled="Boolean(editingId)" :maxlength="50" />
        </a-form-item>

        <a-form-item label="昵称" name="nickname">
          <a-input v-model:value="form.nickname" :maxlength="50" placeholder="显示在顶栏" />
        </a-form-item>

        <a-form-item v-if="!editingId" label="初始密码" name="password" extra="6 ~ 50 个字符">
          <a-input-password v-model:value="form.password" placeholder="请设置初始密码" />
        </a-form-item>

        <a-form-item label="角色" name="role" :extra="editingSelf ? '不能修改自己的角色' : undefined">
          <a-select
            v-model:value="form.role"
            :disabled="editingSelf"
            :options="ROLE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))"
          />
        </a-form-item>

        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="0">停用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="passwordOpen"
      :title="`重置密码：${passwordForm.username}`"
      :width="440"
      :confirm-loading="passwordSubmitting"
      ok-text="重置"
      cancel-text="取消"
      @ok="submitResetPassword"
    >
      <a-alert type="warning" show-icon style="margin-bottom: 16px" message="重置后该账号的旧密码立即失效" />
      <a-form layout="vertical">
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="passwordForm.newPassword" placeholder="6 ~ 50 个字符" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
