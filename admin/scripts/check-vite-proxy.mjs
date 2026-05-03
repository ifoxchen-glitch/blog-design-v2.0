// One-off helper: verify admin/vite.config.ts has /api proxy to :3000
// Usage (from admin/): node scripts/check-vite-proxy.mjs
import { loadConfigFromFile } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname, '..')
const configPath = path.join(root, 'vite.config.ts')

const result = await loadConfigFromFile(
  { command: 'serve', mode: 'development' },
  configPath,
)
if (!result) {
  console.error('FAIL: could not load vite.config.ts')
  process.exit(1)
}

const cfg = result.config
const proxy = cfg.server?.proxy ?? {}

let pass = true
function check(label, ok, detail) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

check('server.proxy is an object', typeof proxy === 'object' && proxy !== null)
check('proxy["/api"] is configured', '/api' in proxy)

const apiCfg = proxy['/api']
const target =
  typeof apiCfg === 'string' ? apiCfg : apiCfg?.target
check(
  'proxy["/api"].target === http://localhost:3000',
  target === 'http://localhost:3000',
  `got: ${target}`,
)

const changeOrigin =
  typeof apiCfg === 'object' && apiCfg !== null
    ? apiCfg.changeOrigin
    : undefined
check(
  'proxy["/api"].changeOrigin === true',
  changeOrigin === true,
  `got: ${changeOrigin}`,
)

// sanity: the dev server still binds to 5173 (T1.14 contract)
check(
  'server.port === 5173',
  cfg.server?.port === 5173,
  `got: ${cfg.server?.port}`,
)
check(
  'server.strictPort === true',
  cfg.server?.strictPort === true,
  `got: ${cfg.server?.strictPort}`,
)

console.log('')
console.log(
  pass
    ? 'PASS: /api -> http://localhost:3000 proxy is configured.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
