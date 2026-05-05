import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

export interface DashboardStats {
  postCount: number
  tagCount: number
  categoryCount: number
  todayPv: number
  todayUv: number
}

export interface TrendData {
  labels: string[]
  pv: number[]
  uv: number[]
}

export interface TopPostItem {
  title: string
  slug: string
  viewCount: number
}

export interface DistributionData {
  tags: Array<{ name: string; count: number }>
  categories: Array<{ name: string; count: number }>
}

export async function apiGetDashboardStats(
  client: AxiosInstance = request,
): Promise<DashboardStats> {
  const res = await client.get<ApiResponse<DashboardStats>>('/api/v2/admin/analytics/dashboard')
  return res.data.data
}

export async function apiGetTrend(
  days = 7,
  client: AxiosInstance = request,
): Promise<TrendData> {
  const res = await client.get<ApiResponse<TrendData>>('/api/v2/admin/analytics/trend', {
    params: { days },
  })
  return res.data.data
}

export async function apiGetTopPosts(
  limit = 10,
  client: AxiosInstance = request,
): Promise<{ items: TopPostItem[] }> {
  const res = await client.get<ApiResponse<{ items: TopPostItem[] }>>('/api/v2/admin/analytics/posts', {
    params: { limit },
  })
  return res.data.data
}

export async function apiGetDistribution(
  client: AxiosInstance = request,
): Promise<DistributionData> {
  const res = await client.get<ApiResponse<DistributionData>>('/api/v2/admin/analytics/distribution')
  return res.data.data
}
