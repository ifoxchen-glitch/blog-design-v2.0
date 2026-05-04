// Verifies PageHeader common component structure.
//
// Usage (from admin/):
//   npx tsx scripts/check-page-header.ts

import fs from 'node:fs'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

const source = fs.readFileSync('src/components/common/PageHeader.vue', 'utf-8')

// Props
check('P1: declares props via defineProps', source.includes('defineProps'))
check('P2: exposes title prop', /title:\s*string/.test(source))
check('P3: exposes subtitle prop', /subtitle\?:\s*string/.test(source))
check(
  'P4: exposes breadcrumbs prop',
  /breadcrumbs\?:\s*BreadcrumbItem\[\]/.test(source) ||
    /breadcrumbs\?:\s*Array<\{/.test(source),
)

// Slots
check('S1: provides default slot', /<slot\s*\/?>|<slot\s+[^>]*name="default"/.test(source) || /<slot\s*\/>/.test(source))
check(
  'S2: provides extra slot',
  /<slot[^>]+name="extra"/.test(source),
)

// Naive UI usage
check('N1: uses NBreadcrumb', source.includes('NBreadcrumb'))
check('N2: uses NSpace', source.includes('NSpace'))

// Layout
check('L1: renders title heading', /<h1[\s\S]*?props\.title/.test(source))

console.log('')
console.log(
  pass
    ? 'PASS: PageHeader component verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
