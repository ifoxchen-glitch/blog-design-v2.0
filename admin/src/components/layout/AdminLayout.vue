<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NBreadcrumb,
  NBreadcrumbItem,
  NDropdown,
  NButton,
  NIcon,
} from 'naive-ui'
import {
  MenuOutline,
  HomeOutline,
  DocumentTextOutline,
  DocumentOutline,
  PricetagOutline,
  FolderOutline,
  LinkOutline,
  ImageOutline,
  ShieldCheckmarkOutline,
  PersonOutline,
  PeopleOutline,
  KeyOutline,
  MenuOutline as MenuIconOutline,
  BarChartOutline,
  SettingsOutline,
  ReceiptOutline,
  ArchiveOutline,
  PulseOutline,
  LogOutOutline,
  GridOutline,
} from '@vicons/ionicons5'
import type { Component } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePermissionStore } from '../../stores/permission'
import { buildOptions, findActiveKey } from './menuUtils'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const permission = usePermissionStore()

const collapsed = ref(false)

const iconMap: Record<string, Component> = {
  DashboardOutline: GridOutline,
  DocumentTextOutline,
  DocumentOutline,
  PricetagOutline,
  FolderOutline,
  LinkOutline,
  ImageOutline,
  ShieldCheckmarkOutline,
  PersonOutline,
  PeopleOutline,
  KeyOutline,
  MenuOutline: MenuIconOutline,
  BarChartOutline,
  SettingsOutline,
  ReceiptOutline,
  ArchiveOutline,
  PulseOutline,
  HomeOutline,
  LogOutOutline,
}

function renderIcon(name: string | null) {
  if (!name) return undefined
  const comp = iconMap[name]
  if (!comp) return undefined
  return () => h(NIcon, null, { default: () => h(comp) })
}

const menuOptions = computed(() =>
  buildOptions(permission.menus).map((opt) => ({
    ...opt,
    icon: renderIcon(
      permission.menus.find((m) => (m.path ?? String(m.id)) === opt.key)?.icon ??
        null,
    ),
  })),
)

const activeMenuKey = computed(() => {
  return findActiveKey(menuOptions.value, route.path) ?? route.path
})

function handleMenuSelect(key: string) {
  if (key && key.startsWith('/')) {
    router.push(key)
  }
}

const breadcrumbs = computed(() => {
  return route.matched
    .filter((r) => r.name && r.path !== '/')
    .map((r) => ({
      label: String(r.name),
      path: r.path,
    }))
})

const userOptions = computed(() => [
  {
    label: '退出登录',
    key: 'logout',
    icon: renderIcon('LogOutOutline'),
  },
])

function handleUserSelect(key: string) {
  if (key === 'logout') {
    auth.logout().finally(() => {
      router.push('/login')
    })
  }
}
</script>

<template>
  <NLayout class="admin-layout" has-sider>
    <NLayoutSider
      class="admin-sider"
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      show-trigger
      bordered
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="sider-logo">
        <NButton text class="logo-btn" @click="collapsed = !collapsed">
          <NIcon size="22">
            <MenuOutline />
          </NIcon>
        </NButton>
        <span v-show="!collapsed" class="logo-text">Admin</span>
      </div>
      <NMenu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="20"
        :options="menuOptions"
        :value="activeMenuKey"
        :indent="10"
        class="admin-menu"
        @update:value="handleMenuSelect"
      />
    </NLayoutSider>

    <NLayout class="admin-right">
      <NLayoutHeader class="admin-header" bordered>
        <div class="header-left">
          <NBreadcrumb>
            <NBreadcrumbItem
              v-for="(crumb, i) in breadcrumbs"
              :key="i"
            >
              {{ crumb.label }}
            </NBreadcrumbItem>
          </NBreadcrumb>
        </div>
        <div class="header-right">
          <NDropdown :options="userOptions" @select="handleUserSelect">
            <div class="user-info">
              <span class="user-name">{{ auth.user?.username ?? 'Guest' }}</span>
            </div>
          </NDropdown>
        </div>
      </NLayoutHeader>

      <NLayoutContent class="admin-content">
        <div class="content-wrapper">
          <RouterView :key="route.fullPath" />
        </div>
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.admin-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.admin-sider {
  background: #0a0e17 !important;
  color: #6b7280;
}

.admin-sider :deep(.n-layout-sider-scroll-container) {
  display: flex;
  flex-direction: column;
}

.admin-sider :deep(.n-menu) {
  background: transparent;
}

.admin-sider :deep(.n-menu-item) {
  color: #6b7280;
}

.admin-sider :deep(.n-menu-item--selected) {
  color: #f0f0f0;
  background: rgba(255, 255, 255, 0.06) !important;
  border-right: 2px solid #4b5563;
}

.admin-sider :deep(.n-menu-item:hover) {
  color: #f0f0f0;
  background: rgba(255, 255, 255, 0.04) !important;
}

.admin-sider :deep(.n-menu-item-content) {
  padding-left: 16px !important;
}

.admin-sider :deep(.n-menu-item-content__icon) {
  color: #4b5563;
}

.admin-sider :deep(.n-menu-item--selected .n-menu-item-content__icon) {
  color: #9ca3af;
}

.sider-logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.logo-btn {
  color: #6b7280;
}

.logo-btn:hover {
  color: #f0f0f0;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #f0f0f0;
  letter-spacing: 0.5px;
}

.admin-right {
  display: flex;
  flex-direction: column;
  background: #0a0e17;
}

.admin-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0a0e17 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.header-left :deep(.n-breadcrumb-item__link) {
  color: #6b7280;
  font-size: 14px;
}

.header-left :deep(.n-breadcrumb-item__separator) {
  color: #374151;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.04);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}

.admin-content {
  flex: 1;
  overflow: auto;
  padding: 0;
  background: #0a0e17;
}

.content-wrapper {
  padding: 16px 20px;
  min-height: 100%;
}
</style>
