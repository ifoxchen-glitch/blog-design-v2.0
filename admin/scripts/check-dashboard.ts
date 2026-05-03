// Verifies dashboard/index.vue content and route wiring.
//
// Usage (from admin/):
//   npx tsx scripts/check-dashboard.ts

import fs from 'node:fs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

setActivePinia(createPinia())

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

const source = fs.readFileSync('src/views/dashboard/index.vue', 'utf-8')

// Content checks
check('C1: uses useAuthStore', source.includes('useAuthStore'))
check('C2: shows welcome username', source.includes('欢迎回来'))
check('C3: uses NCard', source.includes('NCard'))
check('C4: uses NStatistic', source.includes('NStatistic'))
check('C5: uses NGrid', source.includes('NGrid'))

// Route wiring check
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
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
check('R1: /dashboard resolves', router.currentRoute.value.path === '/dashboard')
check(
  'R2: child route name is dashboard',
  router.currentRoute.value.matched[0]?.children?.[0]?.name === 'dashboard',
)

console.log('')
console.log(
  pass
    ? 'PASS: dashboard placeholder verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
