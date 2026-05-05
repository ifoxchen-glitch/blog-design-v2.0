// CMS 后端 API 封装(/api/v2/admin/cms/*)。
//
// 设计文档:docs/10-phase2-cms-frontend-plan.md §0.1
//
// 偏离设计文档之处:
// (P8) 设计文档 §0.1 写 list API 返回 `{ list, total }`;后端真实返回是 `{ items, total }`,
//      与 rbac.ts 一致。这里沿用 `{ items, total }`,view 里包一层把 items→list 转给 useTable。
// (P4) apiUpload 字段名要发 'image'(对齐后端 multer.single("image")),
//      不是设计文档默认的 'file'。T2.27 PR 修复(本次)。
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
  form.append('image', file)

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

// ============================================================
// Category
// ============================================================

export interface CategoryItem {
  id: number
  name: string
  slug: string
  postCount: number
  createdAt: string
}

export async function apiGetCategories(
  client: AxiosInstance = request,
): Promise<{ items: CategoryItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: CategoryItem[]; total: number }>>(
    '/api/v2/admin/cms/categories',
  )
  return res.data.data
}

export interface CreateCategoryPayload {
  name: string
  slug?: string
}

export async function apiCreateCategory(
  data: CreateCategoryPayload,
  client: AxiosInstance = request,
): Promise<CategoryItem> {
  const body: Record<string, unknown> = { name: data.name }
  if (data.slug !== undefined) body.slug = data.slug
  const res = await client.post<ApiResponse<CategoryItem>>(
    '/api/v2/admin/cms/categories',
    body,
  )
  return res.data.data
}

export interface UpdateCategoryPayload {
  name?: string
  slug?: string
}

export async function apiUpdateCategory(
  id: number,
  data: UpdateCategoryPayload,
  client: AxiosInstance = request,
): Promise<CategoryItem> {
  const body: Record<string, unknown> = {}
  if (data.name !== undefined) body.name = data.name
  if (data.slug !== undefined) body.slug = data.slug
  const res = await client.put<ApiResponse<CategoryItem>>(
    `/api/v2/admin/cms/categories/${id}`,
    body,
  )
  return res.data.data
}

export async function apiDeleteCategory(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/categories/${id}`)
}

// ============================================================
// Link(友链)
// ============================================================

export type LinkIconSize = '1x1' | '2x1' | '1x2' | '2x2'

export interface LinkItem {
  id: number
  title: string
  url: string
  icon: string
  iconSize: LinkIconSize
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export async function apiGetLinks(
  client: AxiosInstance = request,
): Promise<{ items: LinkItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ items: LinkItem[]; total: number }>>(
    '/api/v2/admin/cms/links',
  )
  return res.data.data
}

export interface CreateLinkPayload {
  title: string
  url: string
  icon?: string
  iconSize?: LinkIconSize
  sortOrder?: number
}

export async function apiCreateLink(
  data: CreateLinkPayload,
  client: AxiosInstance = request,
): Promise<LinkItem> {
  const res = await client.post<ApiResponse<LinkItem>>(
    '/api/v2/admin/cms/links',
    data,
  )
  return res.data.data
}

export interface UpdateLinkPayload {
  title?: string
  url?: string
  icon?: string
  iconSize?: LinkIconSize
  sortOrder?: number
}

export async function apiUpdateLink(
  id: number,
  data: UpdateLinkPayload,
  client: AxiosInstance = request,
): Promise<LinkItem> {
  const res = await client.put<ApiResponse<LinkItem>>(
    `/api/v2/admin/cms/links/${id}`,
    data,
  )
  return res.data.data
}

export async function apiDeleteLink(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/links/${id}`)
}

export async function apiReorderLinks(
  items: Array<{ id: number; sortOrder: number }>,
  client: AxiosInstance = request,
): Promise<{ reordered: number }> {
  const res = await client.post<ApiResponse<{ reordered: number }>>(
    '/api/v2/admin/cms/links/reorder',
    { items },
  )
  return res.data.data
}

// ============================================================
// Post(文章)
// ============================================================

export type PostStatus = 'draft' | 'published'

export interface PostTagRef {
  name: string
  slug: string
}

export interface PostCategoryRef {
  name: string
  slug: string
}

export interface PostListItem {
  id: number
  title: string
  slug: string
  excerpt: string | null
  coverImageUrl: string | null
  status: PostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  tags: PostTagRef[]
  categories: PostCategoryRef[]
}

export interface PostDetail extends PostListItem {
  contentMarkdown: string
}

export interface PostListQuery {
  keyword?: string
  status?: PostStatus
  orderBy?: 'updatedAt' | 'createdAt' | 'publishedAt' | 'title' | 'id'
  order?: 'asc' | 'desc'
}

export async function apiGetPosts(
  params: PostListQuery & { page: number; pageSize: number },
  client: AxiosInstance = request,
): Promise<{ items: PostListItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<
    ApiResponse<{
      items: PostListItem[]
      total: number
      page: number
      pageSize: number
    }>
  >('/api/v2/admin/cms/posts', { params })
  return res.data.data
}

export async function apiGetPost(
  id: number,
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.get<ApiResponse<PostDetail>>(
    `/api/v2/admin/cms/posts/${id}`,
  )
  return res.data.data
}

export interface CreatePostPayload {
  title: string
  slug?: string
  excerpt?: string
  coverImageUrl?: string
  contentMarkdown?: string
  status?: PostStatus
  // 后端 splitTags 接受逗号分隔字符串或数组,这里前端统一传数组
  tags?: string[]
  categories?: string[]
}

export async function apiCreatePost(
  data: CreatePostPayload,
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.post<ApiResponse<PostDetail>>(
    '/api/v2/admin/cms/posts',
    data,
  )
  return res.data.data
}

export interface UpdatePostPayload {
  title?: string
  slug?: string
  excerpt?: string
  coverImageUrl?: string
  contentMarkdown?: string
  tags?: string[]
  categories?: string[]
}

export async function apiUpdatePost(
  id: number,
  data: UpdatePostPayload,
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.put<ApiResponse<PostDetail>>(
    `/api/v2/admin/cms/posts/${id}`,
    data,
  )
  return res.data.data
}

export async function apiDeletePost(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/posts/${id}`)
}

export interface PostStatusResult {
  id: number
  status: PostStatus
  publishedAt?: string | null
  updatedAt: string
}

export async function apiPublishPost(
  id: number,
  client: AxiosInstance = request,
): Promise<PostStatusResult> {
  const res = await client.post<ApiResponse<PostStatusResult>>(
    `/api/v2/admin/cms/posts/${id}/publish`,
  )
  return res.data.data
}

export async function apiUnpublishPost(
  id: number,
  client: AxiosInstance = request,
): Promise<PostStatusResult> {
  const res = await client.post<ApiResponse<PostStatusResult>>(
    `/api/v2/admin/cms/posts/${id}/unpublish`,
  )
  return res.data.data
}
