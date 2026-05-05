// Pure helpers for MarkdownEditor.
//
// Extracted so they can be unit-tested without booting Vditor (which needs DOM).
// - buildUploadConfig: Vditor upload options factory (URL, headers, response transform).
// - transformUploadResponse: maps backend `{code,message,data:{url}}` to Vditor's
//   expected `{msg,code,data:{succMap:{[name]:url}}}` JSON shape.

import type { TokenStore } from '../../api/tokenStorage'

export const UPLOAD_URL = '/api/v2/admin/cms/upload'
// (P4) 对齐后端 multer.single("image"),T2.27 修复。
export const UPLOAD_FIELD_NAME = 'image'
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

interface BackendUploadResponse {
  code: number
  message?: string
  data?: { url?: string }
}

interface VditorUploadOk {
  msg: string
  code: 0
  data: { errFiles: string[]; succMap: Record<string, string> }
}

interface VditorUploadFail {
  msg: string
  code: 1
  data: { errFiles: string[]; succMap: Record<string, string> }
}

/**
 * Convert backend upload response → Vditor's contract.
 *
 * - Backend success: `{code:0,data:{url:'/uploads/xxx.png'}}`
 *   → `{msg:'',code:0,data:{succMap:{[file.name]: url}}}`
 * - Backend error: any non-zero code or missing url
 *   → `{msg:'<message>',code:1,data:{succMap:{}}}`  (Vditor shows msg as toast)
 */
export function transformUploadResponse(files: File[], responseText: string): string {
  let parsed: BackendUploadResponse
  try {
    parsed = JSON.parse(responseText) as BackendUploadResponse
  } catch (e) {
    const fail: VditorUploadFail = {
      msg: '上传响应解析失败',
      code: 1,
      data: { errFiles: files.map((f) => f.name), succMap: {} },
    }
    void e
    return JSON.stringify(fail)
  }

  if (parsed.code !== 0 || !parsed.data?.url) {
    const fail: VditorUploadFail = {
      msg: parsed.message || '上传失败',
      code: 1,
      data: { errFiles: files.map((f) => f.name), succMap: {} },
    }
    return JSON.stringify(fail)
  }

  const succMap: Record<string, string> = {}
  // Single-file upload (backend returns one url per request); map every file name → url.
  for (const f of files) {
    succMap[f.name] = parsed.data.url
  }
  const ok: VditorUploadOk = {
    msg: '',
    code: 0,
    data: { errFiles: [], succMap },
  }
  return JSON.stringify(ok)
}

export interface UploadConfig {
  url: string
  fieldName: string
  max: number
  multiple: boolean
  accept: string
  setHeaders: () => Record<string, string>
  format: (files: File[], responseText: string) => string
}

/**
 * Vditor IUpload-shaped config for our backend.
 *
 * `setHeaders` is called by Vditor before each upload, so token rotation is honored.
 */
export function buildUploadConfig(tokenStore: TokenStore): UploadConfig {
  return {
    url: UPLOAD_URL,
    fieldName: UPLOAD_FIELD_NAME,
    max: UPLOAD_MAX_BYTES,
    multiple: false,
    accept: 'image/*',
    setHeaders: () => {
      const t = tokenStore.getAccess()
      return t ? { Authorization: `Bearer ${t}` } : {}
    },
    format: transformUploadResponse,
  }
}
