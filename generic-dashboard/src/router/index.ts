import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/OverviewPage.vue'),
    },
    {
      path: '/traffic',
      component: () => import('@/views/TrafficPage.vue'),
    },
    {
      path: '/connections',
      component: () => import('@/views/ConnectionsPage.vue'),
    },
    {
      path: '/proxies',
      component: () => import('@/views/ProxiesPage.vue'),
    },
    {
      path: '/rules',
      component: () => import('@/views/RulesPage.vue'),
    },
    {
      path: '/dns',
      component: () => import('@/views/DNSPage.vue'),
    },
    {
      path: '/logs',
      component: () => import('@/views/LogsPage.vue'),
    },
    {
      path: '/profiles',
      component: () => import('@/views/ProfilesPage.vue'),
    },
    {
      path: '/config',
      component: () => import('@/views/ConfigPage.vue'),
    },
    {
      path: '/settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
    {
      path: '/components',
      component: () => import('@/views/ComponentsPage.vue'),
    },
    {
      path: '/topology',
      component: () => import('@/views/TopologyPage.vue'),
    },
  ],
})

export default router
