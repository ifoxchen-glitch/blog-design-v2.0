// Verifies the behavior of admin/src/views/login/loginLogic.ts and the
// auth store integration that views/login/index.vue relies on:
//
// extractErrorMessage:
// - prefers AxiosError-shaped err.response.data.message
// - falls back to "邮箱或密码错误" for 401 with no server message
// - falls back to "网络异常" when err.response is undefined (axios network)
// - falls back to err.message when present and not network-shaped
// - returns generic "登录失败" for unknown shapes / null / undefined
//
// resolveRedirect:
// - returns query.redirect when it is a relative path starting with '/'
// - rejects "//host/path" (protocol-relative open redirect)
// - rejects absolute URLs like "http://evil.com"
// - defaults to "/dashboard" for missing / non-string redirect
//
// End-to-end (auth store + http mock):
// - successful login: authStore.login(email, pw) resolves, fills the
//   store, and tokens / user are set as the .vue would observe
// - failed login (401): authStore.login throws an AxiosError that
//   extractErrorMessage decodes back to the server's "Invalid email
//   or password" string — exactly what the .vue surfaces in NAlert
// - network failure (server stopped): authStore.login throws and
//   extractErrorMessage returns the network fallback
//
// Usage (from admin/):
//   npx tsx scripts/check-login-page.ts

import http from 'node:http'

class MemoryStorage {
  private data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  key(i: number): string | null {
    return Array.from(this.data.keys())[i] ?? null
  }
  getItem(k: string): string | null {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v))
  }
  removeItem(k: string): void {
    this.data.delete(k)
  }
  clear(): void {
    this.data.clear()
  }
}

;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
  new MemoryStorage()

const { createPinia, setActivePinia } = await import('pinia')
const { createRequest } = await import('../src/api/request')
const { createMemoryTokenStore } = await import('../src/api/tokenStorage')
const { useAuthStore } = await import('../src/stores/auth')
const { extractErrorMessage, resolveRedirect } = await import(
  '../src/views/login/loginLogic'
)

const PORT = 33427
const BASE = `http://localhost:${PORT}`

interface MockState {
  loginShouldFail: boolean
  loginHits: number
}

function newMockState(): MockState {
  return { loginShouldFail: false, loginHits: 0 }
}

let mock: MockState = newMockState()

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => {
      body += c
    })
    req.on('end', () => resolve(body))
  })
}

const server = http.createServer(async (req, res) => {
  const url = req.url || ''
  res.setHeader('Content-Type', 'application/json')

  if (url === '/api/v2/auth/login' && req.method === 'POST') {
    mock.loginHits++
    const body = await readBody(req)
    if (mock.loginShouldFail) {
      res.statusCode = 401
      res.end(
        JSON.stringify({ code: 401, message: 'Invalid email or password' }),
      )
      return
    }
    const parsed = JSON.parse(body) as { email?: string }
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: {
          accessToken: 'tok-A',
          refreshToken: 'tok-R',
          user: {
            id: 7,
            username: 'admin',
            email: parsed.email ?? 'admin@example.com',
            displayName: 'Admin',
            avatarUrl: null,
            isSuperAdmin: true,
            roles: ['super_admin'],
          },
        },
      }),
    )
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ code: 404, message: 'not found' }))
})

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

function freshAppState() {
  setActivePinia(createPinia())
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    new MemoryStorage()
}

function makeClient() {
  return createRequest({
    baseURL: BASE,
    tokenStore: createMemoryTokenStore(),
    onUnauthorized: () => {},
  })
}

function runExtractErrorMessageCases() {
  // E1: server-supplied message wins
  check(
    'E1: AxiosError with response.data.message → that string',
    extractErrorMessage({
      response: { status: 401, data: { message: 'Invalid email or password' } },
      message: 'Request failed with status code 401',
    }) === 'Invalid email or password',
  )
  // E2: 401 with no server message → friendly Chinese fallback
  check(
    'E2: 401 with no data.message → "邮箱或密码错误"',
    extractErrorMessage({
      response: { status: 401, data: null },
      message: 'Request failed with status code 401',
    }) === '邮箱或密码错误',
  )
  // E3: 500 with server message → that message
  check(
    'E3: 500 with server message → that message',
    extractErrorMessage({
      response: { status: 500, data: { message: 'database is on fire' } },
    }) === 'database is on fire',
  )
  // E4: AxiosError with no response (network failure) → network fallback
  check(
    'E4: no response (network) → "网络异常,请稍后重试"',
    extractErrorMessage({
      message: 'Network Error',
      // response is undefined
    }) === '网络异常,请稍后重试',
  )
  // E5: plain Error with response present but missing data
  check(
    'E5: response exists, no data, status 500 → falls through to message',
    extractErrorMessage({
      response: { status: 500, data: null },
      message: 'Boom',
    }) === 'Boom',
  )
  // E6: undefined / null
  check(
    'E6: null → "登录失败,请重试"',
    extractErrorMessage(null) === '登录失败,请重试',
  )
  check(
    'E7: undefined → "登录失败,请重试"',
    extractErrorMessage(undefined) === '登录失败,请重试',
  )
  // E8: Whitespace-only data.message must NOT win — fall through
  check(
    'E8: data.message="   " → does not win, falls through to status',
    extractErrorMessage({
      response: { status: 401, data: { message: '   ' } },
    }) === '邮箱或密码错误',
  )
  // E9: data.message is non-string → ignored, falls through
  check(
    'E9: data.message is number 42 → ignored, falls through',
    extractErrorMessage({
      response: { status: 500, data: { message: 42 } },
      message: 'fallback msg',
    }) === 'fallback msg',
  )
}

function runResolveRedirectCases() {
  // R1: relative redirect honored
  check(
    'R1: query.redirect="/posts" → "/posts"',
    resolveRedirect({ redirect: '/posts' }) === '/posts',
  )
  // R2: nested path
  check(
    'R2: query.redirect="/admin/users/42" → "/admin/users/42"',
    resolveRedirect({ redirect: '/admin/users/42' }) === '/admin/users/42',
  )
  // R3: missing redirect → /dashboard
  check(
    'R3: empty query → "/dashboard"',
    resolveRedirect({}) === '/dashboard',
  )
  // R4: protocol-relative open redirect rejected
  check(
    'R4: query.redirect="//evil.com/x" → "/dashboard" (rejected)',
    resolveRedirect({ redirect: '//evil.com/x' }) === '/dashboard',
  )
  // R5: absolute URL rejected
  check(
    'R5: query.redirect="http://evil.com" → "/dashboard" (rejected)',
    resolveRedirect({ redirect: 'http://evil.com' }) === '/dashboard',
  )
  // R6: non-string redirect (array — typical when ?redirect=a&redirect=b)
  check(
    'R6: query.redirect=["/a","/b"] → "/dashboard" (non-string ignored)',
    resolveRedirect({ redirect: ['/a', '/b'] }) === '/dashboard',
  )
  // R7: empty string redirect
  check(
    'R7: query.redirect="" → "/dashboard" (empty rejected)',
    resolveRedirect({ redirect: '' }) === '/dashboard',
  )
  // R8: path that does not start with /
  check(
    'R8: query.redirect="dashboard" → "/dashboard" (no leading slash rejected)',
    resolveRedirect({ redirect: 'dashboard' }) === '/dashboard',
  )
}

async function run() {
  // === Phase 1: pure helpers (no server needed) ===
  runExtractErrorMessageCases()
  runResolveRedirectCases()

  await new Promise<void>((resolve) => server.listen(PORT, resolve))

  try {
    // === S: end-to-end happy path ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      let redirected: string | null = null
      // Simulate what views/login/index.vue does in handleSubmit:
      try {
        await auth.login('admin@example.com', 'pw1234', client)
        redirected = resolveRedirect({})
      } catch (err) {
        check(
          'S0: happy path should not throw',
          false,
          extractErrorMessage(err),
        )
      }
      check('S1: login hit server once', mock.loginHits === 1)
      check('S2: store has tokens', auth.accessToken === 'tok-A')
      check('S3: store has user', auth.user?.id === 7)
      check('S4: isAuthenticated true', auth.isAuthenticated === true)
      check(
        'S5: would redirect to /dashboard (no query param)',
        redirected === '/dashboard',
      )
    }

    // === H: end-to-end happy path with redirect query ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('admin@example.com', 'pw1234', client)
      const target = resolveRedirect({ redirect: '/posts' })
      check('H1: redirect query honored', target === '/posts')
    }

    // === F: end-to-end failure path — bad creds ===
    {
      mock = newMockState()
      mock.loginShouldFail = true
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      let caught: unknown = null
      try {
        await auth.login('admin@example.com', 'wrong', client)
      } catch (err) {
        caught = err
      }
      check('F1: bad creds threw', caught !== null)
      const msg = extractErrorMessage(caught)
      // Server returned data.message="Invalid email or password" — that is
      // what extractErrorMessage prefers, and what NAlert would display.
      check(
        'F2: extracted message matches server text',
        msg === 'Invalid email or password',
        `got: ${msg}`,
      )
      check('F3: store NOT authenticated', auth.isAuthenticated === false)
      check('F4: store has no tokens', auth.accessToken === null)
    }

    // === N: network failure path — server stopped ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      // Stop the server temporarily to force a network error.
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
      let caught: unknown = null
      try {
        await auth.login('admin@example.com', 'pw1234', client)
      } catch (err) {
        caught = err
      }
      check('N1: network error threw', caught !== null)
      const msg = extractErrorMessage(caught)
      check(
        'N2: network fallback message',
        msg === '网络异常,请稍后重试' || msg === 'Network Error',
        `got: ${msg}`,
      )
      check('N3: store NOT authenticated', auth.isAuthenticated === false)
    }
  } finally {
    // server may already be closed by the network-failure scenario.
    try {
      server.close()
    } catch {
      // already closed
    }
  }

  console.log('')
  console.log(
    pass
      ? 'PASS: login page logic verified.'
      : 'FAIL: see [FAIL] entries above.',
  )
  process.exit(pass ? 0 : 1)
}

run().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
