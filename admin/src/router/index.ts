import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from './guards'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
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
        // 工作台 (Open WebUI iframe)
        {
          path: '/cms/workspace',
          name: 'cms-workspace',
          component: () => import('../views/workspace/index.vue'),
        },
        // 保留看板
        {
          path: '/cms/kanban',
          name: 'cms-kanban',
          component: () => import('../views/workspace/kanban.vue'),
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
          path: '/cms',
          redirect: '/cms/posts',
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
        // 知识库
        {
          path: '/cms/kb/documents',
          name: 'kb-documents',
          component: () => import('../views/kb/documents/index.vue'),
          meta: { permission: 'kb:list' },
        },
        {
          path: '/cms/kb/documents/new',
          name: 'kb-document-new',
          component: () => import('../views/kb/documents/edit.vue'),
          meta: { permission: 'kb:create' },
        },
        {
          path: '/cms/kb/documents/:id/edit',
          name: 'kb-document-edit',
          component: () => import('../views/kb/documents/edit.vue'),
          meta: { permission: 'kb:update' },
        },
        {
          path: '/cms/kb/canvases',
          name: 'kb-canvases',
          component: () => import('../views/kb/canvases/index.vue'),
          meta: { permission: 'kb:list' },
        },
        {
          path: '/cms/kb/canvases/:id',
          name: 'kb-canvas-editor',
          component: () => import('../views/kb/canvases/editor.vue'),
          meta: { permission: 'kb:update' },
        },
        {
          path: '/cms/kb/sync',
          name: 'kb-sync',
          component: () => import('../views/kb/sync/index.vue'),
          meta: { permission: 'kb:sync' },
        },
        {
          path: '/cms/kb/graph',
          name: 'kb-graph',
          component: () => import('../views/kb/graph/index.vue'),
          meta: { permission: 'kb:list' },
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
          path: '/cms/rbac',
          redirect: '/cms/rbac/users',
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
