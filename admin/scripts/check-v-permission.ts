// Verifies v-permission directive behavior.
//
// Checks:
// - Single permission string: element removed when denied, kept when granted.
// - Array of permissions (OR logic): kept if ANY granted, removed if all denied.
// - Dynamic update: restore element when permission changes from denied to granted.
// - super_admin bypass: element always kept.
//
// Usage (from admin/):
//   npx tsx scripts/check-v-permission.ts

class MemoryStorage {
  private data = new Map<string, string>()
  get length(): number { return this.data.size }
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

import { createPinia, setActivePinia } from 'pinia'

setActivePinia(createPinia())

// Pre-seed the permission store before the directive lazily creates it.
const { usePermissionStore } = await import('../src/stores/permission')
const perm = usePermissionStore()
perm.permissionCodes = new Set(['post:list', 'post:create'])

const { vPermission } = await import('../src/directives/permission')

// Minimal DOM mock sufficient for the directive's operations.
class MockParent {
  children: MockEl[] = []
  insertBefore(el: MockEl, next: MockEl | null): void {
    const idx = next ? this.children.indexOf(next) : this.children.length
    this.children.splice(idx, 0, el)
    el.parentNode = this
  }
}

class MockEl {
  parentNode: MockParent | null = null
  nextSibling: MockEl | null = null
  remove(): void {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this)
      if (idx >= 0) this.parentNode.children.splice(idx, 1)
      this.parentNode = null
    }
  }
}

function makeEl(): MockEl {
  const parent = new MockParent()
  const el = new MockEl()
  el.parentNode = parent
  parent.children.push(el)
  return el
}

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

// === Single string value ===
{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: 'post:list' } as any)
  check('S1: granted single → kept in DOM', el.parentNode !== null)
}

{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: 'user:delete' } as any)
  check('S2: denied single → removed from DOM', el.parentNode === null)
}

// === Array value (OR) ===
{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: ['user:delete', 'post:create'] } as any)
  check('A1: array with one granted → kept', el.parentNode !== null)
}

{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: ['user:delete', 'role:admin'] } as any)
  check('A2: array with none granted → removed', el.parentNode === null)
}

// === Dynamic update ===
{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: 'user:delete' } as any)
  check('U1: initially removed', el.parentNode === null)

  vPermission.updated(el as unknown as HTMLElement, { value: 'post:list' } as any)
  check('U2: updated to granted → restored', el.parentNode !== null)
}

{
  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: 'post:list' } as any)
  check('U3: initially kept', el.parentNode !== null)

  vPermission.updated(el as unknown as HTMLElement, { value: 'user:delete' } as any)
  check('U4: updated to denied → removed', el.parentNode === null)
}

// === super_admin bypass ===
{
  const { useAuthStore } = await import('../src/stores/auth')
  const auth = useAuthStore()
  auth.setSession('tok', 'ref', {
    id: 1,
    username: 'sa',
    email: 'sa@x.com',
    displayName: null,
    avatarUrl: null,
    isSuperAdmin: true,
    roles: ['super_admin'],
  })

  const el = makeEl()
  vPermission.mounted(el as unknown as HTMLElement, { value: 'anything:wild' } as any)
  check('SA1: super_admin → kept regardless', el.parentNode !== null)

  auth.reset()
}

console.log('')
console.log(
  pass
    ? 'PASS: v-permission directive verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
