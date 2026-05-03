// Pinia auth store: holds the access/refresh tokens + current UserInfo.
//
// State is hydrated from localStorage on store creation so a page reload
// keeps the user signed in until the refresh token expires (the axios
// interceptor in api/request.ts will fetch a new access token on first
// 401). Mutations always sync to localStorage via tokenStorage() (the
// same source the axios interceptor reads from), so the persisted view
// and the in-memory view stay in lockstep.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AxiosInstance } from 'axios'
import {
  apiLogin,
  apiLogout,
  apiMe,
  type MeResponseData,
  type UserInfo,
} from '../api/auth'
import { tokenStorage } from '../api/tokenStorage'

const USER_KEY = 'admin.user'

function safeLocalStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function loadPersistedUser(): UserInfo | null {
  const ls = safeLocalStorage()
  if (!ls) return null
  const raw = ls.getItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.id === 'number' &&
      typeof parsed.username === 'string'
    ) {
      return parsed as UserInfo
    }
    return null
  } catch {
    return null
  }
}

function persistUser(u: UserInfo): void {
  const ls = safeLocalStorage()
  if (!ls) return
  ls.setItem(USER_KEY, JSON.stringify(u))
}

function clearPersistedUser(): void {
  const ls = safeLocalStorage()
  if (!ls) return
  ls.removeItem(USER_KEY)
}

// MeResponseData has richer role shape than UserInfo; flatten back into the
// UserInfo shape that login returns, so consumers see one type.
function meToUserInfo(me: MeResponseData): UserInfo {
  return {
    id: me.id,
    username: me.username,
    email: me.email,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
    isSuperAdmin: me.isSuperAdmin,
    roles: me.roles.map((r) => r.code),
  }
}

export const useAuthStore = defineStore('auth', () => {
  const store = tokenStorage()

  const accessToken = ref<string | null>(store.getAccess())
  const refreshToken = ref<string | null>(store.getRefresh())
  const user = ref<UserInfo | null>(loadPersistedUser())

  const isAuthenticated = computed(
    () => !!accessToken.value && !!user.value,
  )

  function setSession(access: string, refresh: string, u: UserInfo): void {
    accessToken.value = access
    refreshToken.value = refresh
    user.value = u
    store.setBoth(access, refresh)
    persistUser(u)
  }

  function reset(): void {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    store.clear()
    clearPersistedUser()
  }

  async function login(
    email: string,
    password: string,
    client?: AxiosInstance,
  ): Promise<UserInfo> {
    const data = await apiLogin(email, password, client)
    setSession(data.accessToken, data.refreshToken, data.user)
    return data.user
  }

  async function logout(client?: AxiosInstance): Promise<void> {
    try {
      await apiLogout(client)
    } catch {
      // server-side logout is best-effort (stateless JWT — there's nothing
      // for the server to invalidate). Always clear local state.
    }
    reset()
  }

  async function fetchMe(client?: AxiosInstance): Promise<UserInfo> {
    const data = await apiMe(client)
    const u = meToUserInfo(data)
    user.value = u
    persistUser(u)
    return u
  }

  // Re-read access token from the storage layer. Useful after the axios
  // interceptor performs a silent refresh: localStorage is already updated,
  // but the reactive ref needs a manual nudge.
  function syncFromStorage(): void {
    accessToken.value = store.getAccess()
    refreshToken.value = store.getRefresh()
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    login,
    logout,
    fetchMe,
    reset,
    setSession,
    syncFromStorage,
  }
})
