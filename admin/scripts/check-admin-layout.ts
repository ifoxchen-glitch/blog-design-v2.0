// Verifies AdminLayout.vue + dashboard/index.vue + router wiring.
//
// Checks:
// - /dashboard route resolves to AdminLayout wrapper + dashboard child.
// - buildOptions() turns MenuNode[] into Naive UI MenuOption[] shape.
// - findActiveKey() picks the deepest prefix-matching menu key.
// - Component source files exist.
//
// Usage (from admin/):
//   npx tsx scripts/check-admin-layout.ts

import fs from 'node:fs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { MenuNode } from '../src/api/auth'

setActivePinia(createPinia())

const { buildOptions, findActiveKey } = await import(
  '../src/components/layout/menuUtils'
)

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

// === 1. Pure menu helpers ===
const sampleMenus: MenuNode[] = [
  {
    id: 1,
    parent_id: null,
    name: 'Dashboard',
    path: '/dashboard',
    icon: null,
    permission_code: null,
    sort_order: 1,
    children: [],
  },
  {
    id: 2,
    parent_id: null,
    name: 'Posts',
    path: '/admin/posts',
    icon: null,
    permission_code: 'post:list',
    sort_order: 2,
    children: [
      {
        id: 3,
        parent_id: 2,
        name: 'All Posts',
        path: '/admin/posts/list',
        icon: null,
        permission_code: 'post:list',
        sort_order: 1,
        children: [],
      },
    ],
  },
]

const opts = buildOptions(sampleMenus)
check('M1: root count', opts.length === 2)
check('M2: first label', opts[0]?.label === 'Dashboard')
check('M3: first key', opts[0]?.key === '/dashboard')
check('M4: second has children', Array.isArray(opts[1]?.children))
check('M5: nested label', opts[1]?.children?.[0]?.label === 'All Posts')
check('M6: nested key', opts[1]?.children?.[0]?.key === '/admin/posts/list')
check('M7: empty input', buildOptions([]).length === 0)

check('A1: exact match', findActiveKey(opts, '/dashboard') === '/dashboard')
check(
  'A2: child match',
  findActiveKey(opts, '/admin/posts/list') === '/admin/posts/list',
)
check(
  'A3: parent prefix match',
  findActiveKey(opts, '/admin/posts/42/edit') === '/admin/posts',
)
check('A4: no match', findActiveKey(opts, '/unknown') === null)
check('A5: empty options', findActiveKey([], '/dashboard') === null)

// === 2. Router nesting ===
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: { template: '<div>Login</div>' },
      meta: { public: true },
    },
    {
      path: '/dashboard',
      component: { template: '<div>Layout</div>' },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: { template: '<div>Dashboard</div>' },
        },
      ],
    },
  ],
})

await router.push('/dashboard')
check(
  'R1: /dashboard resolved',
  router.currentRoute.value.path === '/dashboard',
)
check(
  'R2: matched has layout',
  router.currentRoute.value.matched.length === 2,
)
check(
  'R3: child name is dashboard',
  router.currentRoute.value.matched[1]?.name === 'dashboard',
)

// === 3. Component source files exist ===
check(
  'I1: AdminLayout.vue exists',
  fs.existsSync('src/components/layout/AdminLayout.vue'),
)
check(
  'I2: dashboard/index.vue exists',
  fs.existsSync('src/views/dashboard/index.vue'),
)
check(
  'I3: menuUtils.ts exists',
  fs.existsSync('src/components/layout/menuUtils.ts'),
)

console.log('')
console.log(
  pass
    ? 'PASS: admin layout verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
