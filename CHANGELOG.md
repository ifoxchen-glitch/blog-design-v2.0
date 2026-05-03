# Changelog

## Phase 1 — 基础脚手架（2026-05-03）

Phase 1 完成双端口后端骨架、JWT 认证体系、RBAC 种子、Vue 3 SPA 登录闭环。

### 后端

- **T1.1** 新建后端目录结构：`middleware/`、`apps/`、`modules/`、`jobs/`、`seeds/`。
- **T1.2** 安装新依赖：`jsonwebtoken`、`bcryptjs`、`cors`、`joi`、`helmet`。
- **T1.3** 数据库迁移：新增 10 张 v2 表 — `users`、`roles`、`permissions`、`role_permissions`、`user_roles`、`menus`、`audit_logs`、`front_users`、`page_views`、`sites`。
- **T1.4** RBAC 种子：12 个权限、3 个角色、默认菜单树、超级管理员账号（从 `.env` 读取）。
- **T1.5** 拆分 `apps/frontApp.js`，将原 880 行 monolith 迁入，保留全部现有路由和中间件。
- **T1.6** 新建 `apps/adminApp.js`，挂载 `/api/v2` 前缀。
- **T1.7** 改造 `index.js` 为双端口同进程启动（frontApp@8787 + adminApp@3000）。
- **T1.8** 开发环境 CORS 中间件（5173 / 8787 → 3000）。
- **T1.9** JWT 认证中间件 — accessToken 校验、挂载 `req.user`。
- **T1.10** RBAC 中间件 — `requirePermission(code)`，超管直接放行。
- **T1.11** `/api/v2/auth/login` — bcrypt 校验、签发 access + refresh token。
- **T1.12** `/api/v2/auth/refresh` — refresh token 校验与续期。
- **T1.13** `/api/v2/auth/logout`、`/api/v2/auth/me`、`/api/v2/auth/menus` — `/menus` 按用户角色返回过滤后的树。

### 前端（admin/）

- **T1.14** 初始化 Vue 3 + Vite + TypeScript 项目。
- **T1.15** 配置 Naive UI、Tailwind CSS、Pinia、Vue Router。
- **T1.16** Vite 代理配置 — `/api` 转发到 `localhost:3000`。
- **T1.17** Axios 请求模块 — Bearer 注入、401 自动刷新、并发 dedup。
- **T1.18** `stores/auth.ts` — token + 用户信息 + login/logout/fetchMe，localStorage 持久化。
- **T1.19** `stores/permission.ts` — 菜单树 + 权限码集合，`hasPermission(code)` 含超管 bypass。
- **T1.20** 登录页 — 表单 + 错误提取 + open-redirect 防护 + 网络异常兜底。
- **T1.21** 路由守卫 — public 路由、未登录重定向、已登录访问 /login 跳 dashboard、bootstrap 去重、权限门控、失败清理。
- **T1.22** `AdminLayout.vue` — 可折叠侧边栏（按权限渲染菜单）、顶栏（面包屑 + 用户下拉）、主区域 RouterView。
- **T1.23** Dashboard 占位页 — 欢迎语 + 统计卡片占位。
- **T1.24** `v-permission` 指令 — 支持单值和数组（OR 逻辑），无权限时 DOM 不生成。
- **T1.25** Phase 1 集成验收脚本 — 端到端验证：登录 → bootstrap → dashboard → 权限校验 → 登出。

### 文档

- **T1.26** 更新 `CLAUDE.md`（双端口架构、目录结构、API 路由、前端模块）。
- **T1.26** 新建 `README.md`（5 分钟快速开始 + 项目结构 + 常用命令）。
- **T1.26** 新建 `CHANGELOG.md`（Phase 1 变更汇总）。

---

## 后续阶段（计划中）

- **Phase 2** — RBAC + CMS 迁移（用户/角色/权限/菜单管理页，文章/标签/分类/友链 CRUD）
- **Phase 3** — 数据分析（PV/UV 采集、Dashboard 图表）
- **Phase 4** — 运维监控（审计日志、备份、系统状态看板）
- **Phase 5** — 上线 + 旧 EJS 后台下线
