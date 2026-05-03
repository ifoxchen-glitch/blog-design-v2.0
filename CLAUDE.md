# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ifoxchen's personal blog (ifoxchen.com) — a full-stack blog with a dual-port architecture:
- **Front port (8787)**: Express 5 + SQLite legacy blog (static HTML frontend, EJS admin).
- **Admin port (3000)**: Express 5 + JWT + RBAC v2 API, consumed by a Vue 3 SPA in `admin/`.

Phase 1 (completed) established the dual-port foundation, JWT auth, RBAC seed, and the Vue 3 admin skeleton.

## Commands

### Server (from `server/` directory)

```bash
cd server && npm install && npm run dev    # nodemon auto-reload, both ports
cd server && npm start                     # production mode
```

### Admin SPA (from `admin/` directory)

```bash
cd admin && npm install && npm run dev     # Vite dev server on 5173
cd admin && npm run build                  # vue-tsc + vite build → dist/
```

### Docker (from project root)

```bash
docker build -t blog-design .
docker run -p 8787:8787 -p 3000:3000 blog-design
```

### Deploy

```bash
bash deploy.sh
```

**No test suite or linter is configured.** Verification is done via `npx tsx scripts/check-*.ts` scripts.

## Architecture

### Backend (`server/`)

**Dual-port entry**: `server/src/index.js` bootstraps two Express apps:
- `frontApp` @ `PORT` (default 8787) — legacy blog + EJS admin.
- `adminApp` @ `ADMIN_PORT` (default 3000) — v2 JWT/RBAC API.

**Key files**:
- `server/src/apps/frontApp.js` — Lift-and-shift of the original 880-line monolith (public API + old admin EJS + old admin API).
- `server/src/apps/adminApp.js` — v2 API mount point (`/api/v2`).
- `server/src/db.js` — SQLite via `better-sqlite3`. Schema migration, seed data, CRUD helpers. DB at `server/db/blog.sqlite`.
- `server/src/auth.js` — Session-based auth (legacy EJS admin). Constant-time comparison, bcrypt hash support.
- `server/src/middleware/jwtAuth.js` — Access-token verification, mounts `req.user`.
- `server/src/middleware/rbac.js` — `requirePermission(code)` factory. Super admin bypass.
- `server/src/middleware/cors.js` — Dev-only CORS (5173 / 8787 → 3000).
- `server/src/seeds/rbacSeed.js` — RBAC seed: 12 permissions, 3 roles, default menu tree, super admin.
- `server/src/env.js` — `.env` loader. Exports `required()` / `optional()`.
- `server/src/utils.js` — `nowIso()`, `toInt()`, `normalizeSlug()`, `splitTags()`.

**Database Schema (SQLite)**:
- Legacy: `posts`, `tags`, `post_tags`, `categories`, `post_categories`, `external_links`.
- v2 RBAC: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `menus`.
- v2 audit/ops: `audit_logs`, `front_users`, `page_views`, `sites`.

### Frontend — Legacy (root level)

Static HTML served by `frontApp` from project root:
- `index.html`, `post.html`, `archive.html`, `links.html`, `about.html`, `components.html`
- `js/blog.js` — Page hydration (fetches `/api/posts`, `/api/posts/:slug`, `/api/tags`, `/api/categories`).
- `js/theme.js` — 11 themes + dark/light mode.
- `css/tokens.css`, `css/base.css`, `css/components.css` — Design system.

### Frontend — Admin v2 (`admin/`)

Vue 3.5 + Vite 8 + TypeScript + Naive UI + Pinia 3 + Vue Router 5.

**Key files**:
- `admin/src/main.ts` — App bootstrap, global `v-permission` directive.
- `admin/src/router/index.ts` — Route definitions, `/dashboard` nested under `AdminLayout`.
- `admin/src/router/guards.ts` — `beforeEach`/`afterEach`: public routes, auth redirect, bootstrap dedup (`/me` + `/menus` once), permission gate, failure handling.
- `admin/src/stores/auth.ts` — Pinia store: tokens, user info, login/logout/fetchMe. Hydrated from localStorage.
- `admin/src/stores/permission.ts` — Menu tree + permission code set. `hasPermission(code)` with super_admin bypass.
- `admin/src/api/request.ts` — Axios instance with Bearer injection, 401 → refresh + retry, 401-refresh-fail → `onUnauthorized`.
- `admin/src/api/auth.ts` — Typed wrappers: `apiLogin`, `apiLogout`, `apiMe`, `apiMenus`.
- `admin/src/components/layout/AdminLayout.vue` — Collapsible sidebar (menu from store), top bar (logo, breadcrumb, user dropdown), main `<RouterView>`.
- `admin/src/views/dashboard/index.vue` — Dashboard placeholder (welcome + stat cards).
- `admin/src/views/login/index.vue` — Login form with `extractErrorMessage` + `resolveRedirect` helpers.
- `admin/src/views/error/403.vue` — Forbidden page with `from` query display.
- `admin/src/directives/permission.ts` — `v-permission="'post:list'"` or `v-permission="['post:list', 'post:create']"`. Removes DOM element when denied.

**Verifier scripts** (run from `admin/`):
- `scripts/check-auth-store.ts` — Login, hydration, logout, reset.
- `scripts/check-axios-request.ts` — Token injection, 401 refresh, concurrent dedup.
- `scripts/check-permission-store.ts` — loadMenus, loadPermissions, hasPermission, reset.
- `scripts/check-login-page.ts` — extractErrorMessage, resolveRedirect, e2e login.
- `scripts/check-route-guards.ts` — Public routes, auth redirect, bootstrap once, permission gate, failure.
- `scripts/check-admin-layout.ts` — Menu helpers, router nesting.
- `scripts/check-dashboard.ts` — Dashboard content + route wiring.
- `scripts/check-v-permission.ts` — Directive single/array/OR, dynamic update, super_admin.
- `scripts/check-integration.ts` — End-to-end: login → bootstrap → dashboard → logout.

### API Routes

**Public (frontApp)**:
- `GET /api/posts`, `GET /api/posts/:slug`, `GET /api/tags`, `GET /api/categories`, `GET /api/links`, `GET /rss.xml`

**Legacy admin (frontApp, session auth)**:
- `/api/admin/posts` (CRUD), `/api/admin/posts/:id/publish|unpublish`, `/api/admin/links`, `/api/admin/upload`, `/api/admin/export`, `/api/admin/import`
- EJS pages: `/admin/login`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/links`

**v2 admin (adminApp, JWT auth)**:
- `POST /api/v2/auth/login` — bcrypt, returns access + refresh tokens.
- `POST /api/v2/auth/refresh` — refresh token → new access token.
- `POST /api/v2/auth/logout` — best-effort server-side.
- `GET /api/v2/auth/me` — user profile + permissions.
- `GET /api/v2/auth/menus` — server-side filtered menu tree.

Standard response shape: `{ code, message, data }`.

## Key Conventions

- Server uses CommonJS (`require`/`module.exports`), not ESM.
- Admin uses ESM + TypeScript (`import`/`export`).
- Two `package.json` files: root (Docker) and `server/` (dev backend) and `admin/` (Vue SPA). Install deps in the respective directory.
- Legacy admin auth is session-based (express-session); v2 admin auth is JWT (Bearer tokens).
- JWT payload: `{ userId, username, roles, type: 'admin' }` (2h access) + `{ userId, type: 'refresh' }` (7d).
- Super admin (`is_super_admin = 1` or `user.isSuperAdmin`) bypasses all RBAC checks.
- Markdown content stored raw in DB; `contentHtml` lazily rendered on read.
- Slugs via `slugify` with `strict: true`.
- Environment variables loaded from `server/.env` (copy from `.env.example`).
