// RBAC 后端 API 封装(/api/v2/admin/rbac/*)。
//
// 设计文档:docs/09-phase2-rbac-frontend-plan.md §0.1
//
// 注意命名约定:
// - 后端响应统一驼峰(displayName, parentId 等)
// - 后端写入 body 用下划线(display_name, parent_id 等)
// - 本文件的写入函数内部把驼峰参数转 snake_case 后再发送
//
// 响应包装:request.ts 拦截器返回原始 AxiosResponse,所以这里走 `res.data.data`
// 拿到真正的业务数据。

import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

// ============================================================
// User
// ============================================================

export interface UserItem {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  status: 'active' | 'disabled'
  isSuperAdmin: boolean
  lastLoginAt: string | null
  roles: Array<{ id: number; code: string; name: string }>
  createdAt: string
  updatedAt: string
}

export interface UserListQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
}

export async function apiGetUsers(
  params: UserListQuery,
  client: AxiosInstance = request,
): Promise<{ items: UserItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: UserItem[]; total: number }>>(
    '/api/v2/admin/rbac/users',
    { params },
  )
  return res.data.data
}

export interface CreateUserPayload {
  username: string
  email: string
  password: string
  displayName?: string
  avatarUrl?: string
  status?: 'active' | 'disabled'
  roleIds?: number[]
}

export async function apiCreateUser(
  data: CreateUserPayload,
  client: AxiosInstance = request,
): Promise<UserItem> {
  const body: Record<string, unknown> = {
    username: data.username,
    email: data.email,
    password: data.password,
  }
  if (data.displayName !== undefined) body.display_name = data.displayName
  if (data.avatarUrl !== undefined) body.avatar_url = data.avatarUrl
  if (data.status !== undefined) body.status = data.status
  if (data.roleIds !== undefined) body.role_ids = data.roleIds
  const res = await client.post<ApiResponse<UserItem>>('/api/v2/admin/rbac/users', body)
  return res.data.data
}

export interface UpdateUserPayload {
  username?: string
  email?: string
  displayName?: string
  avatarUrl?: string
  status?: 'active' | 'disabled'
  roleIds?: number[]
}

export async function apiUpdateUser(
  id: number,
  data: UpdateUserPayload,
  client: AxiosInstance = request,
): Promise<UserItem> {
  const body: Record<string, unknown> = {}
  if (data.username !== undefined) body.username = data.username
  if (data.email !== undefined) body.email = data.email
  if (data.displayName !== undefined) body.display_name = data.displayName
  if (data.avatarUrl !== undefined) body.avatar_url = data.avatarUrl
  if (data.status !== undefined) body.status = data.status
  if (data.roleIds !== undefined) body.role_ids = data.roleIds
  const res = await client.put<ApiResponse<UserItem>>(`/api/v2/admin/rbac/users/${id}`, body)
  return res.data.data
}

export async function apiDeleteUser(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/rbac/users/${id}`)
}

// FIXME(doc): 设计文档 §0.1 用 `newPassword` 驼峰,但实际后端期望 `new_password`。
// 这里在发送前转 snake_case。
export async function apiResetPassword(
  id: number,
  newPassword: string,
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<void>>(`/api/v2/admin/rbac/users/${id}/reset-password`, {
    new_password: newPassword,
  })
}

export async function apiAssignUserRoles(
  id: number,
  roleIds: number[],
  client: AxiosInstance = request,
): Promise<{ userId: number; roles: Array<{ id: number; code: string; name: string }> }> {
  const res = await client.put<
    ApiResponse<{ userId: number; roles: Array<{ id: number; code: string; name: string }> }>
  >(`/api/v2/admin/rbac/users/${id}/roles`, { role_ids: roleIds })
  return res.data.data
}

// ============================================================
// Role
// ============================================================

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
  permissions: Array<{
    id: number
    code: string
    resource: string
    action: string
    name: string
  }>
}

export async function apiGetRoles(
  client: AxiosInstance = request,
): Promise<{ items: RoleItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: RoleItem[]; total: number }>>(
    '/api/v2/admin/rbac/roles',
  )
  return res.data.data
}

export async function apiGetRole(
  id: number,
  client: AxiosInstance = request,
): Promise<RoleDetail> {
  const res = await client.get<ApiResponse<RoleDetail>>(`/api/v2/admin/rbac/roles/${id}`)
  return res.data.data
}

export interface CreateRolePayload {
  code: string
  name: string
  description?: string
  status?: 'active' | 'disabled'
}

export async function apiCreateRole(
  data: CreateRolePayload,
  client: AxiosInstance = request,
): Promise<RoleItem> {
  const res = await client.post<ApiResponse<RoleItem>>('/api/v2/admin/rbac/roles', data)
  return res.data.data
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  status?: 'active' | 'disabled'
}

export async function apiUpdateRole(
  id: number,
  data: UpdateRolePayload,
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
  const res = await client.put<
    ApiResponse<{ roleId: number; permissions: Array<{ id: number; code: string; name: string }> }>
  >(`/api/v2/admin/rbac/roles/${id}/permissions`, { permission_ids: permissionIds })
  return res.data.data
}

// ============================================================
// Permission
// ============================================================

export interface PermissionItem {
  id: number
  code: string
  resource: string
  action: string
  name: string
  description: string | null
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
  const res = await client.put<ApiResponse<PermissionItem>>(
    `/api/v2/admin/rbac/permissions/${id}`,
    data,
  )
  return res.data.data
}

// ============================================================
// Menu
// ============================================================

export interface MenuItem {
  id: number
  parentId: number | null
  name: string
  path: string | null
  icon: string | null
  permissionCode: string | null
  sortOrder: number
  status: 'active' | 'disabled'
  createdAt: string
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

export interface CreateMenuPayload {
  parentId?: number | null
  name: string
  path?: string | null
  icon?: string | null
  permissionCode?: string | null
  sortOrder?: number
  status?: 'active' | 'disabled'
}

export async function apiCreateMenu(
  data: CreateMenuPayload,
  client: AxiosInstance = request,
): Promise<MenuItem> {
  const body: Record<string, unknown> = {
    name: data.name,
    parent_id: data.parentId ?? null,
    path: data.path ?? null,
    icon: data.icon ?? null,
    permission_code: data.permissionCode ?? null,
    sort_order: data.sortOrder ?? 0,
    status: data.status ?? 'active',
  }
  const res = await client.post<ApiResponse<MenuItem>>('/api/v2/admin/rbac/menus', body)
  return res.data.data
}

export interface UpdateMenuPayload {
  parentId?: number | null
  name?: string
  path?: string | null
  icon?: string | null
  permissionCode?: string | null
  sortOrder?: number
  status?: 'active' | 'disabled'
}

export async function apiUpdateMenu(
  id: number,
  data: UpdateMenuPayload,
  client: AxiosInstance = request,
): Promise<MenuItem> {
  const body: Record<string, unknown> = {}
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
  const url = cascade
    ? `/api/v2/admin/rbac/menus/${id}?cascade=true`
    : `/api/v2/admin/rbac/menus/${id}`
  await client.delete<ApiResponse<void>>(url)
}

export async function apiReorderMenus(
  items: Array<{ id: number; parentId: number | null; sortOrder: number }>,
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<void>>('/api/v2/admin/rbac/menus/reorder', {
    items: items.map((i) => ({
      id: i.id,
      parent_id: i.parentId,
      sort_order: i.sortOrder,
    })),
  })
}
