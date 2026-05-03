// Typed wrappers around the v2 admin auth endpoints. Built on the shared
// `request` axios instance from ./request.ts so they pick up the Bearer
// header + 401 auto-refresh interceptor.

import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

export interface UserInfo {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  isSuperAdmin: boolean
  roles: string[]
}

export interface LoginResponseData {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export interface MeResponseData {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  isSuperAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  roles: Array<{ id: number; code: string; name: string }>
  permissions: string[]
}

export interface MenuNode {
  id: number
  parent_id: number | null
  name: string
  path: string | null
  icon: string | null
  permission_code: string | null
  sort_order: number
  children: MenuNode[]
}

// Each call accepts an optional axios instance so tests can pass a
// mock-server-bound client built via createRequest({...}).
export async function apiLogin(
  email: string,
  password: string,
  client: AxiosInstance = request,
): Promise<LoginResponseData> {
  const res = await client.post<ApiResponse<LoginResponseData>>(
    '/api/v2/auth/login',
    { email, password },
  )
  return res.data.data
}

export async function apiLogout(
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<{ loggedOut: boolean }>>('/api/v2/auth/logout')
}

export async function apiMe(
  client: AxiosInstance = request,
): Promise<MeResponseData> {
  const res = await client.get<ApiResponse<MeResponseData>>('/api/v2/auth/me')
  return res.data.data
}

export async function apiMenus(
  client: AxiosInstance = request,
): Promise<MenuNode[]> {
  const res = await client.get<ApiResponse<MenuNode[]>>('/api/v2/auth/menus')
  return res.data.data
}
