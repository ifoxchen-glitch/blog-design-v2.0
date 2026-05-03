// Single source of truth for admin v2 access/refresh tokens.
//
// Default impl persists both tokens to localStorage. The architecture doc
// (§7.1) prefers accessToken in memory + refreshToken in localStorage; once
// stores/auth.ts (T1.18) lands, the auth store will own accessToken in
// Pinia state and call setAccess/clear here for the persisted refresh token.
// Until then, localStorage is the simplest single owner.

const ACCESS_KEY = 'admin.access_token'
const REFRESH_KEY = 'admin.refresh_token'

export interface TokenStore {
  getAccess(): string | null
  setAccess(token: string): void
  getRefresh(): string | null
  setRefresh(token: string): void
  setBoth(access: string, refresh: string): void
  clear(): void
}

export function createLocalStorageTokenStore(): TokenStore {
  return {
    getAccess: () => localStorage.getItem(ACCESS_KEY),
    setAccess: (t) => localStorage.setItem(ACCESS_KEY, t),
    getRefresh: () => localStorage.getItem(REFRESH_KEY),
    setRefresh: (t) => localStorage.setItem(REFRESH_KEY, t),
    setBoth: (a, r) => {
      localStorage.setItem(ACCESS_KEY, a)
      localStorage.setItem(REFRESH_KEY, r)
    },
    clear: () => {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },
  }
}

// Plain in-memory store. Used by the verifier (no DOM); also useful when
// stores/auth.ts wants to back accessToken with Pinia state and persist
// only the refresh token.
export function createMemoryTokenStore(initial?: {
  access?: string | null
  refresh?: string | null
}): TokenStore {
  let access: string | null = initial?.access ?? null
  let refresh: string | null = initial?.refresh ?? null
  return {
    getAccess: () => access,
    setAccess: (t) => {
      access = t
    },
    getRefresh: () => refresh,
    setRefresh: (t) => {
      refresh = t
    },
    setBoth: (a, r) => {
      access = a
      refresh = r
    },
    clear: () => {
      access = null
      refresh = null
    },
  }
}

let _default: TokenStore | null = null

export function tokenStorage(): TokenStore {
  if (!_default) _default = createLocalStorageTokenStore()
  return _default
}
