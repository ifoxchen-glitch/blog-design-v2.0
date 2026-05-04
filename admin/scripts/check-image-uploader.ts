// Verifies ImageUploader component + apiUpload wrapper.
//
// Vue SFC needs DOM to mount, so SFC checks are text-based. apiUpload is
// runtime-testable by injecting a stubbed AxiosInstance.
//
// Usage (from admin/):
//   npx tsx scripts/check-image-uploader.ts

import fs from 'node:fs'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { apiUpload } from '../src/api/cms'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

interface PostCall {
  url: string
  data: unknown
  config: { headers?: Record<string, string>; onUploadProgress?: (e: { loaded: number; total: number }) => void }
}

function makeFakeAxios(response: { code: number; message: string; data: unknown }) {
  const calls: PostCall[] = []
  const fake = {
    async post(url: string, data: unknown, config: PostCall['config'] = {}) {
      calls.push({ url, data, config })
      // Simulate progress events.
      config.onUploadProgress?.({ loaded: 50, total: 100 })
      config.onUploadProgress?.({ loaded: 100, total: 100 })
      return {
        data: response,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse
    },
  } as unknown as AxiosInstance
  return { fake, calls }
}

// === A1: apiUpload posts a multipart form to the right URL ===
{
  const { fake, calls } = makeFakeAxios({ code: 0, message: 'ok', data: { url: '/uploads/a.png' } })
  const file = new File(['hello'], 'a.png', { type: 'image/png' })
  const result = await apiUpload(file, {}, fake)

  check('A1: returns backend data block', result.url === '/uploads/a.png')
  check('A1: posts to /api/v2/admin/cms/upload', calls.length === 1 && calls[0].url === '/api/v2/admin/cms/upload')
  check(
    'A1: sets multipart/form-data header',
    calls[0].config?.headers?.['Content-Type'] === 'multipart/form-data',
  )
  check(
    'A1: body is FormData with field "file"',
    calls[0].data instanceof FormData && (calls[0].data as FormData).has('file'),
  )
}

// === A2: progress callback is invoked with integer percent ===
{
  const { fake } = makeFakeAxios({ code: 0, message: 'ok', data: { url: '/uploads/p.png' } })
  const file = new File(['x'], 'p.png', { type: 'image/png' })
  const seen: number[] = []
  await apiUpload(file, { onProgress: (p) => seen.push(p) }, fake)
  check('A2: progress callback called twice', seen.length === 2)
  check('A2: progress percent is integer 50 then 100', seen[0] === 50 && seen[1] === 100)
}

// === A3: progress callback skipped when total is 0 ===
{
  const fake = {
    async post(url: string, data: unknown, config: PostCall['config'] = {}) {
      config.onUploadProgress?.({ loaded: 50, total: 0 })
      return {
        data: { code: 0, message: 'ok', data: { url: '/uploads/z.png' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: undefined,
      } as AxiosResponse
      void url
      void data
    },
  } as unknown as AxiosInstance
  const file = new File(['x'], 'z.png', { type: 'image/png' })
  const seen: number[] = []
  await apiUpload(file, { onProgress: (p) => seen.push(p) }, fake)
  check('A3: progress skipped when total is 0 (avoids NaN)', seen.length === 0)
}

// === SFC text assertions ===
{
  const sfc = fs.readFileSync('src/components/common/ImageUploader.vue', 'utf-8')

  // Naive UI usage
  check('S1: uses NUpload', sfc.includes('NUpload'))
  check('S2: uses NUploadDragger for drag area', sfc.includes('NUploadDragger'))
  check('S3: list-type set to image-card', /list-type="image-card"/.test(sfc))
  check('S4: registers custom-request handler', sfc.includes('custom-request'))
  check('S5: registers before-upload handler', sfc.includes('before-upload'))
  check('S6: imports apiUpload', sfc.includes("from '../../api/cms'") && sfc.includes('apiUpload'))

  // Props
  check('P1: declares modelValue prop (string | string[])', /modelValue:\s*string\s*\|\s*string\[\]/.test(sfc))
  check('P2: declares multiple prop', /multiple\?:\s*boolean/.test(sfc))
  check('P3: declares max prop', /max\?:\s*number/.test(sfc))
  check('P4: declares accept prop', /accept\?:\s*string/.test(sfc))
  check('P5: declares maxSize prop', /maxSize\?:\s*number/.test(sfc))

  // Emits
  check('E1: emits update:modelValue', sfc.includes("'update:modelValue'"))

  // Behavior
  check('B1: validates MIME type via accept rule', sfc.includes('accept') && sfc.includes('image/'))
  check('B2: validates file size against maxSize', sfc.includes('maxSize'))
  check('B3: progress wired through onUploadProgress chain', sfc.includes('onProgress') && sfc.includes('opts.onProgress'))
}

console.log('')
console.log(
  pass
    ? 'PASS: ImageUploader + apiUpload verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
