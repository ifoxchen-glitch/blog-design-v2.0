# Phase 2 §5.1.4 RBAC 前端页面整片设计

> 本文档配合 [`docs/05-implementation-plan.md`](./05-implementation-plan.md) §5.1.4 中的 T2.22 ~ T2.25。
>
> 给 Claude Code 执行用。每节末有 **"提交检查清单"**。
>
> 前置条件：§5.1.3 通用组件（PageHeader / DataTable / FormDrawer / useTable）已全部合并。
>
> 预计总工时：12h（4 个 PR）。

---

## 0. 前置依赖

- **§5.1.1 RBAC 后端** — users/roles/permissions/menus 全部 API 已就绪。
- **§5.1.3 通用组件** — 6 个 PR 全部合并。
- **前端已有基础**：`api/request.ts`、`stores/auth.ts`、`stores/permission.ts`、路由守卫、`AdminLayout.vue`。

### 0.1 新增 API 文件

统一封装在 `admin/src/api/rbac.ts`，四个页面共用。类型定义见各节。

```ts
import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

// ========== User ==========
export interface UserItem {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  status: 'active' | 'disabled'
  isSuperAdmin: boolean
  roles: Array<{ id: number; code: string; name: string }>
  createdAt: string
  updatedAt: string
}

export interface UserListQuery {
  keyword?: string
  status?: string
}

export async function apiGetUsers(
  params: { page: number; pageSize: number; keyword?: string; status?: string },
  client: AxiosInstance = request,
): Promise<{ items: UserItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: UserItem[]; total: number }>>(
    '/api/v2/admin/rbac/users',
    { params },
  )
  return res.data.data
}

export async function apiCreateUser(
  data: { username: string; email: string; password: string; displayName?: string; status?: string },
  client: AxiosInstance = request,
): Promise<UserItem> {
  const res = await client.post<ApiResponse<UserItem>>('/api/v2/admin/rbac/users', data)
  return res.data.data
}

export async function apiUpdateUser(
  id: number,
  data: { username?: string; email?: string; displayName?: string; status?: string },
  client: AxiosInstance = request,
): Promise<UserItem> {
  const res = await client.put<ApiResponse<UserItem>>(`/api/v2/admin/rbac/users/${id}`, data)
  return res.data.data
}

export async function apiDeleteUser(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/rbac/users/${id}`)
}

export async function apiResetPassword(
  id: number,
  data: { newPassword: string },
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<void>>(`/api/v2/admin/rbac/users/${id}/reset-password`, data)
}

export async function apiAssignUserRoles(
  id: number,
  roleIds: number[],
  client: AxiosInstance = request,
): Promise<{ userId: number; roles: Array<{ id: number; code: string; name: string }> }> {
  const res = await client.put<ApiResponse<{ userId: number; roles: Array<{ id: number; code: string; name: string }> }>>(
    `/api/v2/admin/rbac/users/${id}/roles`,
    { role_ids: roleIds },
  )
  return res.data.data
}

// ========== Role ==========
export interface RoleItem {
  id: number
  code: string
  name: string
  description: string | null
  status: 'active' | 'disabled'
  userCount: number
  permissionCount: number
  createdAt: string
  updatedAt: string
}

export interface RoleDetail extends RoleItem {
  permissions: Array<{ id: number; code: string; resource: string; action: string; name: string }>
}

export async function apiGetRoles(
  client: AxiosInstance = request,
): Promise<{ items: RoleItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: RoleItem[]; total: number }>>('/api/v2/admin/rbac/roles')
  return res.data.data
}

export async function apiGetRole(
  id: number,
  client: AxiosInstance = request,
): Promise<RoleDetail> {
  const res = await client.get<ApiResponse<RoleDetail>>(`/api/v2/admin/rbac/roles/${id}`)
  return res.data.data
}

export async function apiCreateRole(
  data: { code: string; name: string; description?: string; status?: string },
  client: AxiosInstance = request,
): Promise<RoleItem> {
  const res = await client.post<ApiResponse<RoleItem>>('/api/v2/admin/rbac/roles', data)
  return res.data.data
}

export async function apiUpdateRole(
  id: number,
  data: { name?: string; description?: string; status?: string },
  client: AxiosInstance = request,
): Promise<RoleItem> {
  const res = await client.put<ApiResponse<RoleItem>>(`/api/v2/admin/rbac/roles/${id}`, data)
  return res.data.data
}

export async function apiDeleteRole(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/rbac/roles/${id}`)
}

export async function apiAssignRolePermissions(
  id: number,
  permissionIds: number[],
  client: AxiosInstance = request,
): Promise<{ roleId: number; permissions: Array<{ id: number; code: string; name: string }> }> {
  const res = await client.put<ApiResponse<{ roleId: number; permissions: Array<{ id: number; code: string; name: string }> }>>(
    `/api/v2/admin/rbac/roles/${id}/permissions`,
    { permission_ids: permissionIds },
  )
  return res.data.data
}

// ========== Permission ==========
export interface PermissionItem {
  id: number
  code: string
  resource: string
  action: string
  name: string
  description: string | null
  createdAt: string
}

export async function apiGetPermissions(
  params?: { resource?: string },
  client: AxiosInstance = request,
): Promise<{ items: PermissionItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: PermissionItem[]; total: number }>>(
    '/api/v2/admin/rbac/permissions',
    { params },
  )
  return res.data.data
}

export async function apiUpdatePermission(
  id: number,
  data: { name?: string; description?: string },
  client: AxiosInstance = request,
): Promise<PermissionItem> {
  const res = await client.put<ApiResponse<PermissionItem>>(`/api/v2/admin/rbac/permissions/${id}`, data)
  return res.data.data
}

// ========== Menu ==========
export interface MenuItem {
  id: number
  parentId: number | null
  name: string
  path: string | null
  icon: string | null
  permissionCode: string | null
  sortOrder: number
  status: 'active' | 'disabled'
  children?: MenuItem[]
}

export async function apiGetMenus(
  client: AxiosInstance = request,
): Promise<{ tree: MenuItem[] }> {
  const res = await client.get<ApiResponse<{ tree: MenuItem[] }>>('/api/v2/admin/rbac/menus')
  return res.data.data
}

export async function apiGetMenu(
  id: number,
  client: AxiosInstance = request,
): Promise<MenuItem> {
  const res = await client.get<ApiResponse<MenuItem>>(`/api/v2/admin/rbac/menus/${id}`)
  return res.data.data
}

export async function apiCreateMenu(
  data: { parentId?: number | null; name: string; path?: string | null; icon?: string | null; permissionCode?: string | null; sortOrder?: number; status?: string },
  client: AxiosInstance = request,
): Promise<MenuItem> {
  const res = await client.post<ApiResponse<MenuItem>>('/api/v2/admin/rbac/menus', {
    parent_id: data.parentId ?? null,
    name: data.name,
    path: data.path ?? null,
    icon: data.icon ?? null,
    permission_code: data.permissionCode ?? null,
    sort_order: data.sortOrder ?? 0,
    status: data.status ?? 'active',
  })
  return res.data.data
}

export async function apiUpdateMenu(
  id: number,
  data: { parentId?: number | null; name?: string; path?: string | null; icon?: string | null; permissionCode?: string | null; sortOrder?: number; status?: string },
  client: AxiosInstance = request,
): Promise<MenuItem> {
  const body: Record<string, any> = {}
  if (data.parentId !== undefined) body.parent_id = data.parentId
  if (data.name !== undefined) body.name = data.name
  if (data.path !== undefined) body.path = data.path
  if (data.icon !== undefined) body.icon = data.icon
  if (data.permissionCode !== undefined) body.permission_code = data.permissionCode
  if (data.sortOrder !== undefined) body.sort_order = data.sortOrder
  if (data.status !== undefined) body.status = data.status
  const res = await client.put<ApiResponse<MenuItem>>(`/api/v2/admin/rbac/menus/${id}`, body)
  return res.data.data
}

export async function apiDeleteMenu(
  id: number,
  cascade = false,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/rbac/menus/${id}${cascade ? '?cascade=true' : ''}`)
}

export async function apiReorderMenus(
  items: Array<{ id: number; parentId: number | null; sortOrder: number }>,
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<void>>('/api/v2/admin/rbac/menus/reorder', {
    items: items.map((i) => ({ id: i.id, parent_id: i.parentId, sort_order: i.sortOrder })),
  })
}
```

### 0.2 路由注册

在 `admin/src/router/index.ts` 的 `/dashboard` children 中追加：

```ts
{
  path: '/users',
  name: 'users',
  component: () => import('../views/rbac/users/index.vue'),
  meta: { permission: 'user:list' },
},
{
  path: '/roles',
  name: 'roles',
  component: () => import('../views/rbac/roles/index.vue'),
  meta: { permission: 'role:assign' },
},
{
  path: '/permissions',
  name: 'permissions',
  component: () => import('../views/rbac/permissions/index.vue'),
  meta: { permission: 'role:assign' },
},
{
  path: '/menus',
  name: 'menus',
  component: () => import('../views/rbac/menus/index.vue'),
  meta: { permission: 'menu:manage' },
},
```

路由守卫已经支持 `meta.permission`，不需要额外改 guards.ts。

### 0.3 菜单节点注册

`admin/src/stores/permission.ts` 的 `loadMenus()` 从 `/api/v2/auth/menus` 取菜单树。**不需要改 stores** —— 后端 `/api/v2/auth/menus` 已经按权限过滤返回，只要前端路由配好，侧边栏自动显示。

但需要在 `admin/src/components/layout/AdminLayout.vue` 的菜单数据中把新页面的路径映射加上（如果后端 menus 表数据已包含这些路径，则自动显示；否则可能需要等菜单管理页建好后手动添加）。

**当前阶段**：先确保后端 menus 表已有这些路径的数据（seed 已包含 `/cms/users`, `/cms/roles`, `/cms/permissions`, `/cms/menus`）。Claude Code 跑完后验证侧边栏能否正常显示。

---

## 1. 总体节奏 & 依赖图

```
T2.22 用户管理页面   (3.5h)
T2.23 角色管理页面   (3h)   ┐ 互不依赖，可并列
T2.24 权限管理页面   (2h)   ┘
   ↓
T2.25 菜单管理页面   (3.5h)  ← 依赖 T2.23（角色/权限数据结构已定型，菜单需要引用 permission_code）
```

**建议合并节奏**：每个任务一个 PR，4 PR 全程。
- T2.22 = #52, T2.23 = #53, T2.24 = #54, T2.25 = #55

---

## 2. T2.22 — 用户管理页面

**Issue**: #52 / **估时**: 3.5h / **依赖**: §5.1.3

### 2.1 页面结构

```
views/rbac/users/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="用户管理" subtitle="管理系统后台用户账号">
      <n-button type="primary" v-permission="'user:create'" @click="openCreate">
        新建用户
      </n-button>
    </PageHeader>

    <DataTable
      :columns="columns"
      :api="fetchUsers"
      :batch-actions="batchActions"
      search-placeholder="搜索用户名、邮箱..."
    >
      <template #extra>
        <n-select
          v-model:value="filterStatus"
          :options="statusOptions"
          placeholder="状态筛选"
          clearable
          class="w-32"
        />
      </template>
    </DataTable>

    <!-- 新建 / 编辑抽屉 -->
    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑用户' : '新建用户'"
      :loading="submitting"
      :rules="formRules"
      @submit="handleSubmit"
    >
      <n-form-item label="用户名" path="username">
        <n-input v-model:value="form.username" :disabled="isEdit" />
      </n-form-item>
      <n-form-item label="邮箱" path="email">
        <n-input v-model:value="form.email" />
      </n-form-item>
      <n-form-item label="显示名" path="displayName">
        <n-input v-model:value="form.displayName" />
      </n-form-item>
      <n-form-item v-if="!isEdit" label="密码" path="password">
        <n-input v-model:value="form.password" type="password" />
      </n-form-item>
      <n-form-item label="状态" path="status">
        <n-radio-group v-model:value="form.status">
          <n-radio-button value="active">正常</n-radio-button>
          <n-radio-button value="disabled">禁用</n-radio-button>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="角色">
        <n-select
          v-model:value="form.roleIds"
          multiple
          :options="roleOptions"
          placeholder="选择角色"
        />
      </n-form-item>
    </FormDrawer>

    <!-- 重置密码弹窗 -->
    <n-modal v-model:show="resetModalVisible" title="重置密码" preset="dialog">
      <n-input v-model:value="newPassword" type="password" placeholder="输入新密码" />
      <template #action>
        <n-button @click="resetModalVisible = false">取消</n-button>
        <n-button type="primary" :loading="resetting" @click="confirmReset">确认</n-button>
      </template>
    </n-modal>
  </div>
</template>
```

### 2.2 DataTable columns

```ts
const columns = [
  { type: 'selection', fixed: 'left' },
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 120, sorter: true },
  { title: '邮箱', key: 'email', width: 180, sorter: true },
  { title: '显示名', key: 'displayName', width: 120 },
  {
    title: '角色',
    key: 'roles',
    width: 180,
    render(row: UserItem) {
      return row.roles.map((r) => h(NTag, { size: 'small' }, { default: () => r.name }))
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row: UserItem) {
      return h(NTag, { type: row.status === 'active' ? 'success' : 'default', size: 'small' }, {
        default: () => (row.status === 'active' ? '正常' : '禁用'),
      })
    },
  },
  { title: '创建时间', key: 'createdAt', width: 160, sorter: true },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    render(row: UserItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { size: 'small', onClick: () => openReset(row) }, { default: () => '重置密码' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该用户？',
          }),
        ],
      })
    },
  },
]
```

### 2.3 表单校验规则

```ts
const formRules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}
```

### 2.4 状态筛选联动

`filterStatus`（`active`/`disabled`）变化时，需要传给 DataTable 的 api 调用。由于 DataTable 内部用 useTable，它只认 `keyword` 和 api 函数。有两种方案：

**方案 A**（推荐）：把 `filterStatus` 包进 api 函数里形成闭包：

```ts
const fetchUsers = (params: any) => apiGetUsers({ ...params, status: filterStatus.value || undefined })
```

DataTable 的 `api` prop 接受函数，useTable 会在 page/pageSize/keyword/sort 变化时调用它。`filterStatus` 变化时，外部手动调用 `dataTableRef.value?.fetch()`（需要在 DataTable 暴露 `fetch` 方法）。

**如果 DataTable 没暴露 fetch**，就在 `watch(filterStatus, () => window.location.reload())` —— 暴力但可用。或者改 DataTable 加一个 `extraQuery` prop。这里选 **方案 A + 在 DataTable 上暴露 fetch 方法**。

### 2.5 批量操作

```ts
const batchActions = [
  {
    label: '批量删除',
    type: 'error' as const,
    permission: 'user:delete',
    onClick: (rows: UserItem[]) => {
      // 确认弹窗后逐个调用 apiDeleteUser，完成后 toast + refresh
    },
  },
]
```

### 2.6 新建/编辑逻辑

```ts
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const form = reactive({ username: '', email: '', displayName: '', password: '', status: 'active', roleIds: [] as number[] })

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, { username: '', email: '', displayName: '', password: '', status: 'active', roleIds: [] })
  // 加载角色选项（用于下拉框）
  await loadRoleOptions()
  drawerVisible.value = true
}

async function openEdit(row: UserItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    username: row.username,
    email: row.email,
    displayName: row.displayName || '',
    status: row.status,
    roleIds: row.roles.map((r) => r.id),
  })
  await loadRoleOptions()
  drawerVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    if (isEdit.value && editingId.value) {
      await apiUpdateUser(editingId.value, {
        username: form.username,
        email: form.email,
        displayName: form.displayName || undefined,
        status: form.status,
      })
      await apiAssignUserRoles(editingId.value, form.roleIds)
    } else {
      const user = await apiCreateUser({
        username: form.username,
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        status: form.status,
      })
      if (form.roleIds.length) {
        await apiAssignUserRoles(user.id, form.roleIds)
      }
    }
    drawerVisible.value = false
    // refresh table
  } finally {
    submitting.value = false
  }
}
```

### 2.7 权限控制矩阵

| 元素 | 权限码 | 说明 |
|---|---|---|
| "新建用户" 按钮 | `user:create` | v-permission |
| 编辑按钮 | `user:update` | v-permission（操作列整列可包一层 v-permission="'user:update'"） |
| 删除按钮 | `user:delete` | v-permission |
| 重置密码按钮 | `user:update` | v-permission（和编辑共用） |
| 批量删除 | `user:delete` | batchActions 里的 permission |

### 2.8 提交检查清单

- [ ] `admin/src/api/rbac.ts` 包含 User 相关 API（含 `apiAssignUserRoles`）
- [ ] `views/rbac/users/index.vue` 页面结构完整（PageHeader + DataTable + FormDrawer + Reset Modal）
- [ ] DataTable 列定义完整：ID/用户名/邮箱/显示名/角色/状态/创建时间/操作
- [ ] 状态筛选 `<n-select>` 联动表格刷新
- [ ] 新建/编辑抽屉字段：用户名、邮箱、显示名、密码（仅新建）、状态、角色多选
- [ ] 表单校验：username/email 必填，email 格式，password 新建时必填
- [ ] 重置密码弹窗：输入新密码 → 调用 `apiResetPassword`
- [ ] 操作列权限控制（v-permission）
- [ ] 批量删除逻辑 + 刷新
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #52` + merge

---

## 3. T2.23 — 角色管理页面

**Issue**: #53 / **估时**: 3h / **依赖**: §5.1.3

### 3.1 页面结构

```
views/rbac/roles/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="角色管理" subtitle="管理系统角色及权限">
      <n-button type="primary" v-permission="'role:assign'" @click="openCreate">
        新建角色
      </n-button>
    </PageHeader>

    <DataTable
      :columns="columns"
      :api="apiGetRoles"
      search-placeholder="搜索角色名称..."
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑角色' : '新建角色'"
      :loading="submitting"
      :rules="formRules"
      @submit="handleSubmit"
    >
      <n-form-item label="角色编码" path="code">
        <n-input v-model:value="form.code" :disabled="isEdit" placeholder="如 content_admin" />
      </n-form-item>
      <n-form-item label="角色名称" path="name">
        <n-input v-model:value="form.name" />
      </n-form-item>
      <n-form-item label="描述" path="description">
        <n-input v-model:value="form.description" type="textarea" />
      </n-form-item>
      <n-form-item label="状态" path="status">
        <n-radio-group v-model:value="form.status">
          <n-radio-button value="active">正常</n-radio-button>
          <n-radio-button value="disabled">禁用</n-radio-button>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="权限">
        <n-tree
          :data="permissionTree"
          :default-checked-keys="form.permissionIds"
          checkable
          cascade
          @update:checked-keys="(keys) => (form.permissionIds = keys as number[])"
        />
      </n-form-item>
    </FormDrawer>
  </div>
</template>
```

### 3.2 DataTable columns

```ts
const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '编码', key: 'code', width: 140 },
  { title: '名称', key: 'name', width: 140, sorter: true },
  { title: '描述', key: 'description', ellipsis: true },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row: RoleItem) {
      return h(NTag, { type: row.status === 'active' ? 'success' : 'default', size: 'small' }, {
        default: () => (row.status === 'active' ? '正常' : '禁用'),
      })
    },
  },
  { title: '用户数', key: 'userCount', width: 80 },
  { title: '权限数', key: 'permissionCount', width: 80 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row: RoleItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该角色？',
          }),
        ],
      })
    },
  },
]
```

### 3.3 权限树

```ts
// 把 flat permissions 按 resource 分组转成 tree 给 n-tree
const permissionTree = computed(() => {
  const groups: Record<string, { key: number; label: string; children: any[] }> = {}
  allPermissions.value.forEach((p) => {
    if (!groups[p.resource]) {
      groups[p.resource] = { key: `group-${p.resource}`, label: p.resource, children: [] }
    }
    groups[p.resource].children.push({ key: p.id, label: `${p.name} (${p.code})` })
  })
  return Object.values(groups)
})
```

**注意**：`n-tree` 的 `key` 可以是 string。`default-checked-keys` 需要是 permission id 数组。`group-${resource}` 这种 string key 不会出现在 checked-keys 里（因为 n-tree 的 cascade 模式只返回叶子节点的 key），所以安全。

### 3.4 新建/编辑逻辑

```ts
async function openEdit(row: RoleItem) {
  isEdit.value = true
  editingId.value = row.id
  const detail = await apiGetRole(row.id)
  Object.assign(form, {
    code: detail.code,
    name: detail.name,
    description: detail.description || '',
    status: detail.status,
    permissionIds: detail.permissions.map((p) => p.id),
  })
  drawerVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    if (isEdit.value && editingId.value) {
      await apiUpdateRole(editingId.value, {
        name: form.name,
        description: form.description || undefined,
        status: form.status,
      })
      await apiAssignRolePermissions(editingId.value, form.permissionIds)
    } else {
      const role = await apiCreateRole({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        status: form.status,
      })
      if (form.permissionIds.length) {
        await apiAssignRolePermissions(role.id, form.permissionIds)
      }
    }
    drawerVisible.value = false
    // refresh
  } finally {
    submitting.value = false
  }
}
```

### 3.5 删除保护

后端已做保护：内置角色（super_admin/content_admin/viewer）不可删，有用户的角色不可删。前端不需要额外拦截，按后端返回的 403/409 弹 toast 即可。

### 3.6 提交检查清单

- [ ] `api/rbac.ts` 包含 Role 相关 API（含 `apiAssignRolePermissions`）
- [ ] `views/rbac/roles/index.vue` 页面结构完整
- [ ] DataTable 列：ID/编码/名称/描述/状态/用户数/权限数/操作
- [ ] 新建/编辑抽屉：code（仅新建可编辑）/name/description/status/权限树
- [ ] 权限树用 n-tree，按 resource 分组，cascade check
- [ ] 保存时先更新角色信息，再调用 `apiAssignRolePermissions`
- [ ] 删除按钮 + 后端错误提示（409/403）
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #53` + merge

---

## 4. T2.24 — 权限管理页面

**Issue**: #54 / **估时**: 2h / **依赖**: §5.1.3

### 4.1 特点

权限是**只读列表 + 行内编辑 name/description**，没有新建/删除。页面最简单。

### 4.2 页面结构

```
views/rbac/permissions/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="权限管理" subtitle="查看并编辑权限名称和描述" />

    <DataTable
      :columns="columns"
      :api="fetchPermissions"
      search-placeholder="搜索权限名称或编码..."
    >
      <template #extra>
        <n-select
          v-model:value="filterResource"
          :options="resourceOptions"
          placeholder="资源筛选"
          clearable
          class="w-32"
        />
      </template>
    </DataTable>
  </div>
</template>
```

### 4.3 DataTable columns（行内编辑）

```ts
const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '编码', key: 'code', width: 160 },
  { title: '资源', key: 'resource', width: 100 },
  { title: '动作', key: 'action', width: 100 },
  {
    title: '名称',
    key: 'name',
    width: 180,
    render(row: PermissionItem, index: number) {
      if (editingRow.value === row.id) {
        return h(NInput, {
          value: editingForm.name,
          'onUpdate:value': (v: string) => (editingForm.name = v),
        })
      }
      return row.name
    },
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: true,
    render(row: PermissionItem, index: number) {
      if (editingRow.value === row.id) {
        return h(NInput, {
          value: editingForm.description,
          'onUpdate:value': (v: string) => (editingForm.description = v),
        })
      }
      return row.description || '-'
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render(row: PermissionItem) {
      if (editingRow.value === row.id) {
        return h(NSpace, {}, {
          default: () => [
            h(NButton, { size: 'small', type: 'primary', loading: saving.value, onClick: () => saveEdit(row) }, { default: () => '保存' }),
            h(NButton, { size: 'small', onClick: () => (editingRow.value = null) }, { default: () => '取消' }),
          ],
        })
      }
      return h(NButton, { size: 'small', onClick: () => startEdit(row) }, { default: () => '编辑' })
    },
  },
]
```

### 4.4 编辑逻辑

```ts
const editingRow = ref<number | null>(null)
const saving = ref(false)
const editingForm = reactive({ name: '', description: '' })

function startEdit(row: PermissionItem) {
  editingRow.value = row.id
  editingForm.name = row.name
  editingForm.description = row.description || ''
}

async function saveEdit(row: PermissionItem) {
  saving.value = true
  try {
    await apiUpdatePermission(row.id, {
      name: editingForm.name,
      description: editingForm.description || undefined,
    })
    editingRow.value = null
    // refresh table
  } finally {
    saving.value = false
  }
}
```

### 4.5 资源筛选

```ts
const filterResource = ref<string | null>(null)
const resourceOptions = ref<{ label: string; value: string }[]>([])

async function fetchPermissions(params: any) {
  return apiGetPermissions({ ...params, resource: filterResource.value || undefined })
}
```

### 4.6 提交检查清单

- [ ] `api/rbac.ts` 包含 Permission 相关 API
- [ ] `views/rbac/permissions/index.vue` 页面结构完整
- [ ] DataTable 列：ID/编码/资源/动作/名称/描述/操作
- [ ] 行内编辑：名称和描述字段在表格内直接改，保存/取消按钮
- [ ] 资源筛选下拉联动表格刷新
- [ ] 无新建/删除按钮（权限是系统级，靠 seed 维护）
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #54` + merge

---

## 5. T2.25 — 菜单管理页面

**Issue**: #55 / **估时**: 3.5h / **依赖**: T2.23（角色/权限数据已定型）

### 5.1 特点

菜单是**树形结构**，需要：
- 树形表格展示（或自定义树组件）
- 拖拽排序
- 新建/编辑抽屉
- 删除（带子节点检测）

Naive UI 的 `<n-data-table>` 支持 `tree` 模式，但操作复杂。更简单的方式是用 `<n-tree>` 做展示 + 右侧操作按钮，或直接用递归组件。

**推荐方案**：用 `<n-data-table>` 的 `tree` 模式，因为它自带缩进和展开/收起。但需要把树形数据拍平成 `n-data-table` 认的格式（带 `children` 字段即可，n-data-table 自动处理）。

### 5.2 页面结构

```
views/rbac/menus/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="菜单管理" subtitle="管理系统导航菜单">
      <n-button type="primary" v-permission="'menu:manage'" @click="openCreate">
        新建菜单
      </n-button>
    </PageHeader>

    <n-data-table
      :columns="columns"
      :data="menuTree"
      :row-key="(row) => row.id"
      default-expand-all
      striped
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑菜单' : '新建菜单'"
      :loading="submitting"
      :rules="formRules"
      @submit="handleSubmit"
    >
      <n-form-item label="父菜单" path="parentId">
        <n-cascader
          v-model:value="form.parentId"
          :options="menuCascaderOptions"
          placeholder="不选则为根菜单"
          clearable
          check-strategy="all"
        />
      </n-form-item>
      <n-form-item label="名称" path="name">
        <n-input v-model:value="form.name" />
      </n-form-item>
      <n-form-item label="路径" path="path">
        <n-input v-model:value="form.path" placeholder="如 /cms/posts" />
      </n-form-item>
      <n-form-item label="图标" path="icon">
        <n-input v-model:value="form.icon" placeholder="如 DocumentTextOutline" />
      </n-form-item>
      <n-form-item label="权限码" path="permissionCode">
        <n-select
          v-model:value="form.permissionCode"
          :options="permissionOptions"
          placeholder="关联权限（可选）"
          clearable
        />
      </n-form-item>
      <n-form-item label="排序" path="sortOrder">
        <n-input-number v-model:value="form.sortOrder" :min="0" />
      </n-form-item>
      <n-form-item label="状态" path="status">
        <n-radio-group v-model:value="form.status">
          <n-radio-button value="active">正常</n-radio-button>
          <n-radio-button value="disabled">禁用</n-radio-button>
        </n-radio-group>
      </n-form-item>
    </FormDrawer>
  </div>
</template>
```

### 5.3 树形表格 columns

```ts
const columns = [
  { title: '名称', key: 'name', tree: true, width: 200 },
  { title: '路径', key: 'path', width: 180 },
  { title: '图标', key: 'icon', width: 120 },
  { title: '权限码', key: 'permissionCode', width: 160 },
  { title: '排序', key: 'sortOrder', width: 80 },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row: MenuItem) {
      return h(NTag, { type: row.status === 'active' ? 'success' : 'default', size: 'small' }, {
        default: () => (row.status === 'active' ? '正常' : '禁用'),
      })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    render(row: MenuItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { size: 'small', onClick: () => openCreateChild(row) }, { default: () => '添加子菜单' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => row.children?.length
              ? `该菜单有 ${row.children.length} 个子菜单，确认删除吗？`
              : '确认删除该菜单？',
          }),
        ],
      })
    },
  },
]
```

### 5.4 数据获取

```ts
const menuTree = ref<MenuItem[]>([])

async function loadMenus() {
  const res = await apiGetMenus()
  menuTree.value = res.tree
}

onMounted(loadMenus)
```

### 5.5 级联选择器（父菜单）

```ts
const menuCascaderOptions = computed(() => {
  function walk(nodes: MenuItem[]): any[] {
    return nodes.map((n) => ({
      label: n.name,
      value: n.id,
      children: n.children?.length ? walk(n.children) : undefined,
    }))
  }
  return [{ label: '根菜单', value: null }, ...walk(menuTree.value)]
})
```

**注意**：编辑时不能选自己或自己的子节点作父节点（后端会做环检测，但前端也做一层过滤更友好）。

### 5.6 排序实现（简化版）

**本次不做拖拽排序 UI**（复杂度较高，需要单独的 sortable 库）。改为在编辑抽屉里手动调 `sortOrder` 数字，配合列上的 `sorter: true` 显示顺序。

**进阶方案**（如果 Claude Code 时间充裕）：用 `vuedraggable` 或 `@formkit/drag-and-drop` 实现树形拖拽。但估计会超时，建议留 TODO：

```ts
// TODO: 树形拖拽排序 —— 需要引入 vuedraggable 或类似库，
// 拖拽后调用 apiReorderMenus 批量更新 parent_id + sort_order
```

### 5.7 删除逻辑

```ts
async function handleDelete(row: MenuItem) {
  try {
    await apiDeleteMenu(row.id, row.children && row.children.length > 0)
    // 成功 toast + refresh
  } catch (err: any) {
    if (err.response?.data?.code === 409) {
      // 后端提示带子节点，弹 confirm 问是否 cascade
      const confirmed = await dialog.confirm({
        title: '确认级联删除',
        content: '该菜单有子菜单，确认一并删除吗？',
      })
      if (confirmed) {
        await apiDeleteMenu(row.id, true)
        // refresh
      }
    }
  }
}
```

### 5.8 提交检查清单

- [ ] `api/rbac.ts` 包含 Menu 相关 API（含 `apiReorderMenus`）
- [ ] `views/rbac/menus/index.vue` 页面结构完整
- [ ] 树形表格展示（n-data-table tree 模式）
- [ ] 列：名称/路径/图标/权限码/排序/状态/操作
- [ ] 操作列：编辑/添加子菜单/删除
- [ ] 新建/编辑抽屉：parentId（级联选择器）/name/path/icon/permissionCode/sortOrder/status
- [ ] 权限码下拉从 permissions 列表生成
- [ ] 删除带子节点时先尝试，409 后二次确认级联删除
- [ ] 排序目前用数字输入，拖拽留 TODO
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #55` + merge

---

## 6. DataTable 暴露 fetch 方法（T2.22/T2.24 需要）

当前 DataTable 组件可能没有暴露内部的 `fetch` 方法供外部调用。T2.22 的状态筛选、T2.24 的资源筛选都需要在筛选条件变化时手动触发刷新。

### 6.1 修改 DataTable.vue

在 `setup` 里把 `fetch` 暴露出去：

```ts
defineExpose({ fetch })
```

外部用法：

```ts
const tableRef = ref<InstanceType<typeof DataTable>>()
watch(filterStatus, () => tableRef.value?.fetch())
```

### 6.2 如果 T2.17 没做 expose

在 T2.22 PR 里一起改 DataTable.vue（加一个 `defineExpose({ fetch, reset })`），不影响其他页面。

---

## 7. 公共样式 & 工具

### 7.1 时间格式化

列表里的 `createdAt` 需要格式化。在 `admin/src/utils/format.ts` 新增：

```ts
export function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
```

各页面的 column render 里用 `formatDateTime(row.createdAt)` 替换原始 ISO 字符串。

### 7.2 加载角色选项

T2.22 的用户编辑抽屉需要角色下拉列表。封装一个 composable：

```ts
// admin/src/composables/useRoleOptions.ts
import { ref, onMounted } from 'vue'
import { apiGetRoles } from '../api/rbac'

export function useRoleOptions() {
  const roleOptions = ref<Array<{ label: string; value: number }>>([])
  async function load() {
    const res = await apiGetRoles()
    roleOptions.value = res.items.map((r) => ({ label: r.name, value: r.id }))
  }
  onMounted(load)
  return { roleOptions, reload: load }
}
```

### 7.3 加载权限选项

T2.23 和 T2.25 都需要权限列表：

```ts
// admin/src/composables/usePermissionOptions.ts
import { ref, onMounted } from 'vue'
import { apiGetPermissions } from '../api/rbac'

export function usePermissionOptions() {
  const permissionOptions = ref<Array<{ label: string; value: string }>>([])
  const allPermissions = ref<PermissionItem[]>([])
  async function load() {
    const res = await apiGetPermissions()
    allPermissions.value = res.items
    permissionOptions.value = res.items.map((p) => ({ label: `${p.name} (${p.code})`, value: p.code }))
  }
  onMounted(load)
  return { permissionOptions, allPermissions, reload: load }
}
```

---

## 8. 给 Claude Code 的快速接入提示

把下面整段贴到 Claude Code 的第一条消息：

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.1.4 RBAC 前端页面整片。完整设计文档在：
docs/09-phase2-rbac-frontend-plan.md

按文档顺序推进：
T2.22 (用户管理) → T2.23 (角色管理) → T2.24 (权限管理) → T2.25 (菜单管理)

每个任务完成步骤：
- 写代码（按文档的"文件改动"清单）
- 跑冒烟（admin 目录 npm run dev，浏览器验证页面）
- commit message 末行 Closes #<issue>
- gh pr create + gh pr merge --merge --delete-branch

技术栈：Vue 3.5 + TypeScript + Naive UI + Tailwind CSS 4。PageHeader / DataTable / FormDrawer / useTable 已在 §5.1.3 完成。

注意：
1. DataTable 可能需要暴露 fetch 方法（defineExpose），供外部筛选条件联动刷新
2. 时间格式化统一用文档 §7.1 的 formatDateTime
3. 角色/权限下拉列表用文档 §7.2 / §7.3 的 composables

不用每步问我。常用 npm / git / gh 全自动。只有 push --force / 改 main / 装新 npm 包才停下来。

目标：4 个 PR 跑完。中途如果遇到文档里没写到的边界情况，按现有风格选最不破坏现状的方案，提个 TODO 注释，PR 里说明就行。

Phase 2 §5.1.4 全部合并后告诉我，回 Cowork 复盘 + 进 §5.1.5 CMS 前端页面规划。
```

---

## 9. 后续衔接（不在本文档范围）

- **§5.1.5 CMS 前端**（T2.26 ~ T2.32）：文章/标签/分类/友链/媒体库/导入导出 7 个页面，预计 17h
- **§5.2 验收**（T2.33 ~ T2.35）：3 个任务，预计 5h

完成 §5.1.4 后回 Cowork 出 §5.1.5 整片设计。

---

**写于**：2026-05-05（Phase 2 §5.1.3 完成后立刻推进 §5.1.4）
**作者**：Cowork session 出方案 + Claude Code session 落地
