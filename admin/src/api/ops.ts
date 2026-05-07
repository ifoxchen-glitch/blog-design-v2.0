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

export interface AuditLogStats {
  todayCount: number
  actionDistribution: { action: string; count: number }[]
  topUsers: { username: string; count: number }[]
}

export async function apiGetAuditLogStats(
  client: AxiosInstance = request,
): Promise<AuditLogStats> {
  const res = await client.get<ApiResponse<AuditLogStats>>('/api/v2/admin/ops/audit-logs/stats')
  return res.data.data
}

export interface BackupItem {
  id: number
  filename: string
  size: number
  type: 'manual' | 'scheduled'
  status: 'ok' | 'failed' | 'restored'
  note: string | null
  createdAt: string
}

export interface BackupQuery {
  page: number
  pageSize: number
  type?: string
  status?: string
}

export async function apiGetBackups(
  params: BackupQuery,
  client: AxiosInstance = request,
): Promise<{ items: BackupItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<
    ApiResponse<{ items: BackupItem[]; total: number; page: number; pageSize: number }>
  >('/api/v2/admin/ops/backups', { params })
  return res.data.data
}

export async function apiCreateBackup(
  note?: string,
  client: AxiosInstance = request,
): Promise<BackupItem> {
  const res = await client.post<ApiResponse<BackupItem>>('/api/v2/admin/ops/backup', { note })
  return res.data.data
}

export async function apiDownloadBackup(
  id: number,
  client: AxiosInstance = request,
): Promise<Blob> {
  const res = await client.get<Blob>(`/api/v2/admin/ops/backups/${id}/download`, {
    responseType: 'blob',
  })
  return res.data
}

export async function apiDeleteBackup(id: number, client: AxiosInstance = request): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/ops/backups/${id}`)
}

export async function apiRestoreBackup(
  id: number,
  client: AxiosInstance = request,
): Promise<{ snapshotId: number; restoredFrom: string }> {
  const res = await client.post<ApiResponse<{ snapshotId: number; restoredFrom: string }>>(
    `/api/v2/admin/ops/backups/${id}/restore`,
  )
  return res.data.data
}

export async function apiImportBackup(
  file: File,
  note?: string,
  client: AxiosInstance = request,
): Promise<BackupItem> {
  const form = new FormData()
  form.append('file', file)
  if (note) form.append('note', note)
  const res = await client.post<ApiResponse<BackupItem>>('/api/v2/admin/ops/backups/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export interface BackupSchedule {
  id: number
  name: string
  cron: string
  enabled: number
  timezone: string
  keepCount: number
  createdAt: string
  updatedAt: string
}

export async function apiGetBackupSchedule(
  client: AxiosInstance = request,
): Promise<BackupSchedule | null> {
  const res = await client.get<ApiResponse<BackupSchedule | null>>('/api/v2/admin/ops/backup-schedule')
  return res.data.data
}

export async function apiSetBackupSchedule(
  data: {
    name?: string
    cron: string
    enabled: boolean
    timezone?: string
    keepCount?: number
  },
  client: AxiosInstance = request,
): Promise<BackupSchedule> {
  const res = await client.put<ApiResponse<BackupSchedule>>('/api/v2/admin/ops/backup-schedule', data)
  return res.data.data
}

export interface MonitorData {
  cpu: { usage: number }
  memory: { total: number; used: number; usage: number }
  disk: { total: number; used: number; usage: number }
  uptime: number
  dbSize: number
  activeUsers: number
}

export async function apiGetMonitor(
  client: AxiosInstance = request,
): Promise<MonitorData> {
  const res = await client.get<ApiResponse<MonitorData>>('/api/v2/admin/ops/monitor')
  return res.data.data
}
