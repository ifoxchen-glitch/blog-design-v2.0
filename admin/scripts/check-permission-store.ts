// Verifies the behavior of admin/src/stores/permission.ts:
// - initial state has empty menus and an empty permissionCodes set
// - loadMenus() populates the tree from /api/v2/auth/menus and returns it
// - loadPermissions() populates permissionCodes from /api/v2/auth/me
// - hasPermission() returns true for codes in the set, false otherwise
// - super_admin users (per auth store) get hasPermission === true for any
//   code, including codes that are not in the set
// - non-super_admin users do NOT get the bypass
// - reset() clears menus AND permissionCodes
// - loadMenus() is idempotent — re-calling replaces (not appends) the tree
//
// localStorage is polyfilled in-process; pinia is set up via
// setActivePinia(createPinia()). Each scenario runs against a real
// node:http mock and uses a createRequest({...}) client built against
// that mock (so we exercise the real axios interceptors / type wrappers
// rather than stubbing fetch).
//
// Usage (from admin/):
//   npx tsx scripts/check-permission-store.ts

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
const { usePermissionStore } = await import('../src/stores/permission')

const PORT = 33426
const BASE = `http://localhost:${PORT}`

interface MenuRow {
  id: number
  parent_id: number | null
  name: string
  path: string | null
  icon: string | null
  permission_code: string | null
  sort_order: number
  children: MenuRow[]
}

interface MockState {
  meHits: number
  menusHits: number
  meReturnsSuperAdmin: boolean
  meReturnsPermissions: string[]
  menusReturns: MenuRow[]
}

function defaultMenus(): MenuRow[] {
  return [
    {
      id: 1,
      parent_id: null,
      name: 'Posts',
      path: '/posts',
      icon: 'document',
      permission_code: 'post:list',
      sort_order: 1,
      children: [
        {
          id: 2,
          parent_id: 1,
          name: 'New',
          path: '/posts/new',
          icon: null,
          permission_code: 'post:create',
          sort_order: 1,
          children: [],
        },
      ],
    },
  ]
}

function newMockState(): MockState {
  return {
    meHits: 0,
    menusHits: 0,
    meReturnsSuperAdmin: false,
    meReturnsPermissions: ['post:list', 'post:create'],
    menusReturns: defaultMenus(),
  }
}

let mock: MockState = newMockState()

const server = http.createServer((req, res) => {
  const url = req.url || ''
  res.setHeader('Content-Type', 'application/json')

  if (url === '/api/v2/auth/me' && req.method === 'GET') {
    mock.meHits++
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
    res.statusCode = 200
    res.end(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: mock.menusReturns,
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
    // === I: initial state — empty menus, empty codes, hasPermission false ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      check('I1: menus empty initially', perm.menus.length === 0)
      check(
        'I2: permissionCodes empty initially',
        perm.permissionCodes.size === 0,
      )
      check(
        'I3: hasPermission(post:list) === false on empty',
        perm.hasPermission('post:list') === false,
      )
      check(
        'I4: hasPermission(empty string) === false on empty',
        perm.hasPermission('') === false,
      )
    }

    // === M: loadMenus populates menus tree ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      const client = makeClient()
      const tree = await perm.loadMenus(client)
      check(
        'M1: loadMenus returns array with one root',
        Array.isArray(tree) && tree.length === 1,
      )
      check('M2: store menus length === 1', perm.menus.length === 1)
      check(
        'M3: store menus[0].name === "Posts"',
        perm.menus[0].name === 'Posts',
      )
      check(
        'M4: nested child preserved',
        perm.menus[0].children?.[0]?.name === 'New',
      )
      check(
        'M5: nested permission_code preserved',
        perm.menus[0].children?.[0]?.permission_code === 'post:create',
      )
      check('M6: /menus hit once', mock.menusHits === 1)
      check('M7: /me NOT hit by loadMenus', mock.meHits === 0)
    }

    // === P: loadPermissions populates code set ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      const client = makeClient()
      const codes = await perm.loadPermissions(client)
      check(
        'P1: loadPermissions returns array of length 2',
        Array.isArray(codes) && codes.length === 2,
      )
      check(
        'P2: permissionCodes has post:list',
        perm.permissionCodes.has('post:list'),
      )
      check(
        'P3: permissionCodes has post:create',
        perm.permissionCodes.has('post:create'),
      )
      check(
        'P4: permissionCodes size === 2',
        perm.permissionCodes.size === 2,
      )
      check('P5: /me hit once', mock.meHits === 1)
      check('P6: /menus NOT hit by loadPermissions', mock.menusHits === 0)
    }

    // === H: hasPermission for granted/missing codes ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      const client = makeClient()
      await perm.loadPermissions(client)
      check(
        'H1: hasPermission(post:list) === true',
        perm.hasPermission('post:list') === true,
      )
      check(
        'H2: hasPermission(post:create) === true',
        perm.hasPermission('post:create') === true,
      )
      check(
        'H3: hasPermission(post:delete) === false',
        perm.hasPermission('post:delete') === false,
      )
      check(
        'H4: hasPermission(unknown) === false',
        perm.hasPermission('xyz:abc') === false,
      )
    }

    // === S: super_admin bypass — true for any code, even with empty set ===
    {
      mock = newMockState()
      mock.meReturnsSuperAdmin = true
      mock.meReturnsPermissions = []
      freshAppState()
      const auth = useAuthStore()
      auth.setSession('access', 'refresh', {
        id: 1,
        username: 'sa',
        email: 'sa@example.com',
        displayName: 'SA',
        avatarUrl: null,
        isSuperAdmin: true,
        roles: ['super_admin'],
      })
      const perm = usePermissionStore()
      check('S0: permissionCodes empty', perm.permissionCodes.size === 0)
      check(
        'S1: super_admin hasPermission(post:delete) === true',
        perm.hasPermission('post:delete') === true,
      )
      check(
        'S2: super_admin hasPermission(empty string) === true',
        perm.hasPermission('') === true,
      )
      check(
        'S3: super_admin hasPermission(unknown) === true',
        perm.hasPermission('totally:made:up') === true,
      )
    }

    // === A: non-super_admin user — no bypass ===
    {
      mock = newMockState()
      freshAppState()
      const auth = useAuthStore()
      auth.setSession('access', 'refresh', {
        id: 7,
        username: 'editor',
        email: 'editor@example.com',
        displayName: null,
        avatarUrl: null,
        isSuperAdmin: false,
        roles: ['editor'],
      })
      const perm = usePermissionStore()
      const client = makeClient()
      await perm.loadPermissions(client)
      check(
        'A1: editor hasPermission(post:list) === true',
        perm.hasPermission('post:list') === true,
      )
      check(
        'A2: editor hasPermission(post:delete) === false',
        perm.hasPermission('post:delete') === false,
      )
    }

    // === R: reset clears menus AND permissionCodes ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      const client = makeClient()
      await perm.loadMenus(client)
      await perm.loadPermissions(client)
      check('R0a: pre-reset menus populated', perm.menus.length > 0)
      check(
        'R0b: pre-reset permissionCodes populated',
        perm.permissionCodes.size > 0,
      )
      perm.reset()
      check('R1: menus empty after reset', perm.menus.length === 0)
      check(
        'R2: permissionCodes empty after reset',
        perm.permissionCodes.size === 0,
      )
      check(
        'R3: hasPermission(post:list) === false after reset',
        perm.hasPermission('post:list') === false,
      )
    }

    // === U: loadMenus is idempotent — second call replaces, not appends ===
    {
      mock = newMockState()
      freshAppState()
      const perm = usePermissionStore()
      const client = makeClient()
      await perm.loadMenus(client)
      check(
        'U0: first load — 1 root',
        perm.menus.length === 1 && perm.menus[0].name === 'Posts',
      )
      mock.menusReturns = [
        {
          id: 9,
          parent_id: null,
          name: 'Settings',
          path: '/settings',
          icon: null,
          permission_code: null,
          sort_order: 99,
          children: [],
        },
      ]
      await perm.loadMenus(client)
      check(
        'U1: second load replaces (not appends) menus',
        perm.menus.length === 1 && perm.menus[0].name === 'Settings',
      )
      check('U2: /menus hit twice', mock.menusHits === 2)
    }
  } finally {
    server.close()
  }

  console.log('')
  console.log(
    pass
      ? 'PASS: permission store behavior verified.'
      : 'FAIL: see [FAIL] entries above.',
  )
  process.exit(pass ? 0 : 1)
}

run().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
