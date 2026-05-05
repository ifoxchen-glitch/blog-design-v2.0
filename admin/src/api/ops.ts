import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

export interface AuditLogItem {
  id: number
  userId: number | null
  username: string | null
  action: string
  resourceType: string
  resourceId: string | null
  detail: {
    status: number
    body: Record<string, unknown> | null
    query: Record<string, unknown>
    durationMs: number
  } | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface AuditLogQuery {
  page: number
  pageSize: number
  action?: string
  resourceType?: string
  username?: string
  startDate?: string
  endDate?: string
}

export async function apiGetAuditLogs(
  params: AuditLogQuery,
  client: AxiosInstance = request,
): Promise<{ items: AuditLogItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<
    ApiResponse<{ items: AuditLogItem[]; total: number; page: number; pageSize: number }>
  >('/api/v2/admin/ops/audit-logs', { params })
  return res.data.data
}
