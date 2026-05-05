import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from './guards'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/About.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/index.vue'),
      meta: { public: true },
    },
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('../views/error/403.vue'),
      meta: { public: true },
    },
    {
      path: '/dashboard',
      component: () => import('../components/layout/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/dashboard/index.vue'),
        },
        {
          path: '/cms/dashboard',
          name: 'cms-dashboard',
          component: () => import('../views/dashboard/index.vue'),
        },
        {
          path: '/cms/analytics',
          name: 'cms-analytics',
          component: () => import('../views/dashboard/index.vue'),
          meta: { permission: 'analytics:view' },
        },
        {
          path: '/cms/tags',
          name: 'cms-tags',
          component: () => import('../views/cms/tags/index.vue'),
          meta: { permission: 'tag:list' },
        },
        {
          path: '/cms/categories',
          name: 'cms-categories',
          component: () => import('../views/cms/categories/index.vue'),
          meta: { permission: 'category:list' },
        },
        {
          path: '/cms/links',
          name: 'cms-links',
          component: () => import('../views/cms/links/index.vue'),
          meta: { permission: 'link:list' },
        },
        {
          path: '/cms/posts',
          name: 'cms-posts',
          component: () => import('../views/cms/posts/index.vue'),
          meta: { permission: 'post:list' },
        },
        {
          path: '/cms/posts/new',
          name: 'cms-post-new',
          component: () => import('../views/cms/posts/edit.vue'),
          meta: { permission: 'post:create' },
        },
        {
          path: '/cms/posts/:id/edit',
          name: 'cms-post-edit',
          component: () => import('../views/cms/posts/edit.vue'),
          meta: { permission: 'post:update' },
        },
        {
          path: '/cms/media',
          name: 'cms-media',
          component: () => import('../views/cms/media/index.vue'),
          meta: { permission: 'post:list' },
        },
        {
          path: '/cms/backup',
          name: 'cms-backup',
          component: () => import('../views/cms/backup/index.vue'),
          meta: { permission: 'cms:export' },
        },
        {
          path: '/cms/ops/backup',
          name: 'cms-ops-backup',
          component: () => import('../views/cms/ops/backup/index.vue'),
          meta: { permission: 'ops:backup' },
        },
        {
          path: '/cms/ops/logs',
          name: 'cms-ops-logs',
          component: () => import('../views/cms/ops/logs/index.vue'),
          meta: { permission: 'ops:logs' },
        },
        {
          path: '/cms/ops/monitor',
          name: 'cms-ops-monitor',
          component: () => import('../views/cms/ops/monitor/index.vue'),
          meta: { permission: 'ops:monitor' },
        },
        {
          path: '/cms/rbac/users',
          name: 'rbac-users',
          component: () => import('../views/rbac/users/index.vue'),
          meta: { permission: 'user:list' },
        },
        {
          path: '/cms/rbac/roles',
          name: 'rbac-roles',
          component: () => import('../views/rbac/roles/index.vue'),
          meta: { permission: 'role:assign' },
        },
        {
          path: '/cms/rbac/permissions',
          name: 'rbac-permissions',
          component: () => import('../views/rbac/permissions/index.vue'),
          meta: { permission: 'role:assign' },
        },
        {
          path: '/cms/rbac/menus',
          name: 'rbac-menus',
          component: () => import('../views/rbac/menus/index.vue'),
          meta: { permission: 'menu:manage' },
        },
      ],
    },
  ],
})

installGuards(router)

export default router
