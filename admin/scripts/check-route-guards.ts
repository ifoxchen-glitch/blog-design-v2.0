// Verifies the behavior of admin/src/router/guards.ts:
//
// V (public route, unauth):
//   /403 and /login are public — the guard always allows them, even when
//   the auth store is empty. Bootstrap MUST NOT fire.
//
// L (login route, authed):
//   visiting /login while authenticated short-circuits to /dashboard.
//
// U (protected route, unauth):
//   /dashboard with no auth → /login?redirect=/dashboard. fullPath is
//   preserved so a deeper /admin/posts/42?tab=draft round-trips.
//
// B (bootstrap fires once on first protected nav):
//   first authenticated nav to a protected route fetches /me + /menus
//   exactly once. Both stores are populated.
//
// I (bootstrap is idempotent):
//   a second authenticated nav to a different protected route does NOT
//   re-fetch /me or /menus.
//
// G / D (permission gate):
//   - super_admin user is allowed regardless of meta.permission
//   - non-super_admin with the code in their permissions set: allowed
//   - non-super_admin without the code: redirected to /403?from=
//
// F (bootstrap failure):
//   if /me or /menus rejects, the guard calls auth.reset() and redirects
//   to /login?redirect=<original>&expired=1. The bootstrap latch is reset
//   so the next nav can retry.
//
// X (afterEach on /login resets bootstrap state):
//   navigating to /login (e.g. logout) clears the bootstrap latch so the
//   *next* user's first protected nav re-primes /me + /menus.
//
// localStorage is polyfilled in-process; pinia is set up via
// setActivePinia(createPinia()). Each scenario runs against a real
// node:http mock and uses createRequest({...}) so we exercise real axios
// interceptors / type wrappers.
//
// Usage (from admin/):
//   npx tsx scripts/check-route-guards.ts

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
const { createRouter, createMemoryHistory } = await import('vue-router')
const { createRequest } = await import('../src/api/request')
const { createMemoryTokenStore } = await import('../src/api/tokenStorage')
const { useAuthStore } = await import('../src/stores/auth')
const { usePermissionStore } = await import('../src/stores/permission')
const { installGuards, resetGuardState, isBootstrapped } = await import(
  '../src/router/guards'
)

const PORT = 33428
const BASE = `http://localhost:${PORT}`

interface MockState {
  meHits: number
  menusHits: number
  meShouldFail: boolean
  menusShouldFail: boolean
  meReturnsSuperAdmin: boolean
  meReturnsPermissions: string[]
}

function newMockState(): MockState {
  return {
    meHits: 0,
    menusHits: 0,
    meShouldFail: false,
    menusShouldFail: false,
    meReturnsSuperAdmin: false,
    meReturnsPermissions: ['post:list'],
  }
}

let mock: MockState = newMockState()

const server = http.createServer((req, res) => {
  const url = req.url || ''
  res.setHeader('Content-Type', 'application/json')

  if (url === '/api/v2/auth/me' && req.method === 'GET') {
    mock.meHits++
    if (mock.meShouldFail) {
      res.statusCode = 500
      res.end(JSON.stringify({ code: 500, message: 'me boom' }))
      return
    }
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: {
          id: 7,
          username: 'tester',
          email: 'tester@example.com',
          displayName: null,
          avatarUrl: null,
          isSuperAdmin: mock.meReturnsSuperAdmin,
          lastLoginAt: null,
          createdAt: '2026-04-01T00:00:00Z',
          roles: [{ id: 2, code: 'editor', name: 'Editor' }],
          permissions: mock.meReturnsPermissions,
        },
      }),
    )
    return
  }

  if (url === '/api/v2/auth/menus' && req.method === 'GET') {
    mock.menusHits++
    if (mock.menusShouldFail) {
      res.statusCode = 500
      res.end(JSON.stringify({ code: 500, message: 'menus boom' }))
      return
    }
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: [
          {
            id: 1,
            parent_id: null,
            name: 'Posts',
            path: '/admin/posts',
            icon: null,
            permission_code: 'post:list',
            sort_order: 1,
            children: [],
          },
        ],
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
  resetGuardState()
}

function makeClient() {
  return createRequest({
    baseURL: BASE,
    tokenStore: createMemoryTokenStore(),
    onUnauthorized: () => {},
  })
}

// Minimal stub component for router routes — we never render, only navigate.
const Stub = { template: '<div></div>' }

function makeRouter(client: ReturnType<typeof makeClient>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      {
        path: '/login',
        name: 'login',
        component: Stub,
        meta: { public: true },
      },
      {
        path: '/403',
        name: 'forbidden',
        component: Stub,
        meta: { public: true },
      },
      { path: '/dashboard', name: 'dashboard', component: Stub },
      {
        path: '/admin/posts',
        name: 'posts',
        component: Stub,
        meta: { permission: 'post:list' },
      },
      {
        path: '/admin/users',
        name: 'users',
        component: Stub,
        meta: { permission: 'user:list' },
      },
      { path: '/admin/posts/:id', name: 'post-edit', component: Stub },
    ],
  })
  installGuards(router, { client })
  return router
}

function setAuth(opts: { isSuperAdmin?: boolean } = {}) {
  const auth = useAuthStore()
  auth.setSession('access-token', 'refresh-token', {
    id: 7,
    username: 'tester',
    email: 'tester@example.com',
    displayName: null,
    avatarUrl: null,
    isSuperAdmin: opts.isSuperAdmin === true,
    roles: opts.isSuperAdmin ? ['super_admin'] : ['editor'],
  })
  return auth
}

async function run() {
  await new Promise<void>((resolve) => server.listen(PORT, resolve))

  try {
    // === V: public routes always allowed, even unauth, no bootstrap ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      await router.push('/login')
      check('V1: unauth → /login allowed', router.currentRoute.value.path === '/login')
      check('V2: bootstrap not fired for /login', mock.meHits === 0)
      check('V3: /menus not fired for /login', mock.menusHits === 0)

      await router.push('/403')
      check('V4: unauth → /403 allowed', router.currentRoute.value.path === '/403')
      check('V5: bootstrap still not fired', mock.meHits === 0 && mock.menusHits === 0)
    }

    // === U: unauth → protected → /login?redirect=<fullPath> ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      await router.push('/dashboard')
      check(
        'U1: unauth /dashboard → /login',
        router.currentRoute.value.path === '/login',
      )
      check(
        'U2: redirect query preserved',
        router.currentRoute.value.query.redirect === '/dashboard',
      )
      check('U3: bootstrap NOT fired (unauth path)', mock.meHits === 0)

      // Deep route with query string — fullPath must include the query.
      mock = newMockState()
      freshAppState()
      const client2 = makeClient()
      const router2 = makeRouter(client2)
      await router2.push('/admin/posts/42?tab=draft')
      check(
        'U4: unauth deep route → /login',
        router2.currentRoute.value.path === '/login',
      )
      check(
        'U5: redirect preserves fullPath incl. query',
        router2.currentRoute.value.query.redirect === '/admin/posts/42?tab=draft',
      )
    }

    // === L: authed visiting /login → /dashboard ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: true })
      await router.push('/login')
      check(
        'L1: authed /login → /dashboard',
        router.currentRoute.value.path === '/dashboard',
      )
      // Note: /dashboard has no meta.permission so it would still try to
      // bootstrap. That's expected — the redirect IS a separate guard
      // invocation. Verify the bootstrap actually ran for /dashboard.
      check('L2: bootstrap fired for /dashboard (post-redirect)', mock.meHits === 1)
      check('L3: /menus fired once', mock.menusHits === 1)
    }

    // === B: bootstrap fires once on first authenticated protected nav ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: true })
      check('B0: not bootstrapped pre-nav', isBootstrapped() === false)
      await router.push('/dashboard')
      check(
        'B1: nav succeeded',
        router.currentRoute.value.path === '/dashboard',
      )
      check('B2: bootstrapped flag set', isBootstrapped() === true)
      check('B3: /me hit exactly once', mock.meHits === 1)
      check('B4: /menus hit exactly once', mock.menusHits === 1)
      const perm = usePermissionStore()
      check('B5: permission store populated', perm.menus.length === 1)
      check(
        'B6: permission codes populated',
        perm.permissionCodes.has('post:list'),
      )
    }

    // === I: bootstrap idempotent — second nav does NOT re-fetch ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: true })
      await router.push('/dashboard')
      check('I0: pre — /me=1', mock.meHits === 1)
      check('I0b: pre — /menus=1', mock.menusHits === 1)
      // Second protected navigation — should NOT re-bootstrap.
      await router.push('/admin/posts')
      check(
        'I1: nav succeeded',
        router.currentRoute.value.path === '/admin/posts',
      )
      check('I2: /me still 1 (no re-fetch)', mock.meHits === 1)
      check('I3: /menus still 1 (no re-fetch)', mock.menusHits === 1)
      // Third nav — same.
      await router.push('/admin/posts/99')
      check(
        'I4: third nav succeeded',
        router.currentRoute.value.path === '/admin/posts/99',
      )
      check('I5: /me still 1 (no re-fetch)', mock.meHits === 1)
      check('I6: /menus still 1 (no re-fetch)', mock.menusHits === 1)
    }

    // === G: super_admin allowed despite meta.permission ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: true })
      await router.push('/admin/users') // requires user:list (NOT in mock perms)
      check(
        'G1: super_admin allowed despite missing perm',
        router.currentRoute.value.path === '/admin/users',
      )
    }

    // === Gn: non-super_admin with the perm — allowed ===
    {
      mock = newMockState()
      mock.meReturnsPermissions = ['post:list']
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: false })
      await router.push('/admin/posts') // requires post:list (granted)
      check(
        'Gn1: editor with post:list allowed',
        router.currentRoute.value.path === '/admin/posts',
      )
    }

    // === D: non-super_admin without perm → /403?from= ===
    {
      mock = newMockState()
      mock.meReturnsPermissions = ['post:list'] // no user:list
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: false })
      await router.push('/admin/users') // requires user:list (denied)
      check(
        'D1: denied → /403',
        router.currentRoute.value.path === '/403',
      )
      check(
        'D2: from query preserved',
        router.currentRoute.value.query.from === '/admin/users',
      )
    }

    // === F: bootstrap failure → reset + /login?expired=1 ===
    {
      mock = newMockState()
      mock.meShouldFail = true
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      const auth = setAuth({ isSuperAdmin: true })
      check('F0: pre-fail authed', auth.isAuthenticated === true)
      await router.push('/dashboard')
      check(
        'F1: failure → /login',
        router.currentRoute.value.path === '/login',
      )
      check(
        'F2: redirect query preserved',
        router.currentRoute.value.query.redirect === '/dashboard',
      )
      check(
        'F3: expired flag set',
        router.currentRoute.value.query.expired === '1',
      )
      check(
        'F4: auth store reset',
        auth.isAuthenticated === false && auth.accessToken === null,
      )
      check('F5: bootstrap latch reset', isBootstrapped() === false)
    }

    // === Fm: /menus failure (with /me success) — same handling ===
    {
      mock = newMockState()
      mock.menusShouldFail = true
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      const auth = setAuth({ isSuperAdmin: true })
      await router.push('/admin/posts')
      check(
        'Fm1: menus failure → /login',
        router.currentRoute.value.path === '/login',
      )
      check(
        'Fm2: redirect preserves /admin/posts',
        router.currentRoute.value.query.redirect === '/admin/posts',
      )
      check('Fm3: expired=1', router.currentRoute.value.query.expired === '1')
      check('Fm4: auth reset', auth.isAuthenticated === false)
    }

    // === Xl: /login afterEach when actually unauth (logout flow) ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      const auth = setAuth({ isSuperAdmin: true })
      await router.push('/dashboard')
      check('Xl0: bootstrapped', isBootstrapped() === true)

      // Real logout: clear auth THEN navigate to /login.
      auth.reset()
      await router.push('/login')
      check(
        'Xl1: /login allowed (unauth)',
        router.currentRoute.value.path === '/login',
      )
      check(
        'Xl2: bootstrap latch reset by afterEach',
        isBootstrapped() === false,
      )

      // New user signs in — first protected nav must re-bootstrap.
      setAuth({ isSuperAdmin: true })
      await router.push('/dashboard')
      check('Xl3: re-bootstrapped', isBootstrapped() === true)
      check('Xl4: /me re-hit (=2)', mock.meHits === 2)
      check('Xl5: /menus re-hit (=2)', mock.menusHits === 2)
    }

    // === C: concurrent first nav — bootstrap dedup (single in-flight) ===
    {
      mock = newMockState()
      freshAppState()
      const client = makeClient()
      const router = makeRouter(client)
      setAuth({ isSuperAdmin: true })
      // Fire two navigations near-simultaneously — only one bootstrap
      // should run. (vue-router serializes navigations, so we test by
      // pre-priming an in-flight bootstrap then awaiting both.)
      const nav1 = router.push('/dashboard')
      const nav2 = router.push('/admin/posts')
      await Promise.all([nav1, nav2])
      check(
        'C1: settled at last requested route',
        router.currentRoute.value.path === '/admin/posts',
      )
      check('C2: /me hit exactly once', mock.meHits === 1)
      check('C3: /menus hit exactly once', mock.menusHits === 1)
    }
  } finally {
    server.close()
  }

  console.log('')
  console.log(
    pass
      ? 'PASS: route guards behavior verified.'
      : 'FAIL: see [FAIL] entries above.',
  )
  process.exit(pass ? 0 : 1)
}

run().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
