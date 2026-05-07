import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

// ============================================================
// Document
// ============================================================

export interface KbDocumentListItem {
  id: number
  title: string
  slug: string
  excerpt: string | null
  source: 'obsidian' | 'manual' | 'api'
  tags: string[]
  status: 'active' | 'archived'
  word_count: number
  created_at: string
  updated_at: string
}

export interface KbDocumentDetail extends KbDocumentListItem {
  content_markdown: string
  content_html: string | null
  original_path: string | null
  checksum: string | null
}

export interface KbDocumentQuery {
  search?: string
  contentSearch?: boolean
  source?: string
  status?: string
  tag?: string
  sortBy?: 'updated_at' | 'created_at' | 'title' | 'word_count'
  sortDir?: 'asc' | 'desc'
}

export async function apiListKbDocuments(
  params: KbDocumentQuery & { page: number; pageSize: number },
  client: AxiosInstance = request,
): Promise<{ items: KbDocumentListItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<ApiResponse<{ items: KbDocumentListItem[]; total: number; page: number; pageSize: number }>>(
    '/api/v2/admin/kb/documents',
    { params },
  )
  return res.data.data
}

export async function apiGetKbDocument(
  id: number,
  client: AxiosInstance = request,
): Promise<KbDocumentDetail> {
  const res = await client.get<ApiResponse<KbDocumentDetail>>(`/api/v2/admin/kb/documents/${id}`)
  return res.data.data
}

export interface CreateKbDocumentPayload {
  title: string
  slug?: string
  excerpt?: string
  content_markdown?: string
  tags?: string[]
}

export async function apiCreateKbDocument(
  data: CreateKbDocumentPayload,
  client: AxiosInstance = request,
): Promise<KbDocumentDetail> {
  const res = await client.post<ApiResponse<KbDocumentDetail>>('/api/v2/admin/kb/documents', data)
  return res.data.data
}

export interface UpdateKbDocumentPayload {
  title?: string
  slug?: string
  excerpt?: string
  content_markdown?: string
  tags?: string[]
  source?: string
  status?: string
}

export async function apiUpdateKbDocument(
  id: number,
  data: UpdateKbDocumentPayload,
  client: AxiosInstance = request,
): Promise<KbDocumentDetail> {
  const res = await client.put<ApiResponse<KbDocumentDetail>>(`/api/v2/admin/kb/documents/${id}`, data)
  return res.data.data
}

export async function apiDeleteKbDocument(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/documents/${id}`)
}

// ============================================================
// Publish
// ============================================================

export interface PreviewResult {
  html: string
  word_count: number
  document: { id: number; title: string; slug: string }
}

export interface KbDocumentPost {
  id: number
  document_id: number
  post_id: number
  sync_enabled: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface PublishResult {
  post: {
    id: number
    title: string
    slug: string
    excerpt: string | null
    coverImageUrl: string | null
    contentMarkdown: string
    status: string
    publishedAt: string | null
    createdAt: string
    updatedAt: string
    tags: Array<{ name: string; slug: string }>
    categories: Array<{ name: string; slug: string }>
  }
  mapping: KbDocumentPost | null
}

export interface PublishBody {
  title?: string
  slug?: string
  excerpt?: string
  coverImageUrl?: string
  tags?: string[]
  categories?: string[]
  publishNow?: boolean
  syncEnabled?: boolean
}

export async function apiPreviewDocument(
  id: number,
  client: AxiosInstance = request,
): Promise<PreviewResult> {
  const res = await client.post<ApiResponse<PreviewResult>>(`/api/v2/admin/kb/documents/${id}/preview`)
  return res.data.data
}

export async function apiPublishDocument(
  id: number,
  data: PublishBody,
  client: AxiosInstance = request,
): Promise<PublishResult> {
  const res = await client.post<ApiResponse<PublishResult>>(`/api/v2/admin/kb/documents/${id}/publish`, data)
  return res.data.data
}

export async function apiListDocumentPosts(
  params: { page?: number; pageSize?: number },
  client: AxiosInstance = request,
): Promise<{ items: KbDocumentPost[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<ApiResponse<{ items: KbDocumentPost[]; total: number; page: number; pageSize: number }>>(
    '/api/v2/admin/kb/document-posts',
    { params },
  )
  return res.data.data
}

export async function apiUpdateDocumentPost(
  id: number,
  data: { syncEnabled?: boolean },
  client: AxiosInstance = request,
): Promise<KbDocumentPost> {
  const res = await client.put<ApiResponse<KbDocumentPost>>(`/api/v2/admin/kb/document-posts/${id}`, data)
  return res.data.data
}

export async function apiDeleteDocumentPost(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/document-posts/${id}`)
}

// ============================================================
// Canvas
// ============================================================

export interface CanvasNode {
  id: number
  canvas_id: number
  type: string
  label: string
  content: string
  x: number
  y: number
  width: number
  height: number
  color: string
  metadata: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CanvasEdge {
  id: number
  canvas_id: number
  source_node_id: number
  target_node_id: number
  label: string
  style: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CanvasListItem {
  id: number
  title: string
  description: string | null
  zoom: number
  pan_x: number
  pan_y: number
  grid_visible: boolean
  node_count: number
  edge_count: number
  created_at: string
  updated_at: string
}

export interface CanvasData extends CanvasListItem {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export async function apiListCanvases(
  client: AxiosInstance = request,
): Promise<{ items: CanvasListItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: CanvasListItem[]; total: number }>>('/api/v2/admin/kb/canvases')
  return res.data.data
}

export async function apiGetCanvas(
  id: number,
  client: AxiosInstance = request,
): Promise<CanvasData> {
  const res = await client.get<ApiResponse<CanvasData>>(`/api/v2/admin/kb/canvases/${id}`)
  return res.data.data
}

export interface CreateCanvasPayload {
  title: string
  description?: string
}

export async function apiCreateCanvas(
  data: CreateCanvasPayload,
  client: AxiosInstance = request,
): Promise<CanvasListItem> {
  const res = await client.post<ApiResponse<CanvasListItem>>('/api/v2/admin/kb/canvases', data)
  return res.data.data
}

export interface UpdateCanvasPayload {
  title?: string
  description?: string
  zoom?: number
  pan_x?: number
  pan_y?: number
  grid_visible?: boolean
}

export async function apiUpdateCanvas(
  id: number,
  data: UpdateCanvasPayload,
  client: AxiosInstance = request,
): Promise<CanvasListItem> {
  const res = await client.put<ApiResponse<CanvasListItem>>(`/api/v2/admin/kb/canvases/${id}`, data)
  return res.data.data
}

export async function apiDeleteCanvas(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/canvases/${id}`)
}

export interface CreateNodePayload {
  type?: string
  label: string
  content?: string
  x?: number
  y?: number
  width?: number
  height?: number
  color?: string
  metadata?: Record<string, unknown>
}

export async function apiAddCanvasNode(
  canvasId: number,
  data: CreateNodePayload,
  client: AxiosInstance = request,
): Promise<CanvasNode> {
  const res = await client.post<ApiResponse<CanvasNode>>(`/api/v2/admin/kb/canvases/${canvasId}/nodes`, data)
  return res.data.data
}

export interface UpdateNodePayload {
  type?: string
  label?: string
  content?: string
  x?: number
  y?: number
  width?: number
  height?: number
  color?: string
  metadata?: Record<string, unknown>
}

export async function apiUpdateCanvasNode(
  canvasId: number,
  nodeId: number,
  data: UpdateNodePayload,
  client: AxiosInstance = request,
): Promise<CanvasNode> {
  const res = await client.put<ApiResponse<CanvasNode>>(`/api/v2/admin/kb/canvases/${canvasId}/nodes/${nodeId}`, data)
  return res.data.data
}

export async function apiDeleteCanvasNode(
  canvasId: number,
  nodeId: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/canvases/${canvasId}/nodes/${nodeId}`)
}

export interface CreateEdgePayload {
  source_node_id: number
  target_node_id: number
  label?: string
  style?: Record<string, unknown>
}

export async function apiAddCanvasEdge(
  canvasId: number,
  data: CreateEdgePayload,
  client: AxiosInstance = request,
): Promise<CanvasEdge> {
  const res = await client.post<ApiResponse<CanvasEdge>>(`/api/v2/admin/kb/canvases/${canvasId}/edges`, data)
  return res.data.data
}

export interface UpdateEdgePayload {
  label?: string
  style?: Record<string, unknown>
}

export async function apiUpdateCanvasEdge(
  canvasId: number,
  edgeId: number,
  data: UpdateEdgePayload,
  client: AxiosInstance = request,
): Promise<CanvasEdge> {
  const res = await client.put<ApiResponse<CanvasEdge>>(`/api/v2/admin/kb/canvases/${canvasId}/edges/${edgeId}`, data)
  return res.data.data
}

export async function apiDeleteCanvasEdge(
  canvasId: number,
  edgeId: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/canvases/${canvasId}/edges/${edgeId}`)
}

// ============================================================
// Sync
// ============================================================

export interface SyncConfig {
  vault_path: string
  auto_sync_enabled: boolean
  sync_interval_minutes: number
  conflict_strategy: 'last_write_wins' | 'keep_both' | 'skip'
  last_sync_at: string | null
}

export interface SyncStatus {
  running: boolean
  last_sync_at: string | null
  last_result: { imported: number; skipped: number; conflicted: number; errors: number } | null
}

export interface SyncLogEntry {
  id: number
  direction: 'import' | 'export'
  file_path: string | null
  document_id: number | null
  status: 'success' | 'skipped' | 'conflict' | 'error'
  checksum: string | null
  detail: string | null
  created_at: string
}

export async function apiGetSyncConfig(client: AxiosInstance = request): Promise<SyncConfig> {
  const res = await client.get<ApiResponse<SyncConfig>>('/api/v2/admin/kb/sync/config')
  return res.data.data
}

export interface UpdateSyncConfigPayload {
  vault_path?: string
  auto_sync_enabled?: boolean
  sync_interval_minutes?: number
  conflict_strategy?: 'last_write_wins' | 'keep_both' | 'skip'
}

export async function apiUpdateSyncConfig(
  data: UpdateSyncConfigPayload,
  client: AxiosInstance = request,
): Promise<SyncConfig> {
  const res = await client.put<ApiResponse<SyncConfig>>('/api/v2/admin/kb/sync/config', data)
  return res.data.data
}

export async function apiTriggerSyncImport(client: AxiosInstance = request): Promise<{ status: string }> {
  const res = await client.post<ApiResponse<{ status: string }>>('/api/v2/admin/kb/sync/trigger-import')
  return res.data.data
}

export async function apiTriggerSyncExport(client: AxiosInstance = request): Promise<{ status: string }> {
  const res = await client.post<ApiResponse<{ status: string }>>('/api/v2/admin/kb/sync/trigger-export')
  return res.data.data
}

export interface TestConnectionResult {
  ok: boolean
  message: string
  path?: string
  mdCount?: number
  totalSize?: number
  dbName?: string
  docCount?: number
}

export async function apiTestFilesystem(client: AxiosInstance = request): Promise<TestConnectionResult> {
  const res = await client.post<ApiResponse<TestConnectionResult>>('/api/v2/admin/kb/sync/test-filesystem')
  return res.data.data
}

export async function apiListSyncLogs(
  params: { page: number; pageSize: number; direction?: string; status?: string; since?: string },
  client: AxiosInstance = request,
): Promise<{ items: SyncLogEntry[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<ApiResponse<{ items: SyncLogEntry[]; total: number; page: number; pageSize: number }>>(
    '/api/v2/admin/kb/sync/logs',
    { params },
  )
  return res.data.data
}

export async function apiGetSyncStatus(client: AxiosInstance = request): Promise<SyncStatus> {
  const res = await client.get<ApiResponse<SyncStatus>>('/api/v2/admin/kb/sync/status')
  return res.data.data
}

// ============================================================
// File Tree
// ============================================================

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  size?: number
  checksum?: string | null
  documentId?: number | null
  status?: 'synced' | 'skipped' | 'conflict' | 'error' | null
  syncedAt?: string | null
  title?: string
  detail?: string | null
}

export interface FileTreeData {
  source: string
  tree: FileTreeNode[]
  fileCount: number
  error?: string
  stats?: { total: number; active: number; archived: number }
}

export async function apiGetRemoteFiles(client: AxiosInstance = request): Promise<FileTreeData> {
  const res = await client.get<ApiResponse<FileTreeData>>('/api/v2/admin/kb/sync/remote-files')
  return res.data.data
}

export async function apiGetSyncedFiles(client: AxiosInstance = request): Promise<FileTreeData> {
  const res = await client.get<ApiResponse<FileTreeData>>('/api/v2/admin/kb/sync/synced-files')
  return res.data.data
}
