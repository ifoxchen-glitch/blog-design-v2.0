// CMS 后端 API 封装(/api/v2/admin/cms/*)。
//
// 设计文档:docs/10-phase2-cms-frontend-plan.md §0.1
//
// 偏离设计文档之处:
// (P8) 设计文档 §0.1 写 list API 返回 `{ list, total }`;后端真实返回是 `{ items, total }`,
//      与 rbac.ts 一致。这里沿用 `{ items, total }`,view 里包一层把 items→list 转给 useTable。
// (P4) apiUpload 字段名要发 'image'(对齐后端 multer.single("image")),
//      不是设计文档默认的 'file'。T2.27 PR 修复。
//
// 响应包装:request.ts 拦截器返回原始 AxiosResponse,所以这里走 `res.data.data`
// 拿到真正的业务数据。

import { request, type ApiResponse } from './request'
import type { AxiosInstance, AxiosProgressEvent } from 'axios'

export interface UploadResultData {
  url: string
  filename?: string
  size?: number
  mimeType?: string
}

export interface UploadOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Upload a single image to /api/v2/admin/cms/upload.
 *
 * Returns the backend `data` block — typically `{ url }`.
 * Progress callback receives an integer 0-100.
 */
export async function apiUpload(
  file: File,
  options: UploadOptions = {},
  client: AxiosInstance = request,
): Promise<UploadResultData> {
  const form = new FormData()
  form.append('file', file)

  const res = await client.post<ApiResponse<UploadResultData>>(
    '/api/v2/admin/cms/upload',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options.signal,
      onUploadProgress: (evt: AxiosProgressEvent) => {
        if (!options.onProgress || !evt.total) return
        const percent = Math.round((evt.loaded * 100) / evt.total)
        options.onProgress(percent)
      },
    },
  )
  return res.data.data
}

// ============================================================
// Tag
// ============================================================

export interface TagItem {
  id: number
  name: string
  slug: string
  postCount: number
  createdAt: string
}

export async function apiGetTags(
  client: AxiosInstance = request,
): Promise<{ items: TagItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: TagItem[]; total: number }>>(
    '/api/v2/admin/cms/tags',
  )
  return res.data.data
}

export interface CreateTagPayload {
  name: string
  slug?: string
}

export async function apiCreateTag(
  data: CreateTagPayload,
  client: AxiosInstance = request,
): Promise<TagItem> {
  const body: Record<string, unknown> = { name: data.name }
  if (data.slug !== undefined) body.slug = data.slug
  const res = await client.post<ApiResponse<TagItem>>('/api/v2/admin/cms/tags', body)
  return res.data.data
}

export interface UpdateTagPayload {
  name?: string
  slug?: string
}

export async function apiUpdateTag(
  id: number,
  data: UpdateTagPayload,
  client: AxiosInstance = request,
): Promise<TagItem> {
  const body: Record<string, unknown> = {}
  if (data.name !== undefined) body.name = data.name
  if (data.slug !== undefined) body.slug = data.slug
  const res = await client.put<ApiResponse<TagItem>>(`/api/v2/admin/cms/tags/${id}`, body)
  return res.data.data
}

export async function apiDeleteTag(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/tags/${id}`)
}
