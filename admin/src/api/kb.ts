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
  category: string | null
  doc_type: 'entity' | 'concept' | 'source' | 'synthesis' | null
  doc_date: string | null
  review_status: 'seed' | 'developing' | 'mature' | null
  word_count: number
  created_at: string
  updated_at: string
}

export interface KbDocumentDetail extends KbDocumentListItem {
  content_markdown: string
  content_html: string | null
  original_path: string | null
  checksum: string | null
  connections: string[]
  sources: string[]
}

export interface KbDocumentQuery {
  search?: string
  contentSearch?: boolean
  source?: string
  status?: string
  tag?: string
  category?: string
  review_status?: string
  sortBy?: string
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

export async function apiListKbDocumentCategories(
  client: AxiosInstance = request,
): Promise<string[]> {
  const res = await client.get<ApiResponse<string[]>>('/api/v2/admin/kb/documents/categories')
  return res.data.data
}

export async function apiGetKbDocument(
  id: number,
  client: AxiosInstance = request,
): Promise<KbDocumentDetail> {
  const res = await client.get<ApiResponse<KbDocumentDetail>>(`/api/v2/admin/kb/documents/${id}`)
  return res.data.data
}

export interface KbGraphNode {
  id: string
  title: string
  slug: string
  category: string | null
  doc_type: string | null
  review_status: string | null
  tags: string[]
  excerpt: string | null
  color: string
}

export interface KbGraphEdge {
  source: string
  target: string
  label: string
}

export interface KbGraphData {
  nodes: KbGraphNode[]
  edges: KbGraphEdge[]
}

export async function apiGetKbGraph(client: AxiosInstance = request): Promise<KbGraphData> {
  const res = await client.get<ApiResponse<KbGraphData>>('/api/v2/admin/kb/documents/graph')
  return res.data.data
}

export interface CreateKbDocumentPayload {
  title: string
  slug?: string
  excerpt?: string
  content_markdown?: string
  tags?: string[]
  category?: string
  doc_type?: string
  connections?: string[]
  sources?: string[]
  doc_date?: string
  review_status?: string
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
  category?: string
  doc_type?: string
  connections?: string[]
  sources?: string[]
  doc_date?: string
  review_status?: string
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
  selected_paths: string[]
}

export interface SyncStatus {
  running: boolean
  last_sync_at: string | null
  last_result: {
    imported: number
    skipped: number
    conflicted: number
    errors: number
    exported: number
    export_skipped: number
    export_failed: number
  } | null
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
  selected_paths?: string[]
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

export async function apiClearSyncedData(client: AxiosInstance = request): Promise<{ documentsDeleted: number; logsDeleted: number }> {
  const res = await client.delete<ApiResponse<{ documentsDeleted: number; logsDeleted: number }>>('/api/v2/admin/kb/sync/clear')
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

// ============================================================
// AI Models
// ============================================================

export interface AiModel {
  id: number
  name: string
  provider: 'openai' | 'anthropic' | 'ollama' | 'groq' | 'custom'
  api_endpoint: string
  api_key: string
  has_api_key: boolean
  model_name: string
  max_tokens: number
  temperature: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export async function apiListAiModels(client: AxiosInstance = request): Promise<AiModel[]> {
  const res = await client.get<ApiResponse<AiModel[]>>('/api/v2/admin/kb/models')
  return res.data.data
}

export interface CreateAiModelPayload {
  name: string
  provider: AiModel['provider']
  api_endpoint: string
  api_key: string
  model_name: string
  max_tokens?: number
  temperature?: number
  is_default?: boolean
  is_active?: boolean
  sort_order?: number
}

export async function apiCreateAiModel(data: CreateAiModelPayload, client: AxiosInstance = request): Promise<AiModel> {
  const res = await client.post<ApiResponse<AiModel>>('/api/v2/admin/kb/models', data)
  return res.data.data
}

export interface UpdateAiModelPayload {
  name?: string
  provider?: AiModel['provider']
  api_endpoint?: string
  api_key?: string
  model_name?: string
  max_tokens?: number
  temperature?: number
  is_default?: boolean
  is_active?: boolean
  sort_order?: number
}

export async function apiUpdateAiModel(id: number, data: UpdateAiModelPayload, client: AxiosInstance = request): Promise<AiModel> {
  const res = await client.put<ApiResponse<AiModel>>(`/api/v2/admin/kb/models/${id}`, data)
  return res.data.data
}

export async function apiDeleteAiModel(id: number, client: AxiosInstance = request): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/models/${id}`)
}

export interface TestModelResult { ok: boolean; response?: string; error?: string }

export async function apiTestAiModel(id: number, client: AxiosInstance = request): Promise<TestModelResult> {
  const res = await client.post<ApiResponse<TestModelResult>>(`/api/v2/admin/kb/models/${id}/test`)
  return res.data.data
}

// ============================================================
// AI Conversations
// ============================================================

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  provider?: string
}

export interface AiConversation {
  id: number
  title: string
  model: string
  message_count: number
  tokens_used: number
  tags: string[]
  is_starred: boolean
  created_at: string
  updated_at: string
  messages?: AiMessage[]
}

export async function apiListAiConversations(
  params?: { search?: string; model?: string; starred?: boolean; limit?: number; offset?: number },
  client: AxiosInstance = request,
): Promise<{ items: AiConversation[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: AiConversation[]; total: number }>>(
    '/api/v2/admin/kb/conversations', { params }
  )
  return res.data.data
}

export async function apiCreateAiConversation(
  data?: { title?: string; model?: string; tags?: string[] },
  client: AxiosInstance = request,
): Promise<AiConversation> {
  const res = await client.post<ApiResponse<AiConversation>>('/api/v2/admin/kb/conversations', data || {})
  return res.data.data
}

export async function apiGetAiConversation(id: number, client: AxiosInstance = request): Promise<AiConversation> {
  const res = await client.get<ApiResponse<AiConversation>>(`/api/v2/admin/kb/conversations/${id}`)
  return res.data.data
}

export interface UpdateAiConversationPayload {
  title?: string
  model?: string
  tags?: string[]
  is_starred?: boolean
}

export async function apiUpdateAiConversation(
  id: number, data: UpdateAiConversationPayload, client: AxiosInstance = request
): Promise<AiConversation> {
  const res = await client.put<ApiResponse<AiConversation>>(`/api/v2/admin/kb/conversations/${id}`, data)
  return res.data.data
}

export async function apiDeleteAiConversation(id: number, client: AxiosInstance = request): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/conversations/${id}`)
}

export interface SendAiMessagePayload {
  content: string
  temperature?: number
}

export async function apiSendAiMessage(
  conversationId: number, data: SendAiMessagePayload, client: AxiosInstance = request
): Promise<AiMessage> {
  const res = await client.post<ApiResponse<AiMessage>>(
    `/api/v2/admin/kb/conversations/${conversationId}/messages`, data
  )
  return res.data.data
}

export async function apiSaveAiConversationToKb(
  conversationId: number, client: AxiosInstance = request
): Promise<{ path: string }> {
  const res = await client.post<ApiResponse<{ path: string }>>(
    `/api/v2/admin/kb/conversations/${conversationId}/save-to-kb`
  )
  return res.data.data
}

// ============================================================
// Tasks (Kanban)
// ============================================================

export interface KbTask {
  id: number
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: number
  due_date: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export async function apiListKbTasks(
  params?: { status?: KbTask['status'] }, client: AxiosInstance = request
): Promise<KbTask[]> {
  const res = await client.get<ApiResponse<KbTask[]>>('/api/v2/admin/kb/tasks', { params })
  return res.data.data
}

export async function apiCreateKbTask(
  data: { title: string; description?: string; status?: KbTask['status']; priority?: number; due_date?: string; tags?: string[] },
  client: AxiosInstance = request,
): Promise<KbTask> {
  const res = await client.post<ApiResponse<KbTask>>('/api/v2/admin/kb/tasks', data)
  return res.data.data
}

export async function apiUpdateKbTask(
  id: number,
  data: Partial<Omit<KbTask, 'id' | 'created_at' | 'updated_at'>>,
  client: AxiosInstance = request,
): Promise<KbTask> {
  const res = await client.put<ApiResponse<KbTask>>(`/api/v2/admin/kb/tasks/${id}`, data)
  return res.data.data
}

export async function apiDeleteKbTask(id: number, client: AxiosInstance = request): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/kb/tasks/${id}`)
}

