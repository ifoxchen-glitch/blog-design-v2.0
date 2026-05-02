# GitHub Issues 批量模板

> 版本：v1.0 | 日期：2026/05/02
> 关联文档：[`05-implementation-plan.md`](./05-implementation-plan.md) — 实施计划
> 用途：将 94 个任务一次性导入 GitHub Issues，配合 Project Board 跟踪进度

---

## 1. 使用说明

本文档提供两种导入方式：

1. **手工复制**：将每个任务的 Issue 模板手动粘贴到 GitHub Web UI（适合零散创建）
2. **GitHub CLI 批量**：使用 `gh issue create` 命令脚本一次性创建所有 Issue（推荐）

**前置准备**：

```bash
# 1. 安装 GitHub CLI（已安装可跳过）
# Windows: winget install GitHub.cli
# macOS:   brew install gh
# Linux:   见 https://cli.github.com/

# 2. 登录到当前仓库
gh auth login

# 3. 切换到仓库目录
cd /path/to/blog-design-v2.0
```

---

## 2. 标签体系（先建标签）

执行一次以下脚本，创建项目所需的全部标签：

```bash
# Phase 标签
gh label create "phase-1" --color "1d76db" --description "Phase 1: 基础脚手架"
gh label create "phase-2" --color "0e8a16" --description "Phase 2: RBAC + CMS 迁移"
gh label create "phase-3" --color "fbca04" --description "Phase 3: 数据分析"
gh label create "phase-4" --color "d93f0b" --description "Phase 4: 运维监控"
gh label create "phase-5" --color "5319e7" --description "Phase 5: 上线"

# 类型标签
gh label create "backend"  --color "1d76db" --description "后端开发"
gh label create "frontend" --color "bfd4f2" --description "前端开发"
gh label create "devops"   --color "0e8a16" --description "部署运维"
gh label create "docs"     --color "c5def5" --description "文档"
gh label create "verify"   --color "fef2c0" --description "集成验收"

# 优先级标签
gh label create "priority-high"   --color "b60205" --description "高优先级"
gh label create "priority-normal" --color "fbca04" --description "普通优先级"
gh label create "priority-low"    --color "c2e0c6" --description "低优先级"

# 状态标签
gh label create "blocked"     --color "d93f0b" --description "被阻塞"
gh label create "in-progress" --color "fbca04" --description "进行中"
gh label create "done"        --color "0e8a16" --description "已完成"
```

---

## 3. 里程碑（先建里程碑）

```bash
# 创建 5 个里程碑（M1-M5）
gh api repos/:owner/:repo/milestones \
  -f title="M1: 双端口可用 + 后台登录" \
  -f description="Phase 1 完成，登录闭环跑通" \
  -f due_on="2026-05-17T23:59:59Z"

gh api repos/:owner/:repo/milestones \
  -f title="M2: 新后台可下线 EJS" \
  -f description="Phase 2 完成，所有博客管理功能在新后台可用" \
  -f due_on="2026-06-14T23:59:59Z"

gh api repos/:owner/:repo/milestones \
  -f title="M3: 数据分析模块上线" \
  -f description="Phase 3 完成，PV/UV 统计与图表" \
  -f due_on="2026-06-28T23:59:59Z"

gh api repos/:owner/:repo/milestones \
  -f title="M4: 运维监控模块上线" \
  -f description="Phase 4 完成，审计日志、备份、监控可用" \
  -f due_on="2026-07-12T23:59:59Z"

gh api repos/:owner/:repo/milestones \
  -f title="M5: 项目正式上线" \
  -f description="Phase 5 完成，生产部署、Nginx 配置、旧 EJS 下线" \
  -f due_on="2026-07-26T23:59:59Z"
```

---

## 4. Issue 模板规范

每个任务对应一个 Issue，统一结构：

```
标题：[TX.Y] 任务简述
标签：phase-X、类型标签、优先级标签
里程碑：MX
正文：
  - 任务描述
  - 依赖任务（链接到其他 Issue）
  - 估时
  - 验收标准
  - 关联文档
```

---

## 5. Phase 1 Issues（T1.1 ～ T1.26）

### 标题：`[T1.1] 创建后端新目录结构`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
创建后端新目录：`middleware/`、`apps/`、`modules/`、`jobs/`，每个目录添加 README 占位说明用途。

## 依赖
无（项目起点）

## 估时
0.5 小时

## 验收标准
- [ ] `server/src/middleware/` 目录存在，含 README
- [ ] `server/src/apps/` 目录存在,含 README
- [ ] `server/src/modules/` 目录存在,含 README
- [ ] `server/src/jobs/` 目录存在,含 README

## 关联
- 文档：docs/04-admin-architecture.md 第 4 节
```

---

### 标题：`[T1.2] 安装新依赖（jsonwebtoken/cors/joi/winston/node-cron）`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
在 `server/` 目录安装新增依赖：
- `jsonwebtoken` —— JWT 签发与校验
- `cors` —— 仅开发环境跨域
- `joi` —— 请求参数校验（或 zod 二选一）
- `winston` —— 结构化日志
- `node-cron` —— 定时任务

## 依赖
- #T1.1

## 估时
0.5 小时

## 验收标准
- [ ] `server/package.json` 包含上述依赖
- [ ] `npm install` 通过
- [ ] `node -e "require('jsonwebtoken')"` 不报错

## 关联
- 文档：docs/04-admin-architecture.md 第 4.2 节
```

---

### 标题：`[T1.3] 数据库迁移：新增 RBAC 与扩展表`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
扩展 `server/src/db.js` 的 `migrate()`,新增以下表：
- `users` —— 多用户账号
- `roles` —— 角色
- `permissions` —— 权限
- `role_permissions` —— 角色-权限 M2M
- `user_roles` —— 用户-角色 M2M
- `menus` —— 菜单
- `audit_logs` —— 审计日志
- `front_users` —— 前台读者（预留）
- `page_views` —— PV 上报
- `sites` —— 多站点（预留）

字段定义见 04-admin-architecture.md 第 5 节。

## 依赖
- #T1.1

## 估时
2 小时

## 验收标准
- [ ] 启动 server 后所有新表自动创建
- [ ] `sqlite3 server/db/blog.sqlite ".schema"` 可看到全部新表
- [ ] 新表均使用 `CREATE TABLE IF NOT EXISTS`,不影响现有表

## 关联
- 文档：docs/04-admin-architecture.md 第 5 节
```

---

### 标题：`[T1.4] 数据库种子：超管账号 + 基础角色 + 权限 + 菜单`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
扩展 `ensureSeed()`,首次启动时插入：
- 超级管理员账号（从 `.env` `ADMIN_EMAIL/ADMIN_PASSWORD` 迁移,bcrypt 加密)
- 3 个基础角色：超级管理员、内容编辑、只读访客
- 12 个基础权限（post:*、tag:*、category:*、user:*、role:* 等)
- 默认菜单树（Dashboard、CMS、RBAC、Analytics、Ops)

## 依赖
- #T1.3

## 估时
1.5 小时

## 验收标准
- [ ] 启动后 `users` 表中存在超管账号
- [ ] 用 `ADMIN_EMAIL` + `ADMIN_PASSWORD` 调用 v2 登录 API 成功
- [ ] `roles`、`permissions`、`menus` 表均有种子数据

## 关联
- 文档：docs/04-admin-architecture.md 第 5、8 节
```

---

### 标题：`[T1.5] 拆分 frontApp.js,迁移现有所有路由`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
新建 `server/src/apps/frontApp.js`,迁移现有 `index.js` 中的：
- 公共 API：`/api/posts`、`/api/tags`、`/api/categories`、`/api/links`、`/rss.xml`
- 旧 admin 页面（EJS）：`/admin/login`、`/admin/posts/*`、`/admin/links`
- 旧 admin API：`/api/admin/*`

挂载在 8787 端口的 Express 实例上。

## 依赖
- #T1.1

## 估时
2 小时

## 验收标准
- [ ] 8787 端口启动后所有现有功能正常
- [ ] 现有自动化测试（如有)全部通过
- [ ] 前端 `index.html`、`post.html` 数据加载正常

## 关联
- 文档：docs/04-admin-architecture.md 第 4.1 节
```

---

### 标题：`[T1.6] 创建 adminApp.js,挂载 v2 路由前缀`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
新建 `server/src/apps/adminApp.js`,挂载 `/api/v2/*` 路由前缀：
- `/api/v2/auth/*`
- `/api/v2/admin/cms/*`
- `/api/v2/admin/rbac/*`
- `/api/v2/admin/analytics/*`
- `/api/v2/admin/ops/*`
- `/health` —— 健康检查

## 依赖
- #T1.1

## 估时
1 小时

## 验收标准
- [ ] 3000 端口启动
- [ ] `curl http://localhost:3000/health` 返回 `{ ok: true }`

## 关联
- 文档：docs/04-admin-architecture.md 第 4.1 节
```

---

### 标题：`[T1.7] 改造 index.js 实现双端口同进程启动`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
改造 `server/src/index.js`：
1. 同时引入 `frontApp` 与 `adminApp`
2. 共享同一 SQLite 数据库连接
3. 启动两个 HTTP 服务监听不同端口
4. 启动日志清晰打印两个端口

## 依赖
- #T1.5
- #T1.6

## 估时
1 小时

## 验收标准
- [ ] `npm run dev` 同时打印：`Front server: http://localhost:8787`、`Admin server: http://localhost:3000`
- [ ] 两个端口都能独立访问对应路由
- [ ] 数据库连接只创建一次

## 关联
- 文档：docs/04-admin-architecture.md 第 4 节
```

---

### 标题：`[T1.8] 实现 middleware/cors.js（仅开发环境)`
**Labels**: `phase-1`, `backend`, `priority-normal`
**Milestone**: M1

```markdown
## 任务描述
实现 `server/src/middleware/cors.js`：
- 检测 `NODE_ENV !== 'production'`
- 允许 `http://localhost:5173`（Vite dev）跨域访问
- 生产环境完全关闭 cors,通过 Nginx 同域处理

## 依赖
- #T1.6

## 估时
0.5 小时

## 验收标准
- [ ] 开发环境 5173 → 3000 请求成功
- [ ] 生产环境无 cors 头

## 关联
- 文档：docs/04-admin-architecture.md 第 7 节
```

---

### 标题：`[T1.9] 实现 middleware/jwtAuth.js`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
实现 JWT 校验中间件：
- 从 `Authorization: Bearer xxx` 提取 token
- 验证签名与过期时间
- 校验通过后将 user 信息挂到 `req.user`
- 失败返回 401（区分 missing / invalid / expired）

## 依赖
- #T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 单元测试：无 token 返回 401
- [ ] 单元测试：过期 token 返回 401
- [ ] 单元测试：有效 token 通过且 `req.user` 有值

## 关联
- 文档：docs/04-admin-architecture.md 第 6.2 节
```

---

### 标题：`[T1.10] 实现 middleware/rbac.js`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
实现 RBAC 中间件工厂 `requirePermission(code)`：
- 超级管理员（`is_super_admin = 1`)直接放行
- 普通用户检查 `req.user.permissions` 是否包含 code
- 未通过返回 403

## 依赖
- #T1.9

## 估时
1 小时

## 验收标准
- [ ] 超管访问任何路由都通过
- [ ] 无权限用户访问受保护路由返回 403
- [ ] 错误信息提示缺少哪个权限

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T1.11] 实现 /api/v2/auth/login`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
实现登录接口：
- 输入：`email/password`
- bcrypt 校验密码
- 签发 accessToken（2h 过期）+ refreshToken（7d 过期）
- 返回用户信息（不含密码哈希）

## 依赖
- #T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 正确密码返回 200 + token + user
- [ ] 错误密码返回 401
- [ ] 不存在账号返回 401（不区分,防止枚举)
- [ ] Postman 调用流程完整

## 关联
- 文档：docs/04-admin-architecture.md 第 6.2 节
```

---

### 标题：`[T1.12] 实现 /api/v2/auth/refresh`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
实现 token 续期接口：
- 输入：refreshToken
- 验证签名与过期
- 返回新的 accessToken（refreshToken 不变）

## 依赖
- #T1.11

## 估时
1 小时

## 验收标准
- [ ] 有效 refreshToken 返回新 accessToken
- [ ] 过期 refreshToken 返回 401
- [ ] 同一 refreshToken 可多次使用直到过期

## 关联
- 文档：docs/04-admin-architecture.md 第 6.2 节
```

---

### 标题：`[T1.13] 实现 /api/v2/auth/logout、/me、/menus`
**Labels**: `phase-1`, `backend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
- `/auth/logout` —— 客户端清 token即可,后端可选黑名单(本期不做)
- `/auth/me` —— 返回当前用户详情 + 角色 + 权限
- `/auth/menus` —— 根据用户角色返回菜单树

## 依赖
- #T1.11

## 估时
1 小时

## 验收标准
- [ ] `/me` 返回完整用户信息
- [ ] `/menus` 返回符合角色的菜单树（超管返回全部)
- [ ] 未登录访问 `/me`、`/menus` 返回 401

## 关联
- 文档：docs/04-admin-architecture.md 第 6.2 节
```

---

### 标题：`[T1.14] 初始化 admin/ 目录（Vue 3 + Vite + TS)`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
在项目根创建 `admin/` 目录,使用 `npm create vite@latest` 初始化：
- 模板：vue-ts
- 安装基础依赖：vue@3、vue-router@4、pinia
- `.gitignore` 排除 node_modules

## 依赖
无

## 估时
1 小时

## 验收标准
- [ ] `cd admin && npm run dev` 启动 5173 端口
- [ ] 浏览器看到 Vite 默认欢迎页
- [ ] 仓库不提交 node_modules

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.15] 配置 Naive UI、Tailwind、Pinia、Vue Router`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
- 安装 `naive-ui`、`@vicons/ionicons5`
- 安装 Tailwind CSS 并配置 `tailwind.config.js`
- 配置 Pinia store 入口
- 配置 Vue Router 4 + 路由懒加载

## 依赖
- #T1.14

## 估时
1.5 小时

## 验收标准
- [ ] App.vue 中可使用 `<n-button>` 组件
- [ ] Tailwind class（如 `flex`、`mt-4`)生效
- [ ] Pinia 测试 store 可读写
- [ ] 路由可导航

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.16] 配置 vite.config.ts 代理 /api 到 3000`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
在 `admin/vite.config.ts` 配置 dev 代理：
```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

## 依赖
- #T1.14

## 估时
0.5 小时

## 验收标准
- [ ] 前端 fetch('/api/v2/auth/login') 被代理到 3000
- [ ] 浏览器 DevTools Network 看到正确目标

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.17] 实现 api/request.ts(Axios 拦截器)`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
封装 Axios 实例：
- 请求拦截：自动加 `Authorization: Bearer xxx`
- 响应拦截：401 时自动调 `/auth/refresh`,成功后重试一次原请求,失败则跳登录
- 全局错误提示（Naive UI message）

## 依赖
- #T1.16

## 估时
1.5 小时

## 验收标准
- [ ] 401 自动续期重试
- [ ] 续期失败跳转 `/login`
- [ ] 业务错误（4xx 5xx）显示提示

## 关联
- 文档：docs/04-admin-architecture.md 第 6.2 节
```

---

### 标题：`[T1.18] 实现 stores/auth.ts`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
Pinia auth store：
- state：accessToken、refreshToken、user
- actions：login、logout、loadUser
- 持久化到 localStorage

## 依赖
- #T1.17

## 估时
1 小时

## 验收标准
- [ ] login 成功后 token 存入 localStorage
- [ ] 刷新页面 token 仍在
- [ ] logout 清除所有状态

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.19] 实现 stores/permission.ts`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
Pinia permission store：
- state：menus（树形）、permissionCodes（Set）
- actions：loadMenus(从 `/auth/menus`)
- getter：`hasPermission(code)`

## 依赖
- #T1.18

## 估时
1 小时

## 验收标准
- [ ] 登录后调用 `loadMenus` 获取菜单
- [ ] `hasPermission('post:create')` 返回正确布尔值

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T1.20] 实现 views/login/index.vue`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
登录页：
- 邮箱 + 密码两个输入框
- 提交按钮 + loading
- 错误提示（账号/密码错误）

## 依赖
- #T1.18

## 估时
1.5 小时

## 验收标准
- [ ] 输入正确账号跳转到 dashboard
- [ ] 错误账号清晰提示
- [ ] 表单校验（空值、邮箱格式)

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.21] 实现路由守卫`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
- 未登录访问受保护路由跳转 `/login?redirect=xxx`
- 已登录访问 `/login` 跳转 `/dashboard`
- 访问无权限路由跳 403 页面

## 依赖
- #T1.18
- #T1.19

## 估时
1.5 小时

## 验收标准
- [ ] URL 直接访问 `/cms/posts` 未登录跳登录
- [ ] 登录后回跳到原目标
- [ ] 无权限菜单不显示对应入口

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T1.22] 实现 components/layout/AdminLayout.vue`
**Labels**: `phase-1`, `frontend`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
后台主布局：
- 顶栏：logo、面包屑、用户菜单(头像、退出)
- 侧边栏：根据菜单 store 渲染、可折叠、当前选中高亮
- 主区域：`<router-view>`

## 依赖
- #T1.19

## 估时
2 小时

## 验收标准
- [ ] 侧边栏按用户权限渲染菜单
- [ ] 折叠/展开切换流畅
- [ ] 顶栏退出按钮调用 logout

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.23] 实现 views/dashboard/index.vue 占位页`
**Labels**: `phase-1`, `frontend`, `priority-normal`
**Milestone**: M1

```markdown
## 任务描述
最小可运行的 Dashboard 页面：
- 显示"欢迎回来,XXX"
- Phase 3 会替换为完整数据看板

## 依赖
- #T1.22

## 估时
0.5 小时

## 验收标准
- [ ] 登录后看到欢迎语
- [ ] 用户名正确显示

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T1.24] 实现 directives/permission.ts`
**Labels**: `phase-1`, `frontend`, `priority-normal`
**Milestone**: M1

```markdown
## 任务描述
自定义指令 `v-permission`：
- `<n-button v-permission="'post:delete'">` 无权限时不渲染
- 支持数组：`v-permission="['post:create', 'post:edit']"`

## 依赖
- #T1.19

## 估时
1 小时

## 验收标准
- [ ] 无权限按钮 DOM 不生成
- [ ] 数组任一权限即显示

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T1.25] Phase 1 集成验收`
**Labels**: `phase-1`, `verify`, `priority-high`
**Milestone**: M1

```markdown
## 任务描述
端到端测试：
1. `npm run dev` 启动双端口
2. 浏览器登录新后台
3. 加载菜单
4. 看到 Dashboard
5. 录制 GIF 演示

## 依赖
- T1.1 ～ T1.24

## 估时
1 小时

## 验收标准
- [ ] Phase 1 Checklist 全部勾选
- [ ] GIF 演示文件入库

## 关联
- 文档：docs/05-implementation-plan.md 4.2 节
```

---

### 标题：`[T1.26] Phase 1 文档更新`
**Labels**: `phase-1`, `docs`, `priority-normal`
**Milestone**: M1

```markdown
## 任务描述
- 更新 `CLAUDE.md`：双端口启动方式、新目录结构
- 更新 `README.md`：开发指南、登录账号说明
- 提交 `CHANGELOG.md`：Phase 1 变更总结

## 依赖
- #T1.25

## 估时
1 小时

## 验收标准
- [ ] 新人按文档可在 5 分钟内启动开发环境

## 关联
- 文档：docs/05-implementation-plan.md 4.2 节
```

---

## 6. Phase 2 Issues（T2.1 ～ T2.35）

### 6.1 RBAC 后端

### 标题：`[T2.1] 用户管理 API`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
实现 `/api/v2/admin/rbac/users` CRUD：
- 列表（分页、搜索、状态筛选）
- 详情
- 创建（密码 bcrypt 加密)
- 更新（不含密码)
- 删除（软删除/硬删除选其一)
- 重置密码

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] Postman 全部调用通过
- [ ] 响应不含 password_hash
- [ ] 删除超管会被拒绝

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.2] 用户分配角色 API`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
`PUT /users/:id/roles` —— 全量替换用户角色,事务化操作。

## 依赖
- #T2.1

## 估时
1 小时

## 验收标准
- [ ] 一次提交可全量替换
- [ ] 删除最后一个超管会被拒绝

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.3] 角色管理 API（CRUD)`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
实现 `/api/v2/admin/rbac/roles` CRUD:
- code 唯一校验
- 删除前检查是否被用户引用

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 所有接口跑通
- [ ] 重复 code 报错
- [ ] 删除有用户的角色提示影响

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.4] 角色分配权限 API`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
`PUT /roles/:id/permissions` —— 全量替换角色权限。

## 依赖
- #T2.3

## 估时
1 小时

## 验收标准
- [ ] 提交后该角色用户的权限实时刷新
- [ ] 内置超管角色不可改

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.5] 权限管理 API`
**Labels**: `phase-2`, `backend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
- 列表（按 resource 分组)
- 编辑（仅 name/description,不改 code)

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 不允许直接增删 code
- [ ] 列表按 resource 分组

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.6] 菜单管理 API`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
- 树形列表
- CRUD
- 拖拽排序（POST /menus/reorder)

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 排序保存后 `/auth/menus` 顺序一致

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.7] 审计日志中间件`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
全局中间件：自动捕获所有 POST/PUT/DELETE 操作,异步写入 `audit_logs`。
字段：user_id、action、resource、resource_id、ip、user_agent、payload(裁剪)、created_at。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 每次写操作记录一条日志
- [ ] 日志写失败不阻塞业务

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 6.2 博客 CMS 后端（v2）

### 标题：`[T2.8] 文章 CRUD API（v2)`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
`/api/v2/admin/cms/posts` 全套 CRUD：
- 列表（分页、搜索、状态筛选、标签筛选、分类筛选)
- 详情
- 创建
- 更新（contentHtml 设为 NULL,下次读取再渲染)
- 删除

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 字段、错误码与旧 API 等价
- [ ] 列表性能满足 1000 篇文章 < 200ms

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.9] 文章发布/下架 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
- `POST /posts/:id/publish` —— 发布,自动设 publishedAt
- `POST /posts/:id/unpublish` —— 下架

## 依赖
- #T2.8

## 估时
1 小时

## 验收标准
- [ ] 状态切换、publishedAt 自动更新

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.10] 标签管理 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`/api/v2/admin/cms/tags` CRUD + 文章数统计。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 删除标签自动解除文章关联
- [ ] 列表返回 postCount

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.11] 分类管理 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`/api/v2/admin/cms/categories` CRUD + 文章数统计。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 同 T2.10

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.12] 友链管理 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`/api/v2/admin/cms/links` CRUD + 拖拽排序。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] sortOrder 持久化
- [ ] 拖拽接口幂等

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.13] 文件上传 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`/api/v2/admin/cms/upload` —— 复用现有 multer 配置,权限改 `media:upload`。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 单图上传成功
- [ ] 大文件上传被限制(配置可调)

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.14] 数据导出 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-low`
**Milestone**: M2

```markdown
## 任务描述
`GET /api/v2/admin/cms/export` —— 导出 JSON,兼容旧格式。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 导出文件可用 v2 导入还原
- [ ] 包含文章/标签/分类/友链全部数据

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.15] 数据导入 API（v2)`
**Labels**: `phase-2`, `backend`, `priority-low`
**Milestone**: M2

```markdown
## 任务描述
`POST /api/v2/admin/cms/import` —— 上传 JSON 文件,事务化导入。

## 依赖
- #T2.14

## 估时
1.5 小时

## 验收标准
- [ ] 支持旧版本备份文件
- [ ] 失败时事务回滚

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 6.3 通用前端组件

### 标题：`[T2.16] PageHeader 组件`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`components/common/PageHeader.vue`：标题、面包屑、操作按钮槽位。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 三个 props 槽都可独立配置

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T2.17] DataTable 组件`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
通用表格：搜索、分页、批量、排序、加载状态、空数据提示。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 接受 columns + 数据 API 函数
- [ ] 切换搜索/分页自动刷新

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T2.18] FormDrawer 组件`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
通用右侧抽屉表单,创建与编辑共用。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 可传入表单 schema 自动渲染

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T2.19] MarkdownEditor 组件`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
封装 Vditor 或 Bytemd（二选一)：
- 图片粘贴自动上传
- 预览模式
- 源码切换

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 复制图片粘贴自动上传到 `/api/v2/admin/cms/upload`
- [ ] 内容双向绑定

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T2.20] ImageUploader 组件`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
单图/多图上传,带拖拽、进度、删除。

## 依赖
- #T2.13

## 估时
1.5 小时

## 验收标准
- [ ] 拖拽上传成功
- [ ] 进度条实时

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T2.21] useTable composable`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
`composables/useTable.ts` —— 列表数据获取与分页通用 hook。

## 依赖
- #T2.17

## 估时
1.5 小时

## 验收标准
- [ ] 切换搜索条件自动刷新
- [ ] 翻页保留搜索

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 6.4 RBAC 前端

### 标题：`[T2.22] 用户管理页`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
列表 + 增删改 + 重置密码 + 分配角色。

## 依赖
- #T2.1
- #T2.2
- #T2.17

## 估时
4 小时

## 验收标准
- [ ] 全功能跑通
- [ ] 密码字段输入隐藏

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.23] 角色管理页`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
列表 + CRUD + 分配权限（树形勾选)。

## 依赖
- #T2.3
- #T2.4

## 估时
3 小时

## 验收标准
- [ ] 权限按 resource 分组展示
- [ ] 勾选父节点自动选中子节点

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.24] 权限管理页`
**Labels**: `phase-2`, `frontend`, `priority-low`
**Milestone**: M2

```markdown
## 任务描述
列表（按 resource 分组）+ 编辑（仅 name/description）。

## 依赖
- #T2.5

## 估时
1.5 小时

## 验收标准
- [ ] 列表 + 编辑 + 不可删除

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 标题：`[T2.25] 菜单管理页`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
树形列表 + 拖拽排序 + CRUD。

## 依赖
- #T2.6

## 估时
3 小时

## 验收标准
- [ ] 拖拽后保存接口调用成功
- [ ] 树形展开/折叠状态保持

## 关联
- 文档：docs/04-admin-architecture.md 第 8 节
```

---

### 6.5 博客 CMS 前端

### 标题：`[T2.26] 文章列表页`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
表格 + 状态筛选 + 搜索 + 分类筛选 + 批量操作。

## 依赖
- #T2.8
- #T2.17

## 估时
3 小时

## 验收标准
- [ ] 与旧 EJS 后台功能等价
- [ ] 批量删除支持

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.27] 文章新建/编辑页`
**Labels**: `phase-2`, `frontend`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
Markdown 编辑器 + 元信息表单 + 标签/分类选择 + 封面上传 + 草稿/发布。

## 依赖
- #T2.8
- #T2.19
- #T2.20

## 估时
5 小时

## 验收标准
- [ ] 草稿与发布两种状态切换
- [ ] 离开页面前提示未保存

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.28] 标签管理页`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
列表 + 增删改 + 文章数显示。

## 依赖
- #T2.10

## 估时
1.5 小时

## 验收标准
- [ ] 删除前提示影响范围

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.29] 分类管理页`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
列表 + 增删改 + 文章数显示。

## 依赖
- #T2.11

## 估时
1.5 小时

## 验收标准
- [ ] 同 T2.28

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.30] 友链管理页`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
列表 + 增删改 + 拖拽排序 + 图标预览。

## 依赖
- #T2.12

## 估时
2 小时

## 验收标准
- [ ] 图标可见、排序生效

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.31] 媒体库页`
**Labels**: `phase-2`, `frontend`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
已上传图片网格 + 复制链接 + 删除。

## 依赖
- #T2.13

## 估时
2 小时

## 验收标准
- [ ] 网格展示 + 搜索 + 操作

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 标题：`[T2.32] 数据导入导出页`
**Labels**: `phase-2`, `frontend`, `priority-low`
**Milestone**: M2

```markdown
## 任务描述
一键导出 + 文件上传导入。

## 依赖
- #T2.14
- #T2.15

## 估时
1.5 小时

## 验收标准
- [ ] 导入前预览数据条数

## 关联
- 文档：docs/04-admin-architecture.md 第 6.3 节
```

---

### 6.6 集成与验收

### 标题：`[T2.33] 端到端验收`
**Labels**: `phase-2`, `verify`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
登录 → 创建用户 → 分配角色 → 创建文章 → 发布 → 前台查看。

## 依赖
T2.1 ～ T2.32

## 估时
1.5 小时

## 验收标准
- [ ] 录屏 GIF
- [ ] Phase 2 Checklist 全部勾选

## 关联
- 文档：docs/05-implementation-plan.md 5.2 节
```

---

### 标题：`[T2.34] 旧后台对照测试`
**Labels**: `phase-2`, `verify`, `priority-high`
**Milestone**: M2

```markdown
## 任务描述
所有旧 EJS 功能在新后台均有对应实现的对照清单。

## 依赖
T2.1 ～ T2.32

## 估时
1.5 小时

## 验收标准
- [ ] 对照表入库 (`docs/migration-checklist.md`)

## 关联
- 文档：docs/05-implementation-plan.md 5.2 节
```

---

### 标题：`[T2.35] 用户使用手册`
**Labels**: `phase-2`, `docs`, `priority-normal`
**Milestone**: M2

```markdown
## 任务描述
撰写用户操作手册（用户/角色/文章操作）+ 截图。

## 依赖
- #T2.33

## 估时
2 小时

## 验收标准
- [ ] `docs/07-user-manual.md` 入库
- [ ] 配截图

## 关联
- 文档：docs/05-implementation-plan.md 14.2 节
```

---

## 7. Phase 3 Issues（T3.1 ～ T3.13）

### 标题：`[T3.1] PV/UV 上报 API`
**Labels**: `phase-3`, `backend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
`POST /api/track` —— 无需认证,带限流(60 次/分钟/IP）。

## 依赖
M2 完成

## 估时
1.5 小时

## 验收标准
- [ ] 频率限制生效
- [ ] 限流后返回 429

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.2] 上报字段写入 page_views`
**Labels**: `phase-3`, `backend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
字段：path、referrer、ip、user_agent、session_id、created_at。

## 依赖
- #T3.1

## 估时
1 小时

## 验收标准
- [ ] 每次访问写入一条
- [ ] IP 不显式存全(隐私脱敏选项)

## 关联
- 文档：docs/04-admin-architecture.md 第 5 节
```

---

### 标题：`[T3.3] Dashboard 概览 API`
**Labels**: `phase-3`, `backend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
返回 5-10 个核心指标：总文章数、总评论数(预留 0)、今日 PV/UV、最近 7 天趋势。

## 依赖
- #T3.2

## 估时
2 小时

## 验收标准
- [ ] 单次请求返回全部
- [ ] 响应 < 100ms

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.4] 流量趋势 API`
**Labels**: `phase-3`, `backend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
按天/小时聚合 PV/UV,支持时间范围。

## 依赖
- #T3.2

## 估时
2 小时

## 验收标准
- [ ] 7/30/90 天的时序数据
- [ ] 时区按服务器本地

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.5] 内容分析 API`
**Labels**: `phase-3`, `backend`, `priority-normal`
**Milestone**: M3

```markdown
## 任务描述
文章热度 Top 10、分类/标签分布。

## 依赖
- #T3.2

## 估时
2 小时

## 验收标准
- [ ] 各维度排行榜
- [ ] 默认按近 30 天

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.6] 实时统计 API`
**Labels**: `phase-3`, `backend`, `priority-low`
**Milestone**: M3

```markdown
## 任务描述
当前在线人数（最近 5 分钟独立 session_id 数）。

## 依赖
- #T3.2

## 估时
1 小时

## 验收标准
- [ ] 返回单一数字
- [ ] 缓存 30 秒

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.7] 定时聚合任务`
**Labels**: `phase-3`, `backend`, `priority-normal`
**Milestone**: M3

```markdown
## 任务描述
每天凌晨聚合昨日数据到 `daily_stats` 表（节省查询）。

## 依赖
- #T3.2

## 估时
2 小时

## 验收标准
- [ ] cron 任务正常运行
- [ ] Docker 容器中也生效

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T3.8] 前台埋点 track 函数`
**Labels**: `phase-3`, `frontend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
在 `js/blog.js` 中添加 `track()` 函数,页面加载时调用。

## 依赖
- #T3.1

## 估时
1 小时

## 验收标准
- [ ] 翻页/刷新都能触发
- [ ] 失败不阻塞页面

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.9] session_id / UV 持久化`
**Labels**: `phase-3`, `frontend`, `priority-normal`
**Milestone**: M3

```markdown
## 任务描述
session_id 用 sessionStorage,UV ID 用 localStorage。

## 依赖
- #T3.8

## 估时
0.5 小时

## 验收标准
- [ ] 同浏览器不重复算 UV
- [ ] 关闭浏览器再开 session_id 重置

## 关联
- 文档：docs/04-admin-architecture.md 第 6 节
```

---

### 标题：`[T3.10] Dashboard 升级（核心指标 + 趋势）`
**Labels**: `phase-3`, `frontend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
4-6 个核心指标卡片 + 最近 7 天趋势小图。

## 依赖
- #T3.3

## 估时
2 小时

## 验收标准
- [ ] 数据准确
- [ ] 卡片响应式布局

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T3.11] 流量分析页`
**Labels**: `phase-3`, `frontend`, `priority-high`
**Milestone**: M3

```markdown
## 任务描述
ECharts 折线图（PV/UV）+ 时间范围切换。

## 依赖
- #T3.4

## 估时
2.5 小时

## 验收标准
- [ ] 切换时间无明显卡顿
- [ ] 双 Y 轴

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T3.12] 内容分析页`
**Labels**: `phase-3`, `frontend`, `priority-normal`
**Milestone**: M3

```markdown
## 任务描述
热门文章柱状图 Top 10 + 分类/标签饼图。

## 依赖
- #T3.5

## 估时
2 小时

## 验收标准
- [ ] 点击柱子跳文章详情

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

### 标题：`[T3.13] 实时面板（Dashboard 卡片)`
**Labels**: `phase-3`, `frontend`, `priority-low`
**Milestone**: M3

```markdown
## 任务描述
Dashboard 显示当前在线,30 秒自动刷新。

## 依赖
- #T3.6

## 估时
0.5 小时

## 验收标准
- [ ] 刷新无闪烁

## 关联
- 文档：docs/04-admin-architecture.md 第 3 节
```

---

## 8. Phase 4 Issues（T4.1 ～ T4.11）

### 标题：`[T4.1] 审计日志查询 API`
**Labels**: `phase-4`, `backend`, `priority-high`
**Milestone**: M4

```markdown
## 任务描述
列表（多条件筛选）+ 详情。

## 依赖
M2 完成（含 T2.7)

## 估时
2.5 小时

## 验收标准
- [ ] 支持按用户/资源/时间范围筛选
- [ ] 翻页流畅

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.2] SQLite 备份脚本`
**Labels**: `phase-4`, `backend`, `priority-high`
**Milestone**: M4

```markdown
## 任务描述
调用 `VACUUM INTO`,输出 `server/backups/{timestamp}.sqlite`。

## 依赖
M2 完成

## 估时
1.5 小时

## 验收标准
- [ ] 不锁库
- [ ] 备份文件可恢复

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.3] 备份列表 API`
**Labels**: `phase-4`, `backend`, `priority-normal`
**Milestone**: M4

```markdown
## 任务描述
列出 backups/ 中的文件 + 大小 + 时间。

## 依赖
- #T4.2

## 估时
1 小时

## 验收标准
- [ ] 按时间倒序

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.4] 手动备份 + 下载 API`
**Labels**: `phase-4`, `backend`, `priority-normal`
**Milestone**: M4

```markdown
## 任务描述
- `POST /backups` —— 立即备份
- `GET /backups/:filename/download` —— 下载（需 ops:backup 权限）

## 依赖
- #T4.2

## 估时
1.5 小时

## 验收标准
- [ ] 下载需权限
- [ ] 大文件流式输出

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.5] 备份清理策略`
**Labels**: `phase-4`, `backend`, `priority-low`
**Milestone**: M4

```markdown
## 任务描述
保留最近 30 个,旧的自动删除。

## 依赖
- #T4.4

## 估时
1 小时

## 验收标准
- [ ] 配置项可调

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.6] 系统监控 API`
**Labels**: `phase-4`, `backend`, `priority-high`
**Milestone**: M4

```markdown
## 任务描述
Node 进程状态、CPU、内存、磁盘、SQLite 文件大小。

## 依赖
M2 完成

## 估时
2 小时

## 验收标准
- [ ] Linux 环境通过 `os` 模块读取
- [ ] Docker 内也准确

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.7] 自动备份定时任务`
**Labels**: `phase-4`, `backend`, `priority-normal`
**Milestone**: M4

```markdown
## 任务描述
cron 表达式可配置,默认每天 03:00。

## 依赖
- #T4.2

## 估时
1 小时

## 验收标准
- [ ] cron 触发
- [ ] 失败发邮件/日志告警

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.8] 旧审计日志清理任务`
**Labels**: `phase-4`, `backend`, `priority-low`
**Milestone**: M4

```markdown
## 任务描述
保留 90 天,可配置。

## 依赖
- #T4.1

## 估时
0.5 小时

## 验收标准
- [ ] 配置可调

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.9] 审计日志查询页`
**Labels**: `phase-4`, `frontend`, `priority-high`
**Milestone**: M4

```markdown
## 任务描述
表格 + 时间范围 + 用户筛选 + 操作类型筛选 + 详情抽屉。

## 依赖
- #T4.1

## 估时
3 小时

## 验收标准
- [ ] 翻页流畅、详情清晰

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.10] 备份管理页`
**Labels**: `phase-4`, `frontend`, `priority-normal`
**Milestone**: M4

```markdown
## 任务描述
列表 + 立即备份按钮 + 下载 + 状态提示。

## 依赖
- #T4.3
- #T4.4

## 估时
2 小时

## 验收标准
- [ ] 备份过程有 loading

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

### 标题：`[T4.11] 系统监控看板`
**Labels**: `phase-4`, `frontend`, `priority-high`
**Milestone**: M4

```markdown
## 任务描述
仪表盘式展示 CPU/内存/磁盘/数据库大小,30 秒刷新。

## 依赖
- #T4.6

## 估时
2 小时

## 验收标准
- [ ] 30 秒刷新一次
- [ ] 数字与 `htop` / `df -h` 一致

## 关联
- 文档：docs/04-admin-architecture.md 第 9 节
```

---

## 9. Phase 5 Issues（T5.1 ～ T5.10）

### 标题：`[T5.1] Dockerfile 升级`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
增加 Vue 3 SPA 构建步骤,暴露双端口。

## 依赖
M4 完成

## 估时
1.5 小时

## 验收标准
- [ ] `docker build` 一次性产出可用镜像
- [ ] 镜像大小合理

## 关联
- 文档：docs/04-admin-architecture.md 第 11 节
```

---

### 标题：`[T5.2] docker-compose 双端口与卷`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
映射 8787 + 3000 端口,卷持久化 backups/。

## 依赖
- #T5.1

## 估时
0.5 小时

## 验收标准
- [ ] 容器重启后备份不丢

## 关联
- 文档：docs/04-admin-architecture.md 第 11 节
```

---

### 标题：`[T5.3] Nginx 反向代理配置`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
`/admin/*` + `/api/v2/*` 反代到 3000,其他到 8787。

## 依赖
- #T5.1

## 估时
1 小时

## 验收标准
- [ ] `nginx -t` 通过
- [ ] 浏览器访问无 cors 错误

## 关联
- 文档：docs/04-admin-architecture.md 第 11 节
```

---

### 标题：`[T5.4] 灰度发布`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
先在 192.168.3.100 部署测试,生产前观察 24 小时。

## 依赖
- #T5.3

## 估时
0.5 小时

## 验收标准
- [ ] 内网访问无异常

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

### 标题：`[T5.5] 生产数据备份`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
上线前手动备份现有 `blog.sqlite`。

## 依赖
- #T5.4

## 估时
0.5 小时

## 验收标准
- [ ] 备份文件本地保存一份

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

### 标题：`[T5.6] deploy.sh 升级`
**Labels**: `phase-5`, `devops`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
更新部署脚本,一条命令完成 docker build/push、scp、ssh restart。

## 依赖
- #T5.4

## 估时
1 小时

## 验收标准
- [ ] 一条命令完成部署

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

### 标题：`[T5.7] 监控验证`
**Labels**: `phase-5`, `verify`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
登录新后台、查看 PV、查看监控、查看审计。

## 依赖
- #T5.6

## 估时
0.5 小时

## 验收标准
- [ ] 全部正常

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

### 标题：`[T5.8] 旧 EJS 后台过渡提示`
**Labels**: `phase-5`, `backend`, `priority-normal`
**Milestone**: M5

```markdown
## 任务描述
在 nav 加入"已迁移到新后台"提示,保留 1 个月作为兜底。

## 依赖
- #T5.7

## 估时
1 小时

## 验收标准
- [ ] 提示明显
- [ ] 链接到新后台

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

### 标题：`[T5.9] 部署文档发布`
**Labels**: `phase-5`, `docs`, `priority-high`
**Milestone**: M5

```markdown
## 任务描述
- `docs/06-deployment-guide.md` —— 部署手册
- `docs/09-rollback-runbook.md` —— 应急回滚
- `docs/07-user-manual.md` —— 用户手册定稿

## 依赖
- #T5.7

## 估时
2 小时

## 验收标准
- [ ] 三份文档齐全

## 关联
- 文档：docs/05-implementation-plan.md 14.2 节
```

---

### 标题：`[T5.10] EJS 后台正式下线`
**Labels**: `phase-5`, `backend`, `priority-normal`
**Milestone**: M5

```markdown
## 任务描述
1 周后注释 EJS 路由,`/admin/posts` 等返回 404 或重定向。

## 依赖
- #T5.8

## 估时
0.5 小时

## 验收标准
- [ ] 旧路由返回 404
- [ ] 重定向到新后台

## 关联
- 文档：docs/05-implementation-plan.md 8 节
```

---

## 10. GitHub CLI 批量创建脚本

把以下脚本保存为 `scripts/create-issues.sh`,运行一次即可创建全部 Issues：

```bash
#!/bin/bash
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Creating issues in $REPO..."

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  local milestone="$4"

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "$milestone"
}

# Phase 1
create_issue \
  "[T1.1] 创建后端新目录结构" \
  "$(cat <<'EOF'
## 任务描述
创建后端新目录：middleware/、apps/、modules/、jobs/

## 依赖
无

## 估时
0.5 小时

## 验收标准
- [ ] 四个目录存在并各有 README

## 关联
- docs/04-admin-architecture.md
EOF
)" \
  "phase-1,backend,priority-high" \
  "M1: 双端口可用 + 后台登录"

# 余下 93 个 Issue 按相同模式...
# 完整脚本可由本文档逐一复制粘贴生成,或使用 yq/jq + JSON 批量

echo "All issues created!"
```

> **建议**：将所有 Issue 数据存入 `scripts/issues.json`,然后用 `jq` 循环创建：
>
> ```bash
> jq -c '.[]' issues.json | while read item; do
>   title=$(echo "$item" | jq -r '.title')
>   body=$(echo "$item" | jq -r '.body')
>   labels=$(echo "$item" | jq -r '.labels')
>   milestone=$(echo "$item" | jq -r '.milestone')
>   gh issue create --title "$title" --body "$body" --label "$labels" --milestone "$milestone"
> done
> ```

---

## 11. GitHub Project Board 推荐配置

创建一个名为 **"超级后台系统 v2"** 的 Project（用 Projects v2 / Beta)：

**列设置（Status 字段）**：
- Backlog（待办)
- Ready（已计划)
- In Progress（进行中)
- In Review（自我 review）
- Done（已完成）

**自定义字段**：
- Phase（单选：phase-1～phase-5）
- Type（单选：backend/frontend/devops/docs/verify）
- Priority（单选：high/normal/low）
- Estimate（数字：估时小时数）
- Actual（数字：实际花时,完工后填）

**视图**：
- **Table** —— 全部任务总览
- **Board by Phase** —— 看板按 Phase 分组
- **Board by Status** —— 看板按状态分组
- **Roadmap** —— 时间线视图（按 Estimate）

---

## 12. 周报模板

每周日晚上提交一份周报到 `docs/weekly/2026-Wxx.md`：

```markdown
# 第 XX 周周报（2026-MM-DD ~ 2026-MM-DD）

## 本周完成
- [x] T1.1 创建后端新目录结构（0.5h）
- [x] T1.2 安装新依赖（0.5h）

## 本周遇到的问题
- 问题 1：xxx —— 解决方式
- 问题 2：xxx —— 暂未解决,转 [#issue]

## 下周计划
- [ ] T1.3 数据库迁移
- [ ] T1.4 数据库种子

## 总结
- 本周累计：X 小时
- 累计完成：X / 94 任务
- M1 进度：XX%
```

---

## 13. 完成标志

当全部 94 个 Issue 关闭、所有 Phase Checklist 勾选完毕、CHANGELOG 更新到位、生产环境运行稳定 24 小时,即视为本期项目交付完成。

> **下一步**：保存本文件 → 在仓库执行 `bash scripts/create-issues.sh` → 进入 GitHub Projects 看板开始第一个任务 🚀
