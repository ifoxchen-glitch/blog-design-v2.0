// Verifies FormDrawer common component structure.
//
// Usage (from admin/):
//   npx tsx scripts/check-form-drawer.ts

import fs from 'node:fs'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

const source = fs.readFileSync('src/components/common/FormDrawer.vue', 'utf-8')

// Naive UI elements
check('N1: uses NDrawer', source.includes('NDrawer'))
check('N2: uses NDrawerContent', source.includes('NDrawerContent'))
check('N3: default footer renders NSpace + NButton', source.includes('NSpace') && /NButton/.test(source))

// Props
check('P1: declares show prop', /show:\s*boolean/.test(source))
check('P2: declares title prop', /title:\s*string/.test(source))
check('P3: declares width prop', /width\?:/.test(source))
check('P4: declares loading prop', /loading\?:\s*boolean/.test(source))
check('P5: declares submitText/cancelText', source.includes('submitText') && source.includes('cancelText'))
check('P6: declares closeOnConfirm prop', /closeOnConfirm\?:\s*boolean/.test(source))

// Emits
check("E1: emits 'update:show'", source.includes("'update:show'"))
check("E2: emits 'submit'", source.includes("'submit'"))
check("E3: emits 'cancel'", source.includes("'cancel'"))

// Slots
check('S1: provides default slot', /<slot\s*\/>/.test(source))
check('S2: provides footer slot', /<slot[^>]*name="footer"/.test(source))

// v-model:show wiring
check(
  'V1: forwards :show + @update:show (v-model:show contract)',
  /:show="props\.show"/.test(source) && /update:show/.test(source),
)

// Default button labels honored
check('L1: default submit text reads from prop', /props\.submitText/.test(source))
check('L2: default cancel text reads from prop', /props\.cancelText/.test(source))

console.log('')
console.log(
  pass
    ? 'PASS: FormDrawer component verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
