// Typed wrappers around v2 CMS endpoints (uploads, posts, tags, etc.).
// Mirrors the same pattern as ./auth.ts:
//   apiXxx(...args, client = request) → returns res.data.data
//
// Lets test code inject a mocked AxiosInstance via createRequest({...}).

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
