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
        :indent="18"
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
  background: #0f172a !important;
  color: #94a3b8;
}

.admin-sider :deep(.n-layout-sider-scroll-container) {
  display: flex;
  flex-direction: column;
}

.admin-sider :deep(.n-menu) {
  background: transparent;
}

.admin-sider :deep(.n-menu-item) {
  color: #94a3b8;
}

.admin-sider :deep(.n-menu-item--selected) {
  color: #fff;
  background: rgba(56, 189, 248, 0.15) !important;
  border-right: 3px solid #38bdf8;
}

.admin-sider :deep(.n-menu-item:hover) {
  color: #fff;
  background: rgba(255, 255, 255, 0.06) !important;
}

.admin-sider :deep(.n-menu-item-content__icon) {
  color: #64748b;
}

.admin-sider :deep(.n-menu-item--selected .n-menu-item-content__icon) {
  color: #38bdf8;
}

.sider-logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.logo-btn {
  color: #94a3b8;
}

.logo-btn:hover {
  color: #fff;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.5px;
}

.admin-right {
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
}

.admin-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-left :deep(.n-breadcrumb-item__link) {
  color: #64748b;
  font-size: 14px;
}

.header-left :deep(.n-breadcrumb-item__separator) {
  color: #cbd5e1;
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
  background: #f1f5f9;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

.admin-content {
  flex: 1;
  overflow: auto;
  padding: 0;
  background: #f1f5f9;
}

.content-wrapper {
  padding: 20px 24px;
  min-height: 100%;
}
</style>
