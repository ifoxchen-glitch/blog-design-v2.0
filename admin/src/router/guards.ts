// Vue Router beforeEach/afterEach guards for the admin SPA.
//
// Decision tree (in order):
//   1. /login route:
//      - authenticated      -> redirect /dashboard
//      - unauthenticated    -> allow
//   2. meta.public route   -> allow (no auth, no permission check)
//   3. unauthenticated     -> redirect /login?redirect=<intended fullPath>
//   4. authenticated, not yet bootstrapped:
//        try loadMenus() + loadPermissions() in parallel.
//        on failure, reset() the auth store and redirect
//        /login?redirect=<intended>&expired=1.
//   5. meta.permission set and user lacks it -> redirect /403
//   6. otherwise              -> allow.
//
// Bootstrap state is module-level so it's shared by every guard
// invocation in the SPA but resets on /login navigations (so a
// fresh session re-primes for the new user).

import type { AxiosInstance } from 'axios'
import type { Router, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePermissionStore } from '../stores/permission'

let bootstrapped = false
let bootstrapInFlight: Promise<void> | null = null

export function resetGuardState(): void {
  bootstrapped = false
  bootstrapInFlight = null
}

export function isBootstrapped(): boolean {
  return bootstrapped
}

async function bootstrapPermissions(client?: AxiosInstance): Promise<void> {
  if (bootstrapped) return
  if (bootstrapInFlight) {
    await bootstrapInFlight
    return
  }
  const perm = usePermissionStore()
  bootstrapInFlight = (async () => {
    await Promise.all([perm.loadMenus(client), perm.loadPermissions(client)])
    bootstrapped = true
  })()
  try {
    await bootstrapInFlight
  } finally {
    bootstrapInFlight = null
  }
}

function isPublic(to: RouteLocationNormalized): boolean {
  return to.matched.some((r) => r.meta?.public === true)
}

function isLoginRoute(to: RouteLocationNormalized): boolean {
  return to.path === '/login' || to.name === 'login'
}

function requiredPermission(to: RouteLocationNormalized): string | null {
  for (const r of [...to.matched].reverse()) {
    const p = r.meta?.permission
    if (typeof p === 'string' && p) return p
  }
  return null
}

export interface GuardsOptions {
  // Optional axios instance used for the bootstrap calls. Defaults to
  // the singleton `request` from api/request.ts (which the permission
  // store already uses). Tests pass a mock-bound client.
  client?: AxiosInstance
}

export function installGuards(
  router: Router,
  options: GuardsOptions = {},
): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (isLoginRoute(to)) {
      if (auth.isAuthenticated) {
        return { path: '/dashboard' }
      }
      return true
    }

    if (isPublic(to)) {
      return true
    }

    if (!auth.isAuthenticated) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    try {
      await bootstrapPermissions(options.client)
    } catch {
      auth.reset()
      resetGuardState()
      return {
        path: '/login',
        query: { redirect: to.fullPath, expired: '1' },
      }
    }

    const needed = requiredPermission(to)
    if (needed) {
      const perm = usePermissionStore()
      if (!perm.hasPermission(needed)) {
        return { path: '/403', query: { from: to.fullPath } }
      }
    }

    return true
  })

  router.afterEach((to) => {
    if (isLoginRoute(to)) {
      resetGuardState()
    }
  })
}
