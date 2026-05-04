// Verifies DataTable common component structure.
//
// Usage (from admin/):
//   npx tsx scripts/check-data-table.ts

import fs from 'node:fs'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

const source = fs.readFileSync('src/components/common/DataTable.vue', 'utf-8')

// Generic component
check(
  'G1: declares generic <script setup lang="ts" generic=...>',
  /<script\s+setup[^>]+generic=/.test(source),
)

// Composable wiring
check('U1: imports useTable composable', source.includes('useTable'))

// Props
check('P1: declares props via defineProps', source.includes('defineProps'))
check('P2: declares columns prop', /columns:\s*DataTableColumns/.test(source))
check('P3: declares fetch prop', /fetch:\s*\(/.test(source))
check('P4: declares pageSize prop', /pageSize\?:\s*number/.test(source))
check('P5: declares selectable prop', /selectable\?:\s*boolean/.test(source))
check('P6: declares rowKey prop', /rowKey\?:/.test(source))

// Naive UI components
check('N1: uses NDataTable', source.includes('NDataTable'))
check('N2: uses NPagination', source.includes('NPagination'))
check('N3: uses NEmpty for empty state', source.includes('NEmpty'))
check('N4: uses NInput for default search', source.includes('NInput'))

// Slots
check('S1: provides toolbar slot', /<slot[^>]*name="toolbar"/.test(source))
check('S2: provides search slot', /<slot[^>]*name="search"/.test(source))
check('S3: provides empty slot', /<slot[^>]*name="empty"/.test(source))

// Emits
check('E1: emits update:selectedRowKeys', source.includes('update:selectedRowKeys'))

// Expose
check('X1: defineExpose with refresh+clearSelection', /defineExpose\([^)]*refresh[^)]*clearSelection|defineExpose\([^)]*clearSelection[^)]*refresh/s.test(source))

// Pagination handlers wired
check(
  'PG1: pagination wired to handlePageChange',
  source.includes('handlePageChange'),
)
check(
  'PG2: pagination wired to handlePageSizeChange',
  source.includes('handlePageSizeChange'),
)

console.log('')
console.log(
  pass
    ? 'PASS: DataTable component verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
