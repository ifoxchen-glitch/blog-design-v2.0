// Verifies MarkdownEditor logic (Vditor needs DOM, so we only test pure helpers
// + run text assertions on the SFC source).
//
// Usage (from admin/):
//   npx tsx scripts/check-markdown-editor.ts

import fs from 'node:fs'
import { createMemoryTokenStore } from '../src/api/tokenStorage'
import {
  UPLOAD_URL,
  UPLOAD_FIELD_NAME,
  UPLOAD_MAX_BYTES,
  buildUploadConfig,
  transformUploadResponse,
} from '../src/components/common/markdownEditorLogic'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

// === buildUploadConfig ===
{
  const store = createMemoryTokenStore({ access: 'tok-123' })
  const cfg = buildUploadConfig(store)
  check('U1: url points at /api/v2/admin/cms/upload', cfg.url === UPLOAD_URL && cfg.url === '/api/v2/admin/cms/upload')
  check('U2: fieldName is "file"', cfg.fieldName === UPLOAD_FIELD_NAME && cfg.fieldName === 'file')
  check('U3: max is 10 MB', cfg.max === UPLOAD_MAX_BYTES && cfg.max === 10 * 1024 * 1024)
  check('U4: multiple=false (single-file)', cfg.multiple === false)
  check('U5: accept allows images', cfg.accept === 'image/*')
  const headers = cfg.setHeaders()
  check('U6: setHeaders returns Bearer with current token', headers.Authorization === 'Bearer tok-123')

  // Token rotation: setHeaders re-reads each call.
  store.setAccess('tok-rotated')
  const headers2 = cfg.setHeaders()
  check('U7: setHeaders re-reads token (rotation honored)', headers2.Authorization === 'Bearer tok-rotated')

  // No token → no Authorization header (avoid sending "Bearer null").
  const empty = createMemoryTokenStore()
  const cfg2 = buildUploadConfig(empty)
  const noHeaders = cfg2.setHeaders()
  check('U8: missing token → no Authorization header', !('Authorization' in noHeaders))
}

// === transformUploadResponse ===
{
  const fakeFile = (name: string) => ({ name }) as unknown as File

  // Happy path: backend success → succMap[file.name] = url.
  const ok = transformUploadResponse(
    [fakeFile('a.png')],
    JSON.stringify({ code: 0, message: 'ok', data: { url: '/uploads/a.png' } }),
  )
  const okParsed = JSON.parse(ok)
  check('R1: success → code 0', okParsed.code === 0)
  check('R1: success → succMap["a.png"] = url', okParsed.data?.succMap?.['a.png'] === '/uploads/a.png')
  check('R1: success → empty errFiles', Array.isArray(okParsed.data?.errFiles) && okParsed.data.errFiles.length === 0)

  // Backend error code → fail with message.
  const fail = transformUploadResponse(
    [fakeFile('big.png')],
    JSON.stringify({ code: 4001, message: '文件过大', data: null }),
  )
  const failParsed = JSON.parse(fail)
  check('R2: backend error → code 1', failParsed.code === 1)
  check('R2: backend error → msg from backend', failParsed.msg === '文件过大')
  check('R2: backend error → file in errFiles', failParsed.data?.errFiles?.includes('big.png') === true)

  // Backend missing url → fail.
  const noUrl = transformUploadResponse(
    [fakeFile('z.png')],
    JSON.stringify({ code: 0, data: {} }),
  )
  const noUrlParsed = JSON.parse(noUrl)
  check('R3: missing url → code 1', noUrlParsed.code === 1)

  // Malformed response (not JSON) → fail with parser msg.
  const bad = transformUploadResponse([fakeFile('x.png')], 'not json')
  const badParsed = JSON.parse(bad)
  check('R4: invalid JSON → code 1', badParsed.code === 1)
  check('R4: invalid JSON → diagnostic msg', typeof badParsed.msg === 'string' && badParsed.msg.length > 0)
}

// === SFC text assertions (Vditor needs DOM, can't boot here) ===
{
  const sfc = fs.readFileSync('src/components/common/MarkdownEditor.vue', 'utf-8')
  check('S1: imports Vditor', /import\s+Vditor\s+from\s+['"]vditor['"]/.test(sfc))
  check('S2: imports Vditor CSS', /vditor\/dist\/index\.css/.test(sfc))
  check('S3: imports buildUploadConfig', sfc.includes('buildUploadConfig'))
  check('S4: declares modelValue prop', /modelValue:\s*string/.test(sfc))
  check('S5: emits update:modelValue', sfc.includes("'update:modelValue'"))
  check('S6: declares mode prop with literal types', /mode\?:\s*['"]wysiwyg['"]/.test(sfc))
  check('S7: instantiates Vditor in onMounted', sfc.includes('new Vditor'))
  check('S8: cleans up via destroy() in onBeforeUnmount', sfc.includes('onBeforeUnmount') && /editor\.destroy\(\)/.test(sfc))
  check('S9: watches modelValue with cycle prevention', /isInternalUpdate/.test(sfc))
  check('S10: passes upload.format and setHeaders to Vditor', sfc.includes('upload.format') && sfc.includes('upload.setHeaders'))
}

console.log('')
console.log(
  pass
    ? 'PASS: MarkdownEditor logic verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
