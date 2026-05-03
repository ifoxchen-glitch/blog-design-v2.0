// Verifies the behavior of admin/src/stores/auth.ts:
// - login() persists tokens + user to localStorage and updates reactive refs
// - reload (fresh pinia / fresh store instance) rehydrates from localStorage
// - fetchMe() updates the user from /api/v2/auth/me
// - logout() clears local state and survives a server-side failure
// - reset() clears state without a server call
// - syncFromStorage() refreshes refs after the axios interceptor silently
//   rotates the access token in tokenStorage
// - login with bad creds throws and leaves the prior state untouched
//
// localStorage is polyfilled in-process; pinia is set up via
// setActivePinia(createPinia()). Each scenario runs against a real
// node:http mock and uses a createRequest({...}) client built against
// that mock (so we exercise the real axios interceptors / type wrappers
// rather than stubbing fetch).
//
// Usage (from admin/):
//   npx tsx scripts/check-auth-store.ts

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

// Imports come AFTER the polyfill so any module-load-time side effect that
// references localStorage finds the shim. (None currently do — token store
// closures read localStorage lazily — but imports are hoisted in ESM, so
// even if we add eager reads later this ordering keeps working.)
const { createPinia, setActivePinia } = await import('pinia')
const { createRequest } = await import('../src/api/request')
const { createMemoryTokenStore } = await import('../src/api/tokenStorage')
const { useAuthStore } = await import('../src/stores/auth')

const PORT = 33425
const BASE = `http://localhost:${PORT}`

interface MockState {
  loginShouldFail: boolean
  logoutShouldFail: boolean
  meReturnsUserId: number
  loginHits: number
  logoutHits: number
  meHits: number
}

function newMockState(): MockState {
  return {
    loginShouldFail: false,
    logoutShouldFail: false,
    meReturnsUserId: 7,
    loginHits: 0,
    logoutHits: 0,
    meHits: 0,
  }
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
          accessToken: 'access-from-login',
          refreshToken: 'refresh-from-login',
          user: {
            id: 7,
            username: 'tester',
            email: parsed.email ?? 'tester@example.com',
            displayName: 'Tester',
            avatarUrl: null,
            isSuperAdmin: false,
            roles: ['editor'],
          },
        },
      }),
    )
    return
  }

  if (url === '/api/v2/auth/logout' && req.method === 'POST') {
    mock.logoutHits++
    if (mock.logoutShouldFail) {
      res.statusCode = 500
      res.end(JSON.stringify({ code: 500, message: 'oops' }))
      return
    }
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: { loggedOut: true },
      }),
    )
    return
  }

  if (url === '/api/v2/auth/me' && req.method === 'GET') {
    mock.meHits++
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: {
          id: mock.meReturnsUserId,
          username: 'tester',
          email: 'tester@example.com',
          displayName: 'Tester (me)',
          avatarUrl: 'https://example.com/avatar.png',
          isSuperAdmin: false,
          lastLoginAt: '2026-05-03T00:00:00.000Z',
          createdAt: '2026-04-01T00:00:00.000Z',
          roles: [
            { id: 2, code: 'editor', name: 'Editor' },
            { id: 3, code: 'viewer', name: 'Viewer' },
          ],
          permissions: ['post:list', 'post:create'],
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

async function run() {
  await new Promise<void>((resolve) => server.listen(PORT, resolve))

  try {
    // === L: login persists everything ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      check('L0: starts unauthenticated', auth.isAuthenticated === false)
      const client = makeClient()
      const u = await auth.login('tester@example.com', 'pw', client)
      check('L1: login returned the user', u.id === 7 && u.email === 'tester@example.com')
      check('L2: accessToken in store', auth.accessToken === 'access-from-login')
      check('L3: refreshToken in store', auth.refreshToken === 'refresh-from-login')
      check('L4: user.id === 7', auth.user?.id === 7)
      check('L5: user.roles === ["editor"]', JSON.stringify(auth.user?.roles) === '["editor"]')
      check('L6: isAuthenticated', auth.isAuthenticated === true)
      check(
        'L7: localStorage.admin.access_token persisted',
        localStorage.getItem('admin.access_token') === 'access-from-login',
      )
      check(
        'L8: localStorage.admin.refresh_token persisted',
        localStorage.getItem('admin.refresh_token') === 'refresh-from-login',
      )
      const userJson = localStorage.getItem('admin.user')
      check('L9: localStorage.admin.user persisted', !!userJson)
      const persistedUser = userJson ? JSON.parse(userJson) : null
      check(
        'L10: persisted user.email matches',
        persistedUser?.email === 'tester@example.com',
      )
      check('L11: server hit once', mock.loginHits === 1)
    }

    // === R: reload — fresh pinia, fresh store, hydrates from localStorage ===
    {
      // Use the localStorage state from the previous scenario to simulate reload.
      // Save the current LS into a fresh app state.
      const accessTokenBefore = localStorage.getItem('admin.access_token')
      const refreshTokenBefore = localStorage.getItem('admin.refresh_token')
      const userJsonBefore = localStorage.getItem('admin.user')

      setActivePinia(createPinia())
      // Don't reset localStorage — that's the point: reload preserves it.
      // (However we DO need a clean Pinia instance.)

      const auth2 = useAuthStore()
      check('R1: hydrated accessToken', auth2.accessToken === accessTokenBefore)
      check('R2: hydrated refreshToken', auth2.refreshToken === refreshTokenBefore)
      check('R3: hydrated user.id', auth2.user?.id === 7)
      check(
        'R4: hydrated user.email',
        auth2.user?.email === JSON.parse(userJsonBefore!).email,
      )
      check('R5: isAuthenticated after reload', auth2.isAuthenticated === true)
    }

    // === M: fetchMe overwrites user with richer me data ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('tester@example.com', 'pw', client)
      const meUser = await auth.fetchMe(client)
      check('M1: fetchMe returns user', meUser.id === 7)
      check('M2: displayName from /me', auth.user?.displayName === 'Tester (me)')
      check(
        'M3: avatarUrl from /me',
        auth.user?.avatarUrl === 'https://example.com/avatar.png',
      )
      check(
        'M4: roles flattened to codes',
        JSON.stringify(auth.user?.roles) === '["editor","viewer"]',
      )
      const persisted = localStorage.getItem('admin.user')
      const parsed = persisted ? JSON.parse(persisted) : null
      check(
        'M5: persisted displayName updated',
        parsed?.displayName === 'Tester (me)',
      )
      check('M6: /me hit once', mock.meHits === 1)
    }

    // === O: logout clears state, server hit ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('tester@example.com', 'pw', client)
      check('O0: pre-logout authenticated', auth.isAuthenticated === true)
      await auth.logout(client)
      check('O1: accessToken cleared', auth.accessToken === null)
      check('O2: refreshToken cleared', auth.refreshToken === null)
      check('O3: user null', auth.user === null)
      check('O4: isAuthenticated false', auth.isAuthenticated === false)
      check(
        'O5: localStorage.admin.access_token cleared',
        localStorage.getItem('admin.access_token') === null,
      )
      check(
        'O6: localStorage.admin.refresh_token cleared',
        localStorage.getItem('admin.refresh_token') === null,
      )
      check(
        'O7: localStorage.admin.user cleared',
        localStorage.getItem('admin.user') === null,
      )
      check('O8: /logout hit once', mock.logoutHits === 1)
    }

    // === F: logout still clears local state when server fails ===
    {
      mock = newMockState()
      mock.logoutShouldFail = true
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('tester@example.com', 'pw', client)
      await auth.logout(client) // should NOT throw
      check('F1: accessToken cleared after server failure', auth.accessToken === null)
      check('F2: user null after server failure', auth.user === null)
      check('F3: /logout hit was attempted', mock.logoutHits === 1)
      check(
        'F4: localStorage cleared after server failure',
        localStorage.getItem('admin.access_token') === null &&
          localStorage.getItem('admin.user') === null,
      )
    }

    // === X: reset() clears without server call ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('tester@example.com', 'pw', client)
      const logoutHitsBefore = mock.logoutHits
      auth.reset()
      check('X1: accessToken cleared by reset', auth.accessToken === null)
      check('X2: user null after reset', auth.user === null)
      check('X3: /logout NOT hit by reset', mock.logoutHits === logoutHitsBefore)
      check(
        'X4: localStorage cleared by reset',
        localStorage.getItem('admin.access_token') === null,
      )
    }

    // === S: syncFromStorage picks up an out-of-band token rotation ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      await auth.login('tester@example.com', 'pw', client)
      // Simulate the axios interceptor silently refreshing the token: the
      // shared tokenStorage gets updated, but the auth store's reactive
      // ref hasn't been told yet.
      localStorage.setItem('admin.access_token', 'rotated-by-interceptor')
      check(
        'S0: ref still holds old value before sync',
        auth.accessToken === 'access-from-login',
      )
      auth.syncFromStorage()
      check(
        'S1: ref reflects rotated value after sync',
        auth.accessToken === 'rotated-by-interceptor',
      )
    }

    // === A: bad creds — login throws, prior state untouched ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      const client = makeClient()
      // First login successfully
      await auth.login('tester@example.com', 'pw', client)
      check('A0: pre-bad login authenticated', auth.isAuthenticated === true)
      // Now flip the mock to fail and try again
      mock.loginShouldFail = true
      let threw = false
      try {
        await auth.login('tester@example.com', 'wrong-pw', client)
      } catch {
        threw = true
      }
      check('A1: bad login throws', threw)
      check(
        'A2: prior accessToken preserved',
        auth.accessToken === 'access-from-login',
      )
      check('A3: prior user preserved', auth.user?.id === 7)
      check('A4: still authenticated', auth.isAuthenticated === true)
    }
  } finally {
    server.close()
  }

  console.log('')
  console.log(
    pass
      ? 'PASS: auth store behavior verified.'
      : 'FAIL: see [FAIL] entries above.',
  )
  process.exit(pass ? 0 : 1)
}

run().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
