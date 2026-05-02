# 超级后台系统 (Super Admin) 整体架构设计

> 版本：v1.1 | 日期：2026/05/02
> 目标：在保留现有博客后台功能的基础上，构建可扩展的统一管理平台，预留多站点 CMS、RBAC、数据分析、运维监控等模块的接入能力。
> **关键约束**：业务前台与业务后台通过**不同端口**访问，开发环境完全分离，生产环境通过 Nginx 合并到同一域名。

---

## 1. 设计目标与核心原则

### 1.1 设计目标
- **端口分离**：前台博客服务（端口 `8787`）与后台管理服务（端口 `3000`）物理隔离，互不干扰。
- **保留兼容**：现有 `/api/admin/*` 接口与 EJS 管理后台保留在 8787 端口，新系统通过 `3000` 端口的 `/api/v2/*` 渐进式扩展。
- **模块解耦**：各子系统（博客 CMS、权限、分析、运维）按模块组织，便于独立开发与横向扩展。
- **前后端分离**：新管理后台采用 Vue 3 SPA，通过独立端口与 Express 后端通信。
- **统一认证**：从单用户 Session 升级为 JWT + 多用户 + RBAC，支持未来多租户场景；不同端口的认证天然适合 JWT。
- **平滑迁移**：分阶段实施，每阶段都有可工作的交付物，避免大爆炸式重构。

### 1.2 核心原则
- **最小破坏**：不改现有前端页面（`index.html`、`post.html` 等）的 API 契约。
- **同构演进**：后端保留 Express 单体，但通过目录与路由分层实现模块化。
- **端口隔离**：前台与后台运行在不同端口，代码层面通过子应用隔离路由，数据库共享（SQLite WAL 模式支持安全并发）。
- **SQLite 优先**：继续使用 `better-sqlite3`，通过表扩展满足需求，暂不需要引入独立数据库服务。

---

## 2. 整体架构概览（双端口隔离）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端 (Client)                                   │
│  ┌──────────────────┐  ┌──────────────────────────────────────────────┐    │
│  │   博客前台         │  │           超级后台 (Vue 3 SPA)                │    │
│  │  (端口 8787)       │  │           (端口 3000)                         │    │
│  │  index.html        │  │  ┌────────┬────────┬────────┬────────┐      │    │
│  │  post.html ...     │  │  │  CMS   │  RBAC  │ 数据   │ 运维   │      │    │
│  │                    │  │  │  模块   │  模块   │ 分析   │ 监控   │      │    │
│  └──────────────────┘  │  └────────┴────────┴────────┴────────┘      │    │
│                        └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐    ┌──────────────────────────────────────────────────┐
│  前台服务 (Front App) │    │              后台服务 (Admin App)                 │
│    端口 :8787        │    │                端口 :3000                          │
│                      │    │                                                  │
│  ┌────────────────┐  │    │  ┌─────────────────────────────────────────────┐ │
│  │ 静态文件服务    │  │    │  │  Vue SPA 静态文件 (dist -> /admin)           │ │
│  │ (BLOG_ROOT)    │  │    │  │  单页路由 history fallback                   │ │
│  └────────────────┘  │    │  └─────────────────────────────────────────────┘ │
│  ┌────────────────┐  │    │  ┌─────────────────────────────────────────────┐ │
│  │ 公共 API        │  │    │  │          v2 Admin API                        │ │
│  │ /api/*         │  │    │  │     /api/v2/*  (JWT + RBAC)                  │ │
│  │ (保留)          │  │    │  └─────────────────────────────────────────────┘ │
│  └────────────────┘  │    │                                                  │
│  ┌────────────────┐  │    │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ 旧 Admin API    │  │    │  │  Core  │ │  RBAC  │ │Analytics│ │   Ops  │   │
│  │ /api/admin/*   │  │    │  │ (核心)  │ │(权限)  │ │ (统计)  │ │(运维)  │   │
│  │ (Session)      │  │    │  └────────┘ └────────┘ └────────┘ └────────┘   │
│  └────────────────┘  │    │                                                  │
│  ┌────────────────┐  │    │  ┌──────────────┐  ┌──────────────┐            │
│  │ 前台预留 API    │  │    │  │  jwtAuth     │  │ rbac 中间件   │            │
│  │ /api/front/*   │  │    │  │  中间件       │  │ (权限校验)    │            │
│  │ (预留读者)      │  │    │  └──────────────┘  └──────────────┘            │
│  └────────────────┘  │    └──────────────────────────────────────────────────┘
└─────────────────────┘                  │
                                         │
         ┌───────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         共享数据层 (SQLite - blog.sqlite)                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ posts  │ │ users  │ │ roles  │ │permissions│ │ audit_logs│ │ sites   │        │
│  │ tags   │ │user_roles│ │role_permissions│ │ menus    │ │ front_users│        │
│  │categories│ │        │ │        │ │         │ │ page_views│        │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 双端口隔离说明

| 维度 | 前台服务 (端口 8787) | 后台服务 (端口 3000) |
|------|----------------------|----------------------|
| **用途** | 博客站点访问、文章阅读 | 管理后台、系统配置 |
| **前端** | 静态 HTML (现有) | Vue 3 SPA (新增) |
| **认证** | 无认证（预留读者 JWT） | JWT + RBAC |
| **API 前缀** | `/api/*` (公共) + `/api/admin/*` (旧 Session) | `/api/v2/*` (新管理) |
| **EJS 模板** | 保留（`views/`） | 不再使用 |
| **跨域** | 开发环境无跨域 | 开发环境需 CORS（Vue dev server → 3000） |

两个服务运行在同一个 Node.js 进程内，共享数据库连接（SQLite WAL 模式保证并发安全），但路由与中间件隔离，逻辑上视为两个独立应用。

### 2.2 开发 vs 生产访问方式

| 环境 | 前台访问 | 后台访问 | 跨域处理 |
|------|----------|----------|----------|
| **开发** | `http://localhost:8787` | `http://localhost:3000` | 后台开启 CORS，允许 `localhost:8787` 和 `localhost:5173`（Vue dev server） |
| **生产** | `https://ifoxchen.com` | `https://ifoxchen.com/admin/*` | Nginx 统一代理，无跨域问题 |

生产环境 Nginx 把所有 `/admin/*` 请求代理到后台 3000 端口，Vue SPA 的 API 请求仍打到同域名，浏览器感知不到端口差异。

---

## 3. 前端架构：Vue 3 SPA

### 3.1 技术栈选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建工具 | Vite 6 | 快速冷启动，按需编译 |
| 框架 | Vue 3.4 + TypeScript | Composition API，类型安全 |
| 路由 | Vue Router 4 | 动态路由 + 路由守卫 |
| 状态管理 | Pinia | 轻量，TS 友好 |
| UI 组件库 | Naive UI | 现代设计，原生暗色主题，与赛博朋克风格兼容 |
| HTTP 客户端 | Axios | 统一拦截器处理 JWT 续期 |
| 图表库 | ECharts 5 | 数据分析模块使用 |
| 样式 | Tailwind CSS 3 | 原子类 + CSS 变量，与现有 design tokens 对齐 |
| 工具库 | VueUse | 常用组合式函数 |

### 3.2 前端目录结构

```
admin/                          # 超级后台前端根目录
├── public/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── App.vue                 # 根组件
│   ├── router/
│   │   ├── index.ts            # 路由实例
│   │   ├── guards.ts           # 路由守卫 (权限校验)
│   │   └── routes.ts           # 路由表 (按模块拆分)
│   ├── stores/
│   │   ├── auth.ts             # 认证状态 (token, userInfo)
│   │   ├── permission.ts       # 权限状态 (menus, buttons)
│   │   └── app.ts              # 应用全局状态 (theme, sidebar)
│   ├── api/
│   │   ├── request.ts          # Axios 实例与拦截器
│   │   ├── auth.ts             # 认证相关接口
│   │   ├── blog.ts             # 博客 CMS 接口
│   │   ├── rbac.ts             # 用户/角色/权限接口
│   │   ├── analytics.ts        # 数据统计接口
│   │   └── ops.ts              # 运维监控接口
│   ├── components/
│   │   ├── common/             # 通用组件 (PageHeader, DataTable, FormDrawer)
│   │   └── layout/             # 布局组件 (AdminLayout, Sidebar, TopBar)
│   ├── views/
│   │   ├── login/
│   │   │   └── index.vue       # 登录页
│   │   ├── dashboard/
│   │   │   └── index.vue       # 工作台首页
│   │   ├── cms/
│   │   │   ├── posts/
│   │   │   ├── tags/
│   │   │   ├── categories/
│   │   │   ├── links/
│   │   │   └── media/          # 图库/上传管理
│   │   ├── rbac/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── permissions/
│   │   │   └── menus/          # 动态菜单配置
│   │   ├── analytics/
│   │   │   ├── overview.vue    # 数据概览
│   │   │   ├── traffic.vue     # 流量分析
│   │   │   └── content.vue     # 内容分析
│   │   └── ops/
│   │       ├── logs.vue        # 操作日志
│   │       ├── backups.vue     # 备份管理
│   │       └── monitor.vue     # 系统监控
│   ├── composables/            # 组合式函数 (useTable, useForm, usePermission)
│   ├── directives/             # 自定义指令 (v-permission)
│   ├── types/                  # 全局 TypeScript 类型
│   └── utils/                  # 工具函数
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

### 3.3 关键设计点
- **动态菜单**：后端根据当前用户角色返回菜单树，前端渲染侧边栏；无权限的菜单自动隐藏。
- **按钮级权限**：通过 `v-permission="'post:delete'"` 控制按钮显隐，后端再做一次校验兜底。
- **主题同步**：admin 侧提供与博客前台一致的 11 套主题切换（复用 `css/tokens.css` 中的 design tokens）。
- **KeepAlive**：列表页表单状态通过 KeepAlive 缓存，提升操作流畅度。

---

## 4. 后端架构：Express 模块化重构

### 4.1 技术栈补充

| 新增依赖 | 用途 |
|----------|------|
| `jsonwebtoken` | JWT 签发与校验 |
| `joi` 或 `zod` | 请求参数校验（可选，Node.js 端用 zod 需额外配置，建议 `joi`） |
| `winston` | 结构化日志 |
| `node-cron` | 定时任务（备份、统计聚合） |

> 注：继续使用 CommonJS（`require`/`module.exports`），与现有代码保持一致。

### 4.2 后端目录结构

```
server/
├── src/
│   ├── index.js                    # 入口：创建两个 Express 实例并启动
│   ├── env.js                      # 环境变量加载 (现有)
│   ├── utils.js                    # 通用工具 (现有)
│   ├── markdown.js                 # Markdown 渲染 (现有)
│   ├── db.js                       # SQLite 连接 + 迁移 + 数据访问辅助 (扩展)
│   ├── auth.js                     # 认证逻辑：bcrypt + JWT + Session 兼容 (扩展)
│   ├── middleware/
│   │   ├── errorHandler.js         # 统一错误处理
│   │   ├── requestValidator.js     # 请求参数校验中间件
│   │   ├── requestLogger.js        # 请求日志
│   │   ├── jwtAuth.js              # JWT 校验中间件 (后台 + 前台预留)
│   │   ├── sessionAuth.js          # Session 校验中间件 (兼容旧后台)
│   │   ├── rbac.js                 # 权限校验中间件
│   │   └── cors.js                 # 跨域配置 (仅开发环境生效)
│   ├── apps/                       # ===== 双端口子应用 =====
│   │   ├── frontApp.js             # 前台 Express 实例：静态文件 + 前台 API + 旧 Admin
│   │   └── adminApp.js             # 后台 Express 实例：Vue SPA + v2 API
│   ├── modules/
│   │   ├── core/
│   │   │   ├── core.routes.js      # 健康检查、文件上传、系统信息
│   │   │   └── core.controller.js
│   │   ├── blog/
│   │   │   ├── blog.routes.js      # 文章/标签/分类/友链/导入导出
│   │   │   ├── blog.controller.js
│   │   │   └── blog.service.js     # 业务逻辑层
│   │   ├── rbac/
│   │   │   ├── rbac.routes.js      # 用户/角色/权限/菜单
│   │   │   ├── rbac.controller.js
│   │   │   └── rbac.service.js
│   │   ├── analytics/
│   │   │   ├── analytics.routes.js # PV/UV、内容统计、趋势图表
│   │   │   ├── analytics.controller.js
│   │   │   └── analytics.service.js
│   │   ├── ops/
│   │   │   ├── ops.routes.js       # 日志查询、备份、监控指标
│   │   │   ├── ops.controller.js
│   │   │   └── ops.service.js
│   │   └── front/                  # 前台预留模块（读者账号体系）
│   │       ├── front.routes.js
│   │       ├── front.controller.js
│   │       └── front.service.js
│   └── jobs/                       # 定时任务
│       └── aggregateStats.js       # 每小时聚合访问统计
├── views/                          # EJS 模板 (保留旧后台兼容，仅前台服务使用)
├── public/                         # 静态资源与上传目录
├── admin-dist/                     # Vue 3 SPA 构建产物 (build 输出)
├── db/
│   └── blog.sqlite
└── package.json
```

### 4.3 模块内部约定

每个模块遵循 `routes → controller → service` 三层结构：
- **routes**：只负责路由定义与中间件挂载，不写业务逻辑。
- **controller**：处理 req/res，解析参数，调用 service，返回统一格式的 JSON。
- **service**：处理业务逻辑与数据库操作，不感知 HTTP。

示例：
```js
// modules/blog/blog.routes.js
const router = require("express").Router();
const ctrl = require("./blog.controller");
const { jwtAuth } = require("../../middleware/jwtAuth");
const { requirePermission } = require("../../middleware/rbac");

router.get("/api/v2/admin/posts", jwtAuth, requirePermission("post:list"), ctrl.listPosts);
router.post("/api/v2/admin/posts", jwtAuth, requirePermission("post:create"), ctrl.createPost);

module.exports = router;
```

---

## 5. 数据库扩展设计

在现有表基础上，新增以下核心表：

### 5.1 用户与认证 (`users`)
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,         -- 登录账号
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- bcrypt
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_super_admin INTEGER NOT NULL DEFAULT 0, -- 超级管理员，跳过 RBAC
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.2 角色 (`roles`)
```sql
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,             -- 如：内容编辑、运维
  code TEXT NOT NULL UNIQUE,             -- 如：content_editor
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.3 用户-角色关联 (`user_roles`)
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

### 5.4 权限 (`permissions`)
```sql
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- 如：文章列表
  code TEXT NOT NULL UNIQUE,             -- 如：post:list
  resource TEXT NOT NULL,                -- 如：post
  action TEXT NOT NULL,                  -- 如：list
  description TEXT,
  created_at TEXT NOT NULL
);
```

### 5.5 角色-权限关联 (`role_permissions`)
```sql
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```

### 5.6 菜单 (`menus`)
```sql
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER DEFAULT NULL REFERENCES menus(id),
  name TEXT NOT NULL,                    -- 显示名称
  path TEXT,                             -- 路由路径，如 /cms/posts
  icon TEXT,                             -- 图标名称
  permission_code TEXT,                  -- 关联权限，为空则所有人可见
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
```

### 5.7 审计日志 (`audit_logs`)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,                  -- 如：CREATE_POST
  resource_type TEXT NOT NULL,           -- 如：post
  resource_id TEXT,                      -- 被操作对象 ID
  detail TEXT,                           -- JSON 详情
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
```

### 5.8 多站点预留 (`sites`)
```sql
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- 站点名称
  slug TEXT NOT NULL UNIQUE,             -- 标识
  domain TEXT,                           -- 绑定域名
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

> 预留字段：未来 `posts`、`external_links` 等表可添加 `site_id` 字段，实现多站点内容隔离。

### 5.9 前台用户预留 (`front_users`)

架构预留，用于未来读者注册、评论、收藏等功能。与后台 `users` 表分离，避免权限混淆。

```sql
CREATE TABLE IF NOT EXISTS front_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.10 访问统计预留 (`page_views`)
```sql
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  referrer TEXT,
  ip TEXT,
  user_agent TEXT,
  session_id TEXT,
  front_user_id INTEGER REFERENCES front_users(id),  -- 预留：登录读者
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
```

---

## 6. API 规划

### 6.1 路由版本策略

| 前缀 | 用途 | 认证方式 | 说明 |
|------|------|----------|------|
| `/api/*` | 公共博客接口 | 无 | 现有接口，完全保留 |
| `/api/admin/*` | 旧管理接口 | Session | 现有接口，完全保留 |
| `/api/v2/auth/*` | 新认证接口 | 无 | 登录/刷新/登出 |
| `/api/v2/admin/*` | 新超级后台接口 | JWT + RBAC | 所有新模块走这里 |

### 6.2 认证接口 (`/api/v2/auth`)

```
POST /api/v2/auth/login          # 登录 -> 返回 { accessToken, refreshToken, user }
POST /api/v2/auth/refresh        # 刷新 accessToken
POST /api/v2/auth/logout         # 登出 (加入黑名单或清除 refreshToken)
GET  /api/v2/auth/me             # 获取当前登录用户信息
GET  /api/v2/auth/menus          # 获取当前用户菜单树
```

### 6.3 博客 CMS 接口 (`/api/v2/admin/cms`)

复用现有业务逻辑，统一迁移到 v2：

```
GET    /api/v2/admin/cms/posts           # 文章列表 (分页/搜索/筛选)
GET    /api/v2/admin/cms/posts/:id       # 文章详情
POST   /api/v2/admin/cms/posts           # 创建文章
PUT    /api/v2/admin/cms/posts/:id       # 更新文章
DELETE /api/v2/admin/cms/posts/:id       # 删除文章
POST   /api/v2/admin/cms/posts/:id/publish
POST   /api/v2/admin/cms/posts/:id/unpublish

GET    /api/v2/admin/cms/tags
POST   /api/v2/admin/cms/tags
PUT    /api/v2/admin/cms/tags/:id
DELETE /api/v2/admin/cms/tags/:id

GET    /api/v2/admin/cms/categories
POST   /api/v2/admin/cms/categories
PUT    /api/v2/admin/cms/categories/:id
DELETE /api/v2/admin/cms/categories/:id

GET    /api/v2/admin/cms/links
POST   /api/v2/admin/cms/links
PUT    /api/v2/admin/cms/links/:id
DELETE /api/v2/admin/cms/links/:id

POST   /api/v2/admin/cms/upload         # 文件上传
GET    /api/v2/admin/cms/export         # 数据导出
POST   /api/v2/admin/cms/import         # 数据导入
```

### 6.4 RBAC 接口 (`/api/v2/admin/rbac`)

```
# 用户管理
GET    /api/v2/admin/rbac/users
GET    /api/v2/admin/rbac/users/:id
POST   /api/v2/admin/rbac/users
PUT    /api/v2/admin/rbac/users/:id
DELETE /api/v2/admin/rbac/users/:id
PUT    /api/v2/admin/rbac/users/:id/roles   # 分配角色

# 角色管理
GET    /api/v2/admin/rbac/roles
POST   /api/v2/admin/rbac/roles
PUT    /api/v2/admin/rbac/roles/:id
DELETE /api/v2/admin/rbac/roles/:id
PUT    /api/v2/admin/rbac/roles/:id/permissions

# 权限管理
GET    /api/v2/admin/rbac/permissions
POST   /api/v2/admin/rbac/permissions      # 通常由系统初始化
PUT    /api/v2/admin/rbac/permissions/:id

# 菜单管理
GET    /api/v2/admin/rbac/menus
POST   /api/v2/admin/rbac/menus
PUT    /api/v2/admin/rbac/menus/:id
DELETE /api/v2/admin/rbac/menus/:id
```

### 6.5 数据分析接口 (`/api/v2/admin/analytics`)

```
GET /api/v2/admin/analytics/dashboard      # 仪表盘核心指标
GET /api/v2/admin/analytics/traffic        # 流量趋势 (PV/UV/独立访客)
GET /api/v2/admin/analytics/content        # 内容数据 (热门文章、分类分布)
GET /api/v2/admin/analytics/realtime       # 实时在线 (预留)
```

### 6.6 运维监控接口 (`/api/v2/admin/ops`)

```
GET /api/v2/admin/ops/logs                 # 审计日志查询 (分页/筛选)
GET /api/v2/admin/ops/logs/:id             # 单条日志详情
GET /api/v2/admin/ops/backups              # 备份列表
POST /api/v2/admin/ops/backups             # 触发手动备份
GET /api/v2/admin/ops/monitor              # 系统状态 (CPU/内存/磁盘/DB大小)
GET /api/v2/admin/ops/server-logs          # 读取服务端日志文件 (预留)
```

### 6.7 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

---

## 7. 认证与权限体系

### 7.1 三轨认证策略（按端口隔离）

| 轨道 | 端口 | 方式 | 用途 | 说明 |
|------|------|------|------|------|
| **旧轨道** | `8787` | `express-session` + Cookie | 现有 EJS 管理后台 | 保留兼容，不改动 |
| **后台轨道** | `3000` | JWT (access + refresh) | Vue 3 超级后台 | 新系统主力认证方式 |
| **前台轨道** | `8787` | JWT (预留) | 读者登录/评论/收藏 | 架构预留，暂不实现 |

#### 后台 JWT 设计（端口 3000）

- **accessToken**：有效期 2 小时，存储在内存（Pinia state），通过 Axios 拦截器自动注入 `Authorization: Bearer <token>`。
- **refreshToken**：有效期 7 天，存储在 `localStorage`（后台为内部工具，XSS 风险可控；若安全要求更高可改为 `httpOnly Cookie`，但需处理跨域）。
- **Token 内容**：`{ userId, username, roles: [...], type: "admin", iat, exp }`

#### 为什么不同端口更适合 JWT？

由于前台（8787）与后台（3000）运行在不同端口，浏览器的 **SameSite Cookie 策略** 会导致 Session Cookie 在跨端口时出现兼容问题。JWT 通过 `Authorization` 请求头传递，天然不受端口限制，是双端口架构下的最佳选择。

### 7.2 跨域（CORS）处理

开发环境下，前台 `localhost:8787`、Vue dev server `localhost:5173` 都需要访问后台 `localhost:3000`：

```js
// middleware/cors.js — 仅开发环境生效
const cors = require("cors");

function devCors() {
  if (process.env.NODE_ENV === "production") return (req, res, next) => next();
  return cors({
    origin: ["http://localhost:8787", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}
```

生产环境下 Nginx 统一代理到同一域名，浏览器不感知端口差异，无需 CORS。

### 7.3 RBAC 权限模型

采用 **资源:操作** 格式的细粒度权限：

| 权限码 | 说明 |
|--------|------|
| `post:list` | 查看文章列表 |
| `post:create` | 创建文章 |
| `post:update` | 编辑文章 |
| `post:delete` | 删除文章 |
| `post:publish` | 发布/下架文章 |
| `user:list` | 查看用户 |
| `user:create` | 创建用户 |
| `role:assign` | 分配角色 |
| `analytics:view` | 查看数据统计 |
| `ops:backup` | 执行备份 |
| `ops:logs` | 查看审计日志 |
| `menu:manage` | 管理后台菜单 |

### 7.4 权限校验流程

```
请求 -> 后台服务 (端口 3000) /api/v2/admin/*
    │
    ▼
jwtAuth 中间件
  - 验证 Token 有效性（签名、过期、type === "admin"）
  - 解码 userId，查询用户信息
  - 查询用户角色 -> 角色权限列表
  - 挂载 req.user = { userId, username, roles, permissions }
    │
    ▼
rbac 中间件 (requirePermission('post:delete'))
  - 检查 req.user.permissions 是否包含所需权限
  - 或者 req.user.is_super_admin === 1 直接放行
    │
    ▼
Controller / Service
```

### 7.5 数据初始化

系统首次启动时，自动创建：
1. **超级管理员账号**：从现有 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 迁移，写入 `users` 表，标记 `is_super_admin = 1`。
2. **基础角色**：`超级管理员`、`内容管理员`、`访客/只读`。
3. **基础权限**：所有 CMS 模块的 CRUD 权限。
4. **默认菜单**：后台侧边栏菜单数据写入 `menus` 表。
5. **绑定关系**：超级管理员关联所有角色与权限。

---

## 8. 功能模块划分

### 8.1 核心模块 (Core)
- 健康检查 `/health`
- 文件上传 `/api/v2/admin/cms/upload`
- 系统信息 `/api/v2/admin/ops/monitor`

### 8.2 博客 CMS 模块 (Blog)
- 文章 CRUD、发布/下架
- 标签管理
- 分类管理
- 友情链接
- 导入导出 (兼容现有格式)
- 媒体库 (上传图片管理)

### 8.3 权限模块 (RBAC)
- 用户管理（增删改查、重置密码、分配角色）
- 角色管理（增删改查、分配权限）
- 权限管理（初始化后通常只读，高级场景可动态添加）
- 菜单管理（动态配置后台菜单，支持拖拽排序）

### 8.4 数据分析模块 (Analytics) — 预留框架
- **PV/UV 采集**：在现有 `js/blog.js` 中增加轻量上报（`POST /api/v2/analytics/track`），或解析 Nginx 日志。
- **仪表盘**：总文章数、总访问量、今日访问、最近 7 天趋势。
- **内容分析**：热门文章 Top 10、分类/标签分布饼图。
- **流量分析**：访问来源、设备类型、页面路径统计。

### 8.5 运维监控模块 (Ops) — 预留框架
- **审计日志**：记录所有 `v2` 管理接口的操作人、操作类型、对象、IP、UA。
- **备份管理**：SQLite 数据库定时备份到 `server/backups/`，支持手动触发与下载。
- **系统监控**：读取服务器 CPU、内存、磁盘、SQLite 文件大小（Linux 下通过 `fs` + `child_process`）。

---

## 9. 部署与迁移策略

### 9.1 分阶段实施路线图

```
Phase 1: 基础脚手架 (1-2 周)
├── 后端：目录结构调整，新增 modules/、middleware/
├── 后端：引入 JWT，新增 users 表，双轨认证运行
├── 后端：RBAC 表结构 + 种子数据初始化
├── 前端：Vue 3 + Vite + Naive UI 项目初始化
├── 前端：登录页、路由守卫、Axios 拦截器、Pinia 状态
└── 集成：登录后进入空白 Dashboard，旧后台完全可用

Phase 2: RBAC 模块 + 旧功能迁移 (2-3 周)
├── 后端：完成 /api/v2/admin/rbac/* 全部接口
├── 后端：完成 /api/v2/admin/cms/* 全部接口
├── 前端：用户管理、角色管理、权限管理、菜单管理
├── 前端：文章管理、标签/分类管理、友链管理
└── 里程碑：新后台可完全替代旧 EJS 后台进行博客管理

Phase 3: 数据分析框架 (1-2 周)
├── 后端：page_views 表 + 采集接口
├── 后端：统计聚合任务 (定时任务)
├── 后端：Analytics API 实现
├── 前端：Dashboard 概览、ECharts 图表页
└── 里程碑：具备基础数据可视化能力

Phase 4: 运维监控框架 (1 周)
├── 后端：audit_logs 自动记录中间件
├── 后端：SQLite 备份脚本 + API
├── 后端：系统状态读取 API
├── 前端：审计日志查询页、备份管理页、监控看板
└── 里程碑：具备操作追溯与基础运维能力

Phase 5: 多站点 CMS 扩展 (预留，按需启动)
├── 后端：sites 表，posts/links 增加 site_id
├── 后端：API 增加站点隔离过滤
├── 前端：站点切换器、多站点内容管理
└── 里程碑：支持多个独立博客/站点的统一管理
```

### 9.2 环境变量变更

新增 `server/.env` 配置项：

```env
# 服务端口
FRONT_PORT=8787
ADMIN_PORT=3000

# JWT 配置
JWT_SECRET=<随机生成的 64 位字符串>
ADMIN_JWT_ACCESS_EXPIRES=2h
ADMIN_JWT_REFRESH_EXPIRES=7d
FRONT_JWT_SECRET=<另一组密钥，前台预留>      # 前台读者认证预留

# 系统配置
ENABLE_V2_ADMIN=true          # 是否启用新后台服务（端口 3000）
AUDIT_LOG_ENABLED=true        # 是否记录审计日志
AUTO_BACKUP_ENABLED=true      # 是否启用自动备份
AUTO_BACKUP_CRON=0 3 * * *    # 每天凌晨 3 点备份
```

### 9.3 旧数据迁移

- **用户迁移**：第一次启动新系统时，检测 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`，自动创建为第一个 `users` 记录并标记 `is_super_admin = 1`。
- **现有数据**：`posts`、`tags`、`categories`、`external_links` 完全保留，无需迁移。
- **回滚策略**：若新系统出现问题，关闭 `ENABLE_V2_ADMIN`（端口 3000 不再启动），前台 8787 端口的旧 EJS 管理后台继续可用。

### 9.4 双端口服务启动

后端入口 `server/src/index.js` 创建两个 Express 实例，分别监听不同端口：

```js
const express = require("express");
const path = require("node:path");

const sharedDb = require("./db");          // 共享数据库连接
const frontApp = require("./apps/frontApp"); // 前台应用（端口 8787）
const adminApp = require("./apps/adminApp"); // 后台应用（端口 3000）

const FRONT_PORT = 8787;
const ADMIN_PORT = 3000;

frontApp.listen(FRONT_PORT, () => {
  console.log(`前台服务: http://localhost:${FRONT_PORT}`);
});

adminApp.listen(ADMIN_PORT, () => {
  console.log(`后台服务: http://localhost:${ADMIN_PORT}`);
});
```

- 两个应用共享同一个 `db.js` 导出的数据库连接（SQLite WAL 模式支持并发）。
- `frontApp.js` 只挂载前台路由（静态文件 + 公共 API + 旧 Session Admin）。
- `adminApp.js` 只挂载后台路由（Vue SPA + v2 API）。

### 9.5 构建与部署

**开发模式**：
```bash
# 后端（单命令启动两个端口）
cd server && npm install && npm run dev

# 前端（Vue dev server 代理到后台 3000 端口）
cd admin && npm install && npm run dev
```

**生产构建**：
```bash
# 1. 构建 Vue 3 SPA -> 输出到 server/admin-dist/
cd admin && npm run build

# 2. 启动服务（前台 8787 + 后台 3000）
cd server && npm start
```

**Docker 调整**：
Dockerfile 需要暴露两个端口（`8787` 和 `3000`），构建时先编译 Vue SPA 再复制到 `server/admin-dist/`。

### 9.6 Nginx 生产配置示例

```nginx
server {
    listen 80;
    server_name ifoxchen.com;

    # 前台博客（端口 8787）
    location / {
        proxy_pass http://localhost:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 后台管理（端口 3000）
    # 所有 /admin/* 和 /api/v2/* 走后台服务
    location /admin/ {
        proxy_pass http://localhost:3000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/v2/ {
        proxy_pass http://localhost:3000/api/v2/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

生产环境通过 Nginx 将前后台合并到同一域名，浏览器无需处理跨域：
- `https://ifoxchen.com` → 前台博客
- `https://ifoxchen.com/admin` → Vue 3 超级后台
- `https://ifoxchen.com/api/v2/*` → 后台 API

---

## 10. 安全设计

- **密码安全**：继续沿用 `bcryptjs`，密码哈希存储，禁止明文。
- **JWT 安全**：`JWT_SECRET` 强度要求 ≥ 64 位随机字符串；accessToken 短时效。
- **接口安全**：
  - 继续保留 `helmet` 安全头。
  - 新 API 同样启用 `express-rate-limit`（登录、上传等敏感接口）。
  - 所有管理接口必须认证 + 授权。
- **审计追溯**：关键操作（增删改）写入 `audit_logs`，支持事后追溯。
- **SQL 注入**：继续使用 `better-sqlite3` 的命名参数，禁止字符串拼接 SQL。
- **XSS**：继续使用 `sanitize-html` 处理用户输入的富文本。

---

## 11. 总结

本架构设计遵循 **渐进式演进 + 端口隔离** 原则：

1. **双端口物理隔离**：前台博客（8787）与后台管理（3000）运行在不同端口，逻辑上视为两个独立应用。开发环境直接访问不同端口，生产环境通过 Nginx 合并到同一域名，兼顾开发清晰度与生产简洁性。
2. **不推倒重来**：现有 Express 服务端、SQLite 数据库、静态前端均保留在 8787 端口，通过新增 3000 端口和 `admin/` 目录扩展能力。
3. **模块化生长**：每个子系统（CMS、RBAC、Analytics、Ops）都有清晰的目录边界，可独立开发、独立上线。
4. **认证按端口适配**：旧 Session 留在 8787，新 JWT 用于 3000，天然避免跨端口 Cookie 问题；前台读者 JWT 已预留扩展点。
5. **预留多站点**：数据库层面提前设计 `sites` 表与 `site_id` 隔离字段，为未来的统一多站管理平台埋下扩展点。

建议从 **Phase 1** 开始，先搭建双端口服务框架（`frontApp.js` + `adminApp.js`）、Vue 3 管理后台的基础脚手架与 JWT 认证体系，再逐步将现有博客管理功能迁移到新界面，最终形成一套功能完备、权限精细、可横向扩展的超级后台系统。
