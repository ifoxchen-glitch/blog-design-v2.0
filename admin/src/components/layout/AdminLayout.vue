<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePermissionStore } from '../../stores/permission'
import { buildOptions, findActiveKey } from './menuUtils'
import MobileDock from './MobileDock.vue'
import type { Component } from 'vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const permission = usePermissionStore()

const isCollapsed = ref(false)
const expandedMenus = ref<Set<string>>(new Set())

// Initialize expanded from current route's parent chain
function initExpanded() {
  const walk = (opts: any[], depth = 0) => {
    for (const opt of opts) {
      if (opt.children) {
        if (opt.children.some((c: any) => route.path.startsWith(String(c.key) + '/') || String(c.key) === route.path)) {
          expandedMenus.value.add(String(opt.key))
        }
        walk(opt.children, depth + 1)
      }
    }
  }
  walk(menuOptions.value)
}
onMounted(initExpanded)

function toggleMenu(key: string) {
  if (expandedMenus.value.has(key)) {
    expandedMenus.value.delete(key)
  } else {
    expandedMenus.value.add(key)
  }
}

// Icon mapping from permission store icons to SVG render functions
const iconMap: Record<string, () => Component> = {
  DashboardOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' })
  ]),
  DocumentTextOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' })
  ]),
  DocumentOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' })
  ]),
  PricetagOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' }),
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M6 6h.008v.008H6V6Z' })
  ]),
  FolderOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' })
  ]),
  LinkOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' })
  ]),
  ImageOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5M4.5 3h15a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 19.5 21H4.5a2.25 2.25 0 0 1-2.25-2.25V5.25A2.25 2.25 0 0 1 4.5 3Z' })
  ]),
  ShieldCheckmarkOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z' })
  ]),
  PersonOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' })
  ]),
  PeopleOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' })
  ]),
  KeyOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z' })
  ]),
  BarChartOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' })
  ]),
  SettingsOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' }),
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' })
  ]),
  ReceiptOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' })
  ]),
  ArchiveOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.244 2.245H6.62a2.25 2.25 0 0 1-2.245-2.245L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.875c0 .621.504 1.125 1.125 1.125Z' })
  ]),
  PulseOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941' })
  ]),
  HomeOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'm2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' })
  ]),
  LogOutOutline: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75' })
  ]),
}

const menuOptions = computed(() => buildOptions(permission.menus))

const activeMenuKey = computed(() => {
  return findActiveKey(menuOptions.value, route.path) ?? route.path
})

function handleMenuSelect(key: string) {
  if (key && key.startsWith('/')) {
    router.push(key)
  }
}

function logout() {
  auth.logout().finally(() => {
    router.push('/login')
  })
}

const breadcrumbs = computed(() => {
  return route.matched
    .filter((r) => r.name && r.path !== '/')
    .map((r) => ({
      label: String(r.name),
      path: r.path,
    }))
})
</script>

<template>
  <div
    class="bg-base-200 flex h-dvh w-screen overflow-hidden"
    :class="isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'"
  >
    <!-- Sidebar -->
    <div
      class="relative z-40 hidden flex-none overflow-visible transition-[width] duration-300 ease-[cubic-bezier(0.34,0.1,0.2,1)] md:flex"
      :class="isCollapsed ? 'w-18' : 'w-64'"
    >
      <div
        class="sidebar border-base-300/30 bg-base-200 text-base-content h-full overflow-x-hidden border-r p-2 transition-[width,padding] duration-300 ease-[cubic-bezier(0.34,0.1,0.2,1)]"
        :class="isCollapsed ? 'w-18 px-0' : 'w-64'"
      >
        <div
          class="flex h-full flex-col gap-2"
          :class="isCollapsed ? 'w-18 px-0' : 'w-60'"
        >
          <!-- Logo -->
          <div
            class="flex items-center gap-3 px-3 py-3"
            :class="isCollapsed && 'justify-center px-0'"
          >
            <svg class="h-7 w-7 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <span v-if="!isCollapsed" class="text-base font-semibold tracking-tight">Blog Admin</span>
          </div>

          <!-- Nav Menu -->
          <ul class="menu w-full flex-1 overflow-y-auto py-1">
            <li v-for="opt in menuOptions" :key="String(opt.key)">
              <!-- Parent item (with children) -->
              <template v-if="opt.children && opt.children.length > 0">
                <div
                  :class="[
                    'flex items-center rounded-xl cursor-pointer select-none transition-all duration-200',
                    isCollapsed ? 'justify-center px-0' : 'px-3',
                    expandedMenus.has(String(opt.key))
                      ? 'bg-base-300/20 text-base-content'
                      : 'text-base-content/70 hover:bg-base-300/10 hover:text-base-content',
                  ]"
                  @click="isCollapsed ? (opt.key && handleMenuSelect(String(opt.key))) : toggleMenu(String(opt.key))"
                >
                  <a class="flex items-center gap-3 py-2.5 flex-1 min-w-0" :class="isCollapsed ? 'justify-center px-0' : ''">
                    <component
                      :is="iconMap[permission.menus.find(m => (m.path ?? String(m.id)) === opt.key)?.icon ?? ''] ?? (() => null)"
                      class="h-5 w-5 flex-shrink-0"
                    />
                    <span v-if="!isCollapsed" class="truncate text-sm font-medium">{{ opt.label }}</span>
                  </a>
                  <svg
                    v-if="!isCollapsed"
                    class="h-4 w-4 shrink-0 text-base-content/30 transition-transform duration-200"
                    :class="expandedMenus.has(String(opt.key)) ? 'rotate-90' : ''"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <ul
                  v-show="isCollapsed || expandedMenus.has(String(opt.key))"
                  class="overflow-hidden transition-all duration-200"
                >
                  <li v-for="child in opt.children" :key="String(child.key)">
                    <a
                      :class="[
                        activeMenuKey === child.key ? 'menu-active bg-primary/10 text-primary' : 'text-base-content/60 hover:text-base-content hover:bg-base-300/10',
                        'flex items-center gap-3 rounded-xl py-2 cursor-pointer transition-all duration-200 text-sm',
                        isCollapsed ? 'justify-center px-0' : 'pl-10 pr-3',
                      ]"
                      @click="child.key && handleMenuSelect(String(child.key))"
                    >
                      <template v-if="isCollapsed">
                        <span class="w-1.5 h-1.5 rounded-full" :class="activeMenuKey === child.key ? 'bg-primary' : 'bg-base-content/20'"></span>
                      </template>
                      <span v-else class="truncate">{{ child.label }}</span>
                    </a>
                  </li>
                </ul>
              </template>

              <!-- Leaf item (no children) -->
              <a
                v-else
                :class="[
                  activeMenuKey === opt.key ? 'menu-active bg-primary/10 text-primary' : 'text-base-content/70 hover:bg-base-300/10 hover:text-base-content',
                  'flex items-center gap-3 rounded-xl py-2.5 cursor-pointer transition-all duration-200',
                  isCollapsed ? 'justify-center px-0' : 'px-3',
                ]"
                @click="opt.key && handleMenuSelect(String(opt.key))"
              >
                <component
                  :is="iconMap[permission.menus.find(m => (m.path ?? String(m.id)) === opt.key)?.icon ?? ''] ?? (() => null)"
                  class="h-5 w-5 flex-shrink-0"
                />
                <span v-if="!isCollapsed" class="text-sm truncate">{{ opt.label }}</span>
              </a>
            </li>
          </ul>

          <!-- Bottom: Logout -->
          <div class="mt-auto px-2 py-2">
            <a
              :class="[
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs cursor-pointer',
                'text-base-content/50 hover:bg-base-300/40 hover:text-primary',
                isCollapsed && 'justify-center px-0'
              ]"
              @click="logout"
            >
              <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
              <span v-if="!isCollapsed">退出登录</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Main content area -->
    <div class="relative flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <div class="hidden h-14 shrink-0 items-center border-b border-base-content/10 px-4 md:flex">
        <button
          @click="isCollapsed = !isCollapsed"
          class="btn btn-ghost btn-sm btn-circle"
          title="切换侧边栏"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div class="ml-4 flex items-center gap-2 text-sm text-base-content/60">
          <span v-for="(crumb, i) in breadcrumbs" :key="i">
            <span v-if="i > 0" class="mx-2 text-base-content/20">/</span>
            <span>{{ crumb.label }}</span>
          </span>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <span class="text-sm text-base-content/70">{{ auth.user?.username ?? 'Guest' }}</span>
          <div class="avatar placeholder">
            <div class="bg-neutral text-neutral-content w-8 rounded-full">
              <span class="text-xs">{{ (auth.user?.username ?? 'G').charAt(0).toUpperCase() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Page content -->
      <div class="flex flex-1 flex-col overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
        <RouterView v-slot="{ Component, route }">
          <Transition name="fade" mode="out-in">
            <Component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </div>
    </div>

    <!-- Mobile bottom navigation -->
    <MobileDock />
  </div>
</template>
