# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ifoxchen's personal blog (ifoxchen.com) — a full-stack blog with Express 5 + SQLite backend, static HTML frontend with vanilla JS, and a cyberpunk-themed multi-theme design system.

## Commands

The **server directory** has its own `package.json` with the actual dependencies. The root `package.json` is used by Docker.

```bash
# Local development (from server/ directory)
cd server && npm install && npm run dev    # nodemon auto-reload
cd server && npm start                     # production mode

# Docker
docker build -t blog-design .
docker run -p 8787:8787 blog-design

# Deploy to remote server (from project root)
bash deploy.sh
# Or use AGENTS.md for manual SCP + SSH deployment steps
```

**No test suite or linter is configured.**

## Architecture

### Backend (`server/`)

- **`server/src/index.js`** — Main entry point. All routes defined here (REST API + admin EJS pages). Single-file monolith.
- **`server/src/db.js`** — SQLite setup via `better-sqlite3`. Schema migration (CREATE IF NOT EXISTS), seed data, tag/category CRUD helpers. DB file at `server/db/blog.sqlite`.
- **`server/src/auth.js`** — Session-based admin auth. Supports plaintext password or bcrypt hash (`ADMIN_PASSWORD_HASH`). Uses constant-time comparison.
- **`server/src/markdown.js`** — Markdown-to-HTML via `marked` + `sanitize-html` with conservative allowlist.
- **`server/src/env.js`** — Custom `.env` loader (reads `server/.env`). Exports `required()` / `optional()`.
- **`server/src/utils.js`** — `nowIso()`, `toInt()`, `normalizeSlug()` (via slugify), `splitTags()`.
- **`server/views/`** — EJS templates: `login.ejs`, `posts.ejs` (list), `edit.ejs` (create/edit), `links.ejs`.

### Frontend (root level)

Static HTML pages served by Express from the project root:
- `index.html` — Homepage with latest posts grid
- `post.html` — Single article view (slug-based)
- `archive.html` — Post archive with tag/category filtering and pagination
- `links.html` — External navigation links
- `about.html` — About page
- `components.html` — Component index/design reference

- **`js/blog.js`** — Page hydration: fetches from `/api/posts`, `/api/posts/:slug`, `/api/tags`, `/api/categories` and renders into the DOM. Handles index, archive, and post pages.
- **`js/theme.js`** — Theme system: 11 themes (cyberpunk, aurora, synthwave, neon, matrix, nord, dracula, github, monokai, sunset, forest) + dark/light mode. Persisted in localStorage.
- **`css/tokens.css`** — Design tokens (CSS custom properties): colors, typography, spacing. Theme variants defined here via `[data-theme="..."]` selectors.
- **`css/base.css`** — Reset and base styles.
- **`css/components.css`** — Component styles (cards, nav, footer, etc.).

### API Routes

Public: `GET /api/posts`, `GET /api/posts/:slug`, `GET /api/tags`, `GET /api/categories`, `GET /api/links`, `GET /rss.xml`

Admin (session auth required): `/api/admin/posts` (CRUD), `/api/admin/posts/:id/publish|unpublish`, `/api/admin/links` (CRUD), `/api/admin/upload` (image), `/api/admin/export`, `/api/admin/import`

Admin pages (EJS): `/admin/login`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit`, `/admin/links`

### Database Schema (SQLite)

Tables: `posts`, `tags`, `post_tags` (M2M), `categories`, `post_categories` (M2M), `external_links`. All timestamps as ISO strings.

### Deployment

Docker container on `192.168.3.100:8787`. Volumes persist `server/db/` (SQLite) and `server/public/uploads/` (images). SSH key at `C:/Users/陈科/.ssh/blog_deploy`. See `AGENTS.md` for detailed deployment steps.

## Key Conventions

- Server uses CommonJS (`require`/`module.exports`), not ESM.
- Two `package.json` files: root (Docker context) and `server/` (dev). Install deps in `server/`.
- Admin auth is session-based (express-session), not JWT.
- Markdown content stored raw in DB; `contentHtml` is lazily rendered (set to NULL on update, rendered on read).
- Slugs are generated via `slugify` with `strict: true` (lowercase, alphanumeric + hyphens only).
- Environment variables loaded from `server/.env` (copy from `.env.example`).
