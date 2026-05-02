# server/src/apps/

双端口子应用层 — 把 Express 实例按"前台 / 后台"切成两个独立 app，挂载各自路由后由 `index.js` 分别 listen 不同端口。

## 计划文件清单

| 文件 | 端口 | 职责 |
|------|------|------|
| `frontApp.js` | `:8787` | 静态文件（`BLOG_ROOT`）+ 公共 API `/api/*` + 旧后台 `/api/admin/*`（Session 鉴权）+ 前台预留 `/api/front/*` + EJS 模板（`/admin/...`） |
| `adminApp.js` | `:3000` | Vue 3 SPA 静态产物（`admin-dist/`）+ 新管理 API `/api/v2/*`（JWT + RBAC）+ CORS（开发环境）|

## 设计要点

- **共享数据库连接**：两个 app 同时 `require('../db')`，同一个 better-sqlite3 实例；SQLite WAL 模式保证并发安全。
- **共享 session store**：旧后台需要 session 在 8787 端口生效，但 3000 端口不再使用 session。
- **彼此互不感知**：`frontApp` 不知道 `adminApp` 存在，反之亦然，便于将来拆成两个独立进程。
- **生产环境**：Nginx 把 `/admin/*` 反代到 3000，其他打到 8787，浏览器侧只看到一个域名。

## 约定

- 每个 app 文件只 `module.exports = app`，不调用 `app.listen()`（listen 由顶层 `index.js` 完成）。
- 中间件挂载顺序：`requestLogger → cors（仅 admin）→ jwtAuth（仅 admin）→ 业务路由 → errorHandler`。
- 路由前缀：
  - frontApp：`/api/*`、`/api/admin/*`、`/api/front/*`、`/admin/*`（EJS）、`/`（静态）
  - adminApp：`/api/v2/*`、`/admin/*`（SPA history fallback）

## 详见

- 双端口隔离设计：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §2.1 / §9.4
- 实施任务：[`docs/05-implementation-plan.md`](../../../docs/05-implementation-plan.md) Phase 1
