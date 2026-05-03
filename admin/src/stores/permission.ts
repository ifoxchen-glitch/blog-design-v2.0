// Pinia permission store: holds the menu tree + permission code set.
//
// loadMenus()       fetches /api/v2/auth/menus (server-side filtered to
//                   what this user can see) and stores the tree.
// loadPermissions() fetches /api/v2/auth/me and stores the flat
//                   permission code set used by hasPermission(code).
// hasPermission()   returns true unconditionally for super_admin users
//                   (read from the auth store), otherwise consults the
//                   set populated by loadPermissions().
//
// State is in-memory only — page reload re-runs the fetches. The tree
// and the set are independent so a caller can refresh just one of them.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AxiosInstance } from 'axios'
import { apiMe, apiMenus, type MenuNode } from '../api/auth'
import { useAuthStore } from './auth'

export const usePermissionStore = defineStore('permission', () => {
  const menus = ref<MenuNode[]>([])
  const permissionCodes = ref<Set<string>>(new Set())

  const isSuperAdmin = computed(() => {
    const auth = useAuthStore()
    return auth.user?.isSuperAdmin === true
  })

  async function loadMenus(client?: AxiosInstance): Promise<MenuNode[]> {
    const tree = await apiMenus(client)
    menus.value = tree
    return tree
  }

  async function loadPermissions(client?: AxiosInstance): Promise<string[]> {
    const me = await apiMe(client)
    permissionCodes.value = new Set(me.permissions)
    return me.permissions
  }

  function hasPermission(code: string): boolean {
    if (isSuperAdmin.value) return true
    return permissionCodes.value.has(code)
  }

  function reset(): void {
    menus.value = []
    permissionCodes.value = new Set()
  }

  return {
    menus,
    permissionCodes,
    loadMenus,
    loadPermissions,
    hasPermission,
    reset,
  }
})
