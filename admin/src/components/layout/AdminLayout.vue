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
  PeopleOutline,
  SettingsOutline,
  LogOutOutline,
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
  HomeOutline,
  DocumentTextOutline,
  PeopleOutline,
  SettingsOutline,
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
  <NLayout style="height: 100vh">
    <NLayoutHeader
      bordered
      style="
        height: 64px;
        padding: 0 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      "
    >
      <div style="display: flex; align-items: center; gap: 12px">
        <NButton text @click="collapsed = !collapsed">
          <NIcon size="20">
            <MenuOutline />
          </NIcon>
        </NButton>
        <span style="font-size: 18px; font-weight: 600">Admin</span>
      </div>

      <NDropdown :options="userOptions" @select="handleUserSelect">
        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          "
        >
          <span>{{ auth.user?.username ?? 'Guest' }}</span>
        </div>
      </NDropdown>
    </NLayoutHeader>

    <NLayout has-sider style="height: calc(100vh - 64px)">
      <NLayoutSider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="200"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false"
      >
        <NMenu
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          :value="activeMenuKey"
          @update:value="handleMenuSelect"
        />
      </NLayoutSider>

      <NLayoutContent style="padding: 24px">
        <NBreadcrumb style="margin-bottom: 16px">
          <NBreadcrumbItem
            v-for="(crumb, i) in breadcrumbs"
            :key="i"
          >
            {{ crumb.label }}
          </NBreadcrumbItem>
        </NBreadcrumb>
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
