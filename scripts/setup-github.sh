#!/usr/bin/env bash
# ==============================================================================
# 超级后台系统 v2 — GitHub 仓库初始化一键脚本
#
# 一次性完成：
#   1) 创建 16 个标签（Phase / 类型 / 优先级 / 状态）
#   2) 创建 5 个里程碑（M1 ~ M5）
#   3) 创建 95 个 Issue（T1.1 ~ T5.10）
#   4) 创建 Project v2 看板
#
# 使用方法：
#   1. 安装 GitHub CLI: https://cli.github.com
#   2. 登录: gh auth login --scopes "repo,project,write:org"
#   3. 在项目根目录执行: bash scripts/setup-github.sh
#
# 重复运行说明：
#   - 标签 / 里程碑 已存在时跳过（|| true）
#   - Issue 每次都会新建（GitHub 不允许去重创建），重复运行前请清理或注释
# ==============================================================================

set -euo pipefail

# ----- 配置区 -----
REPO="${REPO:-ifoxchen-glitch/blog-design-v2.0}"
PROJECT_TITLE="${PROJECT_TITLE:-超级后台系统 v2}"

# 里程碑标题（与 Issue 引用保持一致）
M1="M1: 双端口可用 + 后台登录"
M2="M2: 新后台可下线 EJS"
M3="M3: 数据分析模块上线"
M4="M4: 运维监控模块上线"
M5="M5: 项目正式上线"

# 里程碑截止日期（基于今天 2026-05-03 起算，可自行调整）
M1_DUE="2026-05-17T23:59:59Z"
M2_DUE="2026-06-14T23:59:59Z"
M3_DUE="2026-06-28T23:59:59Z"
M4_DUE="2026-07-12T23:59:59Z"
M5_DUE="2026-07-26T23:59:59Z"

# ----- 工具函数 -----
echo_section() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

create_label() {
  local name="$1" color="$2" desc="$3"
  echo "  + label: $name"
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" 2>/dev/null \
    || gh label edit "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
}

create_milestone() {
  local title="$1" desc="$2" due="$3"
  echo "  + milestone: $title"
  gh api "repos/$REPO/milestones" \
    -f title="$title" \
    -f description="$desc" \
    -f due_on="$due" \
    -f state="open" >/dev/null 2>&1 || echo "    (already exists, skipping)"
}

create_issue() {
  local title="$1" labels="$2" milestone="$3" body="$4"
  echo "  + issue: $title"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "$labels" \
    --milestone "$milestone" \
    --body "$body" >/dev/null
}

# ============================================================================
# Step 0: 前置检查
# ============================================================================
echo_section "前置检查"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ 未安装 GitHub CLI，请先安装: https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 未登录 GitHub，请先执行: gh auth login --scopes 'repo,project,write:org'" >&2
  exit 1
fi

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "❌ 无法访问仓库 $REPO，请检查 REPO 变量与 gh 权限" >&2
  exit 1
fi

echo "✅ gh CLI 已就绪"
echo "✅ 仓库: $REPO"

# ============================================================================
# Step 1: 创建标签
# ============================================================================
echo_section "Step 1/4: 创建标签"

# Phase 标签
create_label "phase-1"        "1d76db" "Phase 1: 基础脚手架"
create_label "phase-2"        "0e8a16" "Phase 2: RBAC + CMS 迁移"
create_label "phase-3"        "fbca04" "Phase 3: 数据分析"
create_label "phase-4"        "d93f0b" "Phase 4: 运维监控"
create_label "phase-5"        "5319e7" "Phase 5: 上线"

# 类型标签
create_label "backend"        "0366d6" "后端开发"
create_label "frontend"       "bfd4f2" "前端开发"
create_label "devops"         "0e8a16" "部署运维"
create_label "docs"           "c5def5" "文档"
create_label "verify"         "fef2c0" "集成验收"

# 优先级标签
create_label "priority-high"   "b60205" "高优先级"
create_label "priority-normal" "fbca04" "普通优先级"
create_label "priority-low"    "c2e0c6" "低优先级"

# 状态标签
create_label "blocked"     "d93f0b" "被阻塞"
create_label "in-progress" "fbca04" "进行中"
create_label "done"        "0e8a16" "已完成"

# ============================================================================
# Step 2: 创建里程碑
# ============================================================================
echo_section "Step 2/4: 创建里程碑"

create_milestone "$M1" "Phase 1 完成 — 双端口启动、后台登录闭环跑通"          "$M1_DUE"
create_milestone "$M2" "Phase 2 完成 — 所有博客管理功能在新后台可用，可下线 EJS" "$M2_DUE"
create_milestone "$M3" "Phase 3 完成 — PV/UV 统计、流量趋势、内容分析图表" "$M3_DUE"
create_milestone "$M4" "Phase 4 完成 — 审计日志、备份、系统监控" "$M4_DUE"
create_milestone "$M5" "Phase 5 完成 — 生产部署、Nginx 配置、旧 EJS 下线" "$M5_DUE"

# ============================================================================
# Step 3: 创建 Issues
# ============================================================================
echo_section "Step 3/4: 创建 Issues (T1.1 ~ T5.10, 共 95 个)"

# ---------- Phase 1 (T1.1 ~ T1.26) ----------

create_issue "[T1.1] 创建后端新目录结构" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
创建后端新目录：`middleware/`、`apps/`、`modules/`、`jobs/`，每个目录添加 README 占位说明用途。

## 依赖
无（项目起点）

## 估时
0.5 小时

## 验收标准
- [ ] `server/src/middleware/` 目录存在，含 README
- [ ] `server/src/apps/` 目录存在，含 README
- [ ] `server/src/modules/` 目录存在，含 README
- [ ] `server/src/jobs/` 目录存在，含 README

## 关联
- docs/04-admin-architecture.md 第 4 节
EOF
)"

create_issue "[T1.2] 安装新依赖（jsonwebtoken/cors/joi/winston/node-cron）" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
在 `server/` 目录安装新增依赖：
- `jsonwebtoken` — JWT 签发与校验
- `cors` — 仅开发环境跨域
- `joi` — 请求参数校验
- `winston` — 结构化日志
- `node-cron` — 定时任务

## 依赖
- T1.1

## 估时
0.5 小时

## 验收标准
- [ ] `server/package.json` 包含上述依赖
- [ ] `npm install` 通过
- [ ] `node -e "require('jsonwebtoken')"` 不报错

## 关联
- docs/04-admin-architecture.md 第 4.2 节
EOF
)"

create_issue "[T1.3] 数据库迁移：新增 RBAC 与扩展表" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
扩展 `server/src/db.js` 的 `migrate()`，新增以下表：
`users`、`roles`、`permissions`、`role_permissions`、`user_roles`、`menus`、`audit_logs`、`front_users`、`page_views`、`sites`。

## 依赖
- T1.1

## 估时
2 小时

## 验收标准
- [ ] 启动 server 后所有新表自动创建
- [ ] `sqlite3 server/db/blog.sqlite ".schema"` 可看到全部新表
- [ ] 新表均使用 `CREATE TABLE IF NOT EXISTS`，不影响现有表

## 关联
- docs/04-admin-architecture.md 第 5 节
EOF
)"

create_issue "[T1.4] 数据库种子：超管账号 + 基础角色 + 权限 + 菜单" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
扩展 `ensureSeed()`，首次启动时插入：
- 超级管理员账号（从 `.env` 迁移、bcrypt 加密）
- 3 个基础角色：超级管理员 / 内容编辑 / 只读访客
- 12 个基础权限（post:* / tag:* / category:* / user:* / role:* 等）
- 默认菜单树（Dashboard / CMS / RBAC / Analytics / Ops）

## 依赖
- T1.3

## 估时
1.5 小时

## 验收标准
- [ ] `users` 表中存在超管账号
- [ ] 用 ADMIN_EMAIL + ADMIN_PASSWORD 调用 v2 登录 API 成功
- [ ] roles / permissions / menus 表均有种子数据

## 关联
- docs/04-admin-architecture.md 第 5、8 节
EOF
)"

create_issue "[T1.5] 拆分 frontApp.js，迁移现有所有路由" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
新建 `server/src/apps/frontApp.js`，迁移现有 `index.js` 中的：
- 公共 API：`/api/posts`、`/api/tags`、`/api/categories`、`/api/links`、`/rss.xml`
- 旧 admin 页面（EJS）：`/admin/login`、`/admin/posts/*`、`/admin/links`
- 旧 admin API：`/api/admin/*`

挂载在 8787 端口的 Express 实例上。

## 依赖
- T1.1

## 估时
2 小时

## 验收标准
- [ ] 8787 端口启动后所有现有功能正常
- [ ] 前端 index.html / post.html 数据加载正常

## 关联
- docs/04-admin-architecture.md 第 4.1 节
EOF
)"

create_issue "[T1.6] 创建 adminApp.js，挂载 v2 路由前缀" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
新建 `server/src/apps/adminApp.js`，挂载 `/api/v2/*`：
- /api/v2/auth/*
- /api/v2/admin/cms/*
- /api/v2/admin/rbac/*
- /api/v2/admin/analytics/*
- /api/v2/admin/ops/*
- /health 健康检查

## 依赖
- T1.1

## 估时
1 小时

## 验收标准
- [ ] 3000 端口启动
- [ ] curl http://localhost:3000/health 返回 { ok: true }

## 关联
- docs/04-admin-architecture.md 第 4.1 节
EOF
)"

create_issue "[T1.7] 改造 index.js 实现双端口同进程启动" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
1. 同时引入 frontApp 与 adminApp
2. 共享同一 SQLite 数据库连接
3. 两个 HTTP 服务监听不同端口
4. 启动日志清晰打印两个端口

## 依赖
- T1.5
- T1.6

## 估时
1 小时

## 验收标准
- [ ] npm run dev 同时打印两个端口
- [ ] 两个端口都能独立访问
- [ ] 数据库连接只创建一次

## 关联
- docs/04-admin-architecture.md 第 4 节
EOF
)"

create_issue "[T1.8] 实现 middleware/cors.js（仅开发环境）" "phase-1,backend,priority-normal" "$M1" "$(cat <<'EOF'
## 任务描述
- 检测 NODE_ENV !== 'production'
- 允许 http://localhost:5173 跨域访问
- 生产环境完全关闭 cors，通过 Nginx 同域处理

## 依赖
- T1.6

## 估时
0.5 小时

## 验收标准
- [ ] 开发环境 5173 → 3000 请求成功
- [ ] 生产环境无 cors 头

## 关联
- docs/04-admin-architecture.md 第 7 节
EOF
)"

create_issue "[T1.9] 实现 middleware/jwtAuth.js" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 从 Authorization: Bearer xxx 提取 token
- 验证签名与过期时间
- 校验通过后 req.user 挂载用户信息
- 失败返回 401 (区分 missing / invalid / expired)

## 依赖
- T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 单元测试：无 token 401
- [ ] 单元测试：过期 token 401
- [ ] 单元测试：有效 token 通过且 req.user 有值

## 关联
- docs/04-admin-architecture.md 第 6.2 节
EOF
)"

create_issue "[T1.10] 实现 middleware/rbac.js" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
RBAC 中间件工厂 `requirePermission(code)`：
- 超管直接放行
- 普通用户检查 req.user.permissions 是否包含 code
- 未通过返回 403

## 依赖
- T1.9

## 估时
1 小时

## 验收标准
- [ ] 超管访问任何路由都通过
- [ ] 无权限用户访问受保护路由 403
- [ ] 错误信息提示缺少哪个权限

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T1.11] 实现 /api/v2/auth/login" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 输入：email / password
- bcrypt 校验密码
- 签发 accessToken (2h) + refreshToken (7d)
- 返回用户信息（不含密码哈希）

## 依赖
- T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 正确密码返回 200 + token + user
- [ ] 错误密码返回 401（不区分账号是否存在）

## 关联
- docs/04-admin-architecture.md 第 6.2 节
EOF
)"

create_issue "[T1.12] 实现 /api/v2/auth/refresh" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 输入：refreshToken
- 验证签名与过期
- 返回新的 accessToken（refreshToken 不变）

## 依赖
- T1.11

## 估时
1 小时

## 验收标准
- [ ] 有效 refreshToken 返回新 accessToken
- [ ] 过期 refreshToken 返回 401

## 关联
- docs/04-admin-architecture.md 第 6.2 节
EOF
)"

create_issue "[T1.13] 实现 /api/v2/auth/logout、/me、/menus" "phase-1,backend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- /auth/logout — 客户端清 token 即可
- /auth/me — 返回当前用户详情 + 角色 + 权限
- /auth/menus — 根据用户角色返回菜单树

## 依赖
- T1.11

## 估时
1 小时

## 验收标准
- [ ] /me 返回完整用户信息
- [ ] /menus 返回符合角色的菜单（超管全部）
- [ ] 未登录访问 /me /menus 返回 401

## 关联
- docs/04-admin-architecture.md 第 6.2 节
EOF
)"

create_issue "[T1.14] 初始化 admin/ 目录（Vue 3 + Vite + TS）" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 项目根创建 admin/ 目录
- npm create vite@latest 模板：vue-ts
- 安装 vue@3、vue-router@4、pinia
- .gitignore 排除 node_modules

## 依赖
无

## 估时
1 小时

## 验收标准
- [ ] cd admin && npm run dev 启动 5173
- [ ] 浏览器看到 Vite 默认欢迎页

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.15] 配置 Naive UI、Tailwind、Pinia、Vue Router" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- naive-ui + @vicons/ionicons5
- Tailwind CSS + tailwind.config.js
- Pinia store 入口
- Vue Router 4 + 路由懒加载

## 依赖
- T1.14

## 估时
1.5 小时

## 验收标准
- [ ] App.vue 中可用 <n-button>
- [ ] Tailwind class 生效
- [ ] Pinia 测试 store 可读写

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.16] 配置 vite.config.ts 代理 /api 到 3000" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
admin/vite.config.ts dev 代理：

```ts
server: { proxy: { '/api': 'http://localhost:3000' } }
```

## 依赖
- T1.14

## 估时
0.5 小时

## 验收标准
- [ ] /api/v2/auth/login 代理到 3000
- [ ] DevTools Network 看到正确目标

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.17] 实现 api/request.ts（Axios 拦截器）" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 请求拦截：自动 Authorization: Bearer xxx
- 响应拦截：401 调 /auth/refresh 重试一次，失败跳登录
- 全局错误提示（Naive UI message）

## 依赖
- T1.16

## 估时
1.5 小时

## 验收标准
- [ ] 401 自动续期重试
- [ ] 续期失败跳转 /login
- [ ] 业务错误显示提示

## 关联
- docs/04-admin-architecture.md 第 6.2 节
EOF
)"

create_issue "[T1.18] 实现 stores/auth.ts" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
Pinia auth store：
- state：accessToken / refreshToken / user
- actions：login / logout / loadUser
- 持久化到 localStorage

## 依赖
- T1.17

## 估时
1 小时

## 验收标准
- [ ] login 后 token 存 localStorage
- [ ] 刷新页面 token 仍在
- [ ] logout 清除所有状态

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.19] 实现 stores/permission.ts" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
Pinia permission store：
- state：menus（树形）/ permissionCodes (Set)
- actions：loadMenus（从 /auth/menus）
- getter：hasPermission(code)

## 依赖
- T1.18

## 估时
1 小时

## 验收标准
- [ ] 登录后 loadMenus 获取菜单
- [ ] hasPermission('post:create') 返回正确布尔值

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T1.20] 实现 views/login/index.vue" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
登录页：邮箱 + 密码 + 提交按钮 + loading + 错误提示。

## 依赖
- T1.18

## 估时
1.5 小时

## 验收标准
- [ ] 正确账号跳 dashboard
- [ ] 错误账号清晰提示
- [ ] 表单校验（空值、邮箱格式）

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.21] 实现路由守卫" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
- 未登录跳 /login?redirect=xxx
- 已登录访问 /login 跳 /dashboard
- 无权限路由跳 403

## 依赖
- T1.18
- T1.19

## 估时
1.5 小时

## 验收标准
- [ ] URL 直接访问 /cms/posts 未登录跳登录
- [ ] 登录后回跳到原目标
- [ ] 无权限菜单不显示入口

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T1.22] 实现 components/layout/AdminLayout.vue" "phase-1,frontend,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
后台主布局：
- 顶栏（logo / 面包屑 / 用户菜单）
- 侧边栏（菜单 store 渲染 / 折叠 / 当前选中）
- 主区域 <router-view>

## 依赖
- T1.19

## 估时
2 小时

## 验收标准
- [ ] 侧边栏按权限渲染菜单
- [ ] 折叠/展开切换流畅
- [ ] 退出按钮调用 logout

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.23] 实现 views/dashboard/index.vue 占位页" "phase-1,frontend,priority-normal" "$M1" "$(cat <<'EOF'
## 任务描述
最小可运行 Dashboard：显示"欢迎回来 XXX"，Phase 3 替换为完整数据看板。

## 依赖
- T1.22

## 估时
0.5 小时

## 验收标准
- [ ] 登录后看到欢迎语
- [ ] 用户名正确显示

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T1.24] 实现 directives/permission.ts" "phase-1,frontend,priority-normal" "$M1" "$(cat <<'EOF'
## 任务描述
自定义指令 v-permission：
- v-permission="'post:delete'" 无权限时不渲染
- 支持数组：v-permission="['post:create', 'post:edit']"

## 依赖
- T1.19

## 估时
1 小时

## 验收标准
- [ ] 无权限按钮 DOM 不生成
- [ ] 数组任一权限即显示

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T1.25] Phase 1 集成验收" "phase-1,verify,priority-high" "$M1" "$(cat <<'EOF'
## 任务描述
端到端测试：双端口启动 → 登录 → 加载菜单 → Dashboard 显示，录制 GIF 演示。

## 依赖
T1.1 ~ T1.24

## 估时
1 小时

## 验收标准
- [ ] Phase 1 Checklist 全部勾选
- [ ] GIF 演示文件入库

## 关联
- docs/05-implementation-plan.md 4.2 节
EOF
)"

create_issue "[T1.26] Phase 1 文档更新" "phase-1,docs,priority-normal" "$M1" "$(cat <<'EOF'
## 任务描述
- CLAUDE.md：双端口启动、新目录结构
- README.md：开发指南、登录账号说明
- CHANGELOG.md：Phase 1 变更总结

## 依赖
- T1.25

## 估时
1 小时

## 验收标准
- [ ] 新人按文档可在 5 分钟内启动开发环境

## 关联
- docs/05-implementation-plan.md 4.2 节
EOF
)"

# ---------- Phase 2 (T2.1 ~ T2.35) ----------

create_issue "[T2.1] 用户管理 API" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/rbac/users CRUD：列表（分页/搜索/状态）、详情、创建、更新、删除、重置密码。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] Postman 全部跑通
- [ ] 响应不含 password_hash
- [ ] 删除超管被拒绝

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.2] 用户分配角色 API" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
PUT /users/:id/roles — 全量替换用户角色，事务化。

## 依赖
- T2.1

## 估时
1 小时

## 验收标准
- [ ] 一次提交可全量替换
- [ ] 删除最后一个超管被拒绝

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.3] 角色管理 API（CRUD）" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/rbac/roles CRUD，code 唯一校验，删除前检查引用。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 全部接口跑通
- [ ] 重复 code 报错
- [ ] 有用户的角色删除提示影响

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.4] 角色分配权限 API" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
PUT /roles/:id/permissions — 全量替换角色权限。

## 依赖
- T2.3

## 估时
1 小时

## 验收标准
- [ ] 提交后该角色用户的权限实时刷新
- [ ] 内置超管角色不可改

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.5] 权限管理 API" "phase-2,backend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
列表（按 resource 分组）+ 编辑（仅 name/description）。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 不允许直接增删 code
- [ ] 列表按 resource 分组

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.6] 菜单管理 API" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
- 树形列表
- CRUD
- 拖拽排序 POST /menus/reorder

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 排序保存后 /auth/menus 顺序一致

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.7] 审计日志中间件" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
全局中间件自动捕获 POST/PUT/DELETE 写入 audit_logs：
user_id / action / resource / resource_id / ip / user_agent / payload(裁剪) / created_at。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 每次写操作记录一条
- [ ] 日志写失败不阻塞业务

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T2.8] 文章 CRUD API（v2）" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/cms/posts CRUD，列表（分页/搜索/状态/标签/分类筛选）、详情、增删改。
更新时 contentHtml 设 NULL，下次读取再渲染。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 字段、错误码与旧 API 等价
- [ ] 列表性能 1000 篇 < 200ms

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.9] 文章发布/下架 API（v2）" "phase-2,backend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
- POST /posts/:id/publish — 发布，自动设 publishedAt
- POST /posts/:id/unpublish — 下架

## 依赖
- T2.8

## 估时
1 小时

## 验收标准
- [ ] 状态切换、publishedAt 自动更新

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.10] 标签管理 API（v2）" "phase-2,backend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/cms/tags CRUD + 文章数统计。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 删除标签自动解除文章关联
- [ ] 列表返回 postCount

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.11] 分类管理 API（v2）" "phase-2,backend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/cms/categories CRUD + 文章数统计。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 同 T2.10

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.12] 友链管理 API（v2）" "phase-2,backend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/cms/links CRUD + 拖拽排序。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] sortOrder 持久化
- [ ] 拖拽接口幂等

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.13] 文件上传 API（v2）" "phase-2,backend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
/api/v2/admin/cms/upload — 复用 multer，权限改 media:upload。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 单图上传成功
- [ ] 大文件上传被限制

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.14] 数据导出 API（v2）" "phase-2,backend,priority-low" "$M2" "$(cat <<'EOF'
## 任务描述
GET /api/v2/admin/cms/export — 导出 JSON，兼容旧格式。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 导出文件可用 v2 导入还原
- [ ] 包含文章/标签/分类/友链全部数据

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.15] 数据导入 API（v2）" "phase-2,backend,priority-low" "$M2" "$(cat <<'EOF'
## 任务描述
POST /api/v2/admin/cms/import — 上传 JSON，事务化导入。

## 依赖
- T2.14

## 估时
1.5 小时

## 验收标准
- [ ] 支持旧版本备份文件
- [ ] 失败时事务回滚

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.16] PageHeader 组件" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
components/common/PageHeader.vue：标题、面包屑、操作按钮槽位。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 三个 props 槽都可独立配置

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.17] DataTable 组件" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
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
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.18] FormDrawer 组件" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
通用右侧抽屉表单，创建与编辑共用。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 可传入表单 schema 自动渲染

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.19] MarkdownEditor 组件" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
封装 Vditor 或 Bytemd（二选一）：图片粘贴上传、预览、源码切换。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 复制图片粘贴自动上传到 /api/v2/admin/cms/upload
- [ ] 内容双向绑定

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.20] ImageUploader 组件" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
单图/多图上传，带拖拽、进度、删除。

## 依赖
- T2.13

## 估时
1.5 小时

## 验收标准
- [ ] 拖拽上传成功
- [ ] 进度条实时

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.21] useTable composable" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
composables/useTable.ts — 列表数据获取与分页通用 hook。

## 依赖
- T2.17

## 估时
1.5 小时

## 验收标准
- [ ] 切换搜索条件自动刷新
- [ ] 翻页保留搜索

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T2.22] 用户管理页" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
列表 + 增删改 + 重置密码 + 分配角色。

## 依赖
- T2.1
- T2.2
- T2.17

## 估时
4 小时

## 验收标准
- [ ] 全功能跑通
- [ ] 密码字段输入隐藏

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.23] 角色管理页" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
列表 + CRUD + 分配权限（树形勾选）。

## 依赖
- T2.3
- T2.4

## 估时
3 小时

## 验收标准
- [ ] 权限按 resource 分组展示
- [ ] 勾选父节点自动选中子节点

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.24] 权限管理页" "phase-2,frontend,priority-low" "$M2" "$(cat <<'EOF'
## 任务描述
列表（按 resource 分组）+ 编辑（仅 name/description）。

## 依赖
- T2.5

## 估时
1.5 小时

## 验收标准
- [ ] 列表 + 编辑 + 不可删除

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.25] 菜单管理页" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
树形列表 + 拖拽排序 + CRUD。

## 依赖
- T2.6

## 估时
3 小时

## 验收标准
- [ ] 拖拽后保存接口调用成功
- [ ] 树形展开/折叠状态保持

## 关联
- docs/04-admin-architecture.md 第 8 节
EOF
)"

create_issue "[T2.26] 文章列表页" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
表格 + 状态筛选 + 搜索 + 分类筛选 + 批量操作。

## 依赖
- T2.8
- T2.17

## 估时
3 小时

## 验收标准
- [ ] 与旧 EJS 后台功能等价
- [ ] 批量删除支持

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.27] 文章新建/编辑页" "phase-2,frontend,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
Markdown 编辑器 + 元信息表单 + 标签/分类选择 + 封面上传 + 草稿/发布。

## 依赖
- T2.8
- T2.19
- T2.20

## 估时
5 小时

## 验收标准
- [ ] 草稿与发布两种状态切换
- [ ] 离开页面前提示未保存

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.28] 标签管理页" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
列表 + 增删改 + 文章数显示。

## 依赖
- T2.10

## 估时
1.5 小时

## 验收标准
- [ ] 删除前提示影响范围

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.29] 分类管理页" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
列表 + 增删改 + 文章数显示。

## 依赖
- T2.11

## 估时
1.5 小时

## 验收标准
- [ ] 同 T2.28

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.30] 友链管理页" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
列表 + 增删改 + 拖拽排序 + 图标预览。

## 依赖
- T2.12

## 估时
2 小时

## 验收标准
- [ ] 图标可见、排序生效

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.31] 媒体库页" "phase-2,frontend,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
已上传图片网格 + 复制链接 + 删除。

## 依赖
- T2.13

## 估时
2 小时

## 验收标准
- [ ] 网格展示 + 搜索 + 操作

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.32] 数据导入导出页" "phase-2,frontend,priority-low" "$M2" "$(cat <<'EOF'
## 任务描述
一键导出 + 文件上传导入。

## 依赖
- T2.14
- T2.15

## 估时
1.5 小时

## 验收标准
- [ ] 导入前预览数据条数

## 关联
- docs/04-admin-architecture.md 第 6.3 节
EOF
)"

create_issue "[T2.33] 端到端验收" "phase-2,verify,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
登录 → 创建用户 → 分配角色 → 创建文章 → 发布 → 前台查看。

## 依赖
T2.1 ~ T2.32

## 估时
1.5 小时

## 验收标准
- [ ] 录屏 GIF
- [ ] Phase 2 Checklist 全部勾选

## 关联
- docs/05-implementation-plan.md 5.2 节
EOF
)"

create_issue "[T2.34] 旧后台对照测试" "phase-2,verify,priority-high" "$M2" "$(cat <<'EOF'
## 任务描述
所有旧 EJS 功能在新后台均有对应实现的对照清单。

## 依赖
T2.1 ~ T2.32

## 估时
1.5 小时

## 验收标准
- [ ] 对照表入库 docs/migration-checklist.md

## 关联
- docs/05-implementation-plan.md 5.2 节
EOF
)"

create_issue "[T2.35] 用户使用手册" "phase-2,docs,priority-normal" "$M2" "$(cat <<'EOF'
## 任务描述
撰写用户操作手册（用户/角色/文章操作）+ 截图。

## 依赖
- T2.33

## 估时
2 小时

## 验收标准
- [ ] docs/07-user-manual.md 入库
- [ ] 配截图

## 关联
- docs/05-implementation-plan.md 14.2 节
EOF
)"

# ---------- Phase 3 (T3.1 ~ T3.13) ----------

create_issue "[T3.1] PV/UV 上报 API" "phase-3,backend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
POST /api/track — 无需认证，带限流（60 次/分钟/IP）。

## 依赖
M2 完成

## 估时
1.5 小时

## 验收标准
- [ ] 频率限制生效
- [ ] 限流后返回 429

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.2] 上报字段写入 page_views" "phase-3,backend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
字段：path / referrer / ip / user_agent / session_id / created_at。

## 依赖
- T3.1

## 估时
1 小时

## 验收标准
- [ ] 每次访问写入一条
- [ ] IP 不显式存全（隐私脱敏）

## 关联
- docs/04-admin-architecture.md 第 5 节
EOF
)"

create_issue "[T3.3] Dashboard 概览 API" "phase-3,backend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
返回 5-10 个核心指标：总文章 / 总评论（预留 0）/ 今日 PV/UV / 最近 7 天趋势。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 单次请求返回全部
- [ ] 响应 < 100ms

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.4] 流量趋势 API" "phase-3,backend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
按天/小时聚合 PV/UV，支持时间范围。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 7/30/90 天的时序数据
- [ ] 时区按服务器本地

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.5] 内容分析 API" "phase-3,backend,priority-normal" "$M3" "$(cat <<'EOF'
## 任务描述
文章热度 Top 10 + 分类/标签分布。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 各维度排行榜
- [ ] 默认按近 30 天

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.6] 实时统计 API" "phase-3,backend,priority-low" "$M3" "$(cat <<'EOF'
## 任务描述
当前在线人数（最近 5 分钟独立 session_id 数）。

## 依赖
- T3.2

## 估时
1 小时

## 验收标准
- [ ] 返回单一数字
- [ ] 缓存 30 秒

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.7] 定时聚合任务" "phase-3,backend,priority-normal" "$M3" "$(cat <<'EOF'
## 任务描述
每天凌晨聚合昨日数据到 daily_stats 表。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] cron 任务正常运行
- [ ] Docker 容器中也生效

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T3.8] 前台埋点 track 函数" "phase-3,frontend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
js/blog.js 中 track() 函数，页面加载时调用。

## 依赖
- T3.1

## 估时
1 小时

## 验收标准
- [ ] 翻页/刷新都能触发
- [ ] 失败不阻塞页面

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.9] session_id / UV 持久化" "phase-3,frontend,priority-normal" "$M3" "$(cat <<'EOF'
## 任务描述
session_id 用 sessionStorage，UV ID 用 localStorage。

## 依赖
- T3.8

## 估时
0.5 小时

## 验收标准
- [ ] 同浏览器不重复算 UV
- [ ] 关闭浏览器再开 session_id 重置

## 关联
- docs/04-admin-architecture.md 第 6 节
EOF
)"

create_issue "[T3.10] Dashboard 升级（核心指标 + 趋势）" "phase-3,frontend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
4-6 个核心指标卡片 + 最近 7 天趋势小图。

## 依赖
- T3.3

## 估时
2 小时

## 验收标准
- [ ] 数据准确
- [ ] 卡片响应式布局

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T3.11] 流量分析页" "phase-3,frontend,priority-high" "$M3" "$(cat <<'EOF'
## 任务描述
ECharts 折线图（PV/UV）+ 时间范围切换（7/30/90 天）。

## 依赖
- T3.4

## 估时
2.5 小时

## 验收标准
- [ ] 切换无明显卡顿
- [ ] 双 Y 轴

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T3.12] 内容分析页" "phase-3,frontend,priority-normal" "$M3" "$(cat <<'EOF'
## 任务描述
热门文章柱状图 Top 10 + 分类/标签饼图。

## 依赖
- T3.5

## 估时
2 小时

## 验收标准
- [ ] 点击柱子跳文章详情

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

create_issue "[T3.13] 实时面板（Dashboard 卡片）" "phase-3,frontend,priority-low" "$M3" "$(cat <<'EOF'
## 任务描述
Dashboard 显示当前在线，30 秒自动刷新。

## 依赖
- T3.6

## 估时
0.5 小时

## 验收标准
- [ ] 刷新无闪烁

## 关联
- docs/04-admin-architecture.md 第 3 节
EOF
)"

# ---------- Phase 4 (T4.1 ~ T4.11) ----------

create_issue "[T4.1] 审计日志查询 API" "phase-4,backend,priority-high" "$M4" "$(cat <<'EOF'
## 任务描述
列表（多条件筛选）+ 详情。

## 依赖
M2 完成（含 T2.7）

## 估时
2.5 小时

## 验收标准
- [ ] 支持按用户/资源/时间范围筛选
- [ ] 翻页流畅

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.2] SQLite 备份脚本" "phase-4,backend,priority-high" "$M4" "$(cat <<'EOF'
## 任务描述
调用 VACUUM INTO，输出 server/backups/{timestamp}.sqlite。

## 依赖
M2 完成

## 估时
1.5 小时

## 验收标准
- [ ] 不锁库
- [ ] 备份文件可恢复

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.3] 备份列表 API" "phase-4,backend,priority-normal" "$M4" "$(cat <<'EOF'
## 任务描述
列出 backups/ 中的文件 + 大小 + 时间。

## 依赖
- T4.2

## 估时
1 小时

## 验收标准
- [ ] 按时间倒序

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.4] 手动备份 + 下载 API" "phase-4,backend,priority-normal" "$M4" "$(cat <<'EOF'
## 任务描述
- POST /backups — 立即备份
- GET /backups/:filename/download — 下载（需 ops:backup 权限）

## 依赖
- T4.2

## 估时
1.5 小时

## 验收标准
- [ ] 下载需权限
- [ ] 大文件流式输出

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.5] 备份清理策略" "phase-4,backend,priority-low" "$M4" "$(cat <<'EOF'
## 任务描述
保留最近 30 个，旧的自动删除。

## 依赖
- T4.4

## 估时
1 小时

## 验收标准
- [ ] 配置项可调

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.6] 系统监控 API" "phase-4,backend,priority-high" "$M4" "$(cat <<'EOF'
## 任务描述
Node 进程状态、CPU、内存、磁盘、SQLite 文件大小。

## 依赖
M2 完成

## 估时
2 小时

## 验收标准
- [ ] Linux 环境通过 os 模块读取
- [ ] Docker 内也准确

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.7] 自动备份定时任务" "phase-4,backend,priority-normal" "$M4" "$(cat <<'EOF'
## 任务描述
cron 表达式可配置，默认每天 03:00。

## 依赖
- T4.2

## 估时
1 小时

## 验收标准
- [ ] cron 触发
- [ ] 失败发邮件/日志告警

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.8] 旧审计日志清理任务" "phase-4,backend,priority-low" "$M4" "$(cat <<'EOF'
## 任务描述
保留 90 天，可配置。

## 依赖
- T4.1

## 估时
0.5 小时

## 验收标准
- [ ] 配置可调

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.9] 审计日志查询页" "phase-4,frontend,priority-high" "$M4" "$(cat <<'EOF'
## 任务描述
表格 + 时间范围 + 用户筛选 + 操作类型筛选 + 详情抽屉。

## 依赖
- T4.1

## 估时
3 小时

## 验收标准
- [ ] 翻页流畅、详情清晰

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.10] 备份管理页" "phase-4,frontend,priority-normal" "$M4" "$(cat <<'EOF'
## 任务描述
列表 + 立即备份按钮 + 下载 + 状态提示。

## 依赖
- T4.3
- T4.4

## 估时
2 小时

## 验收标准
- [ ] 备份过程有 loading

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

create_issue "[T4.11] 系统监控看板" "phase-4,frontend,priority-high" "$M4" "$(cat <<'EOF'
## 任务描述
仪表盘式展示 CPU/内存/磁盘/数据库大小，30 秒刷新。

## 依赖
- T4.6

## 估时
2 小时

## 验收标准
- [ ] 30 秒刷新一次
- [ ] 数字与 htop / df -h 一致

## 关联
- docs/04-admin-architecture.md 第 9 节
EOF
)"

# ---------- Phase 5 (T5.1 ~ T5.10) ----------

create_issue "[T5.1] Dockerfile 升级" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
增加 Vue 3 SPA 构建步骤，暴露双端口。

## 依赖
M4 完成

## 估时
1.5 小时

## 验收标准
- [ ] docker build 一次性产出可用镜像
- [ ] 镜像大小合理

## 关联
- docs/04-admin-architecture.md 第 11 节
EOF
)"

create_issue "[T5.2] docker-compose 双端口与卷" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
映射 8787 + 3000 端口，卷持久化 backups/。

## 依赖
- T5.1

## 估时
0.5 小时

## 验收标准
- [ ] 容器重启后备份不丢

## 关联
- docs/04-admin-architecture.md 第 11 节
EOF
)"

create_issue "[T5.3] Nginx 反向代理配置" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
/admin/* + /api/v2/* 反代到 3000，其他到 8787。

## 依赖
- T5.1

## 估时
1 小时

## 验收标准
- [ ] nginx -t 通过
- [ ] 浏览器访问无 cors 错误

## 关联
- docs/04-admin-architecture.md 第 11 节
EOF
)"

create_issue "[T5.4] 灰度发布" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
先在 192.168.3.100 部署测试，生产前观察 24 小时。

## 依赖
- T5.3

## 估时
0.5 小时

## 验收标准
- [ ] 内网访问无异常

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

create_issue "[T5.5] 生产数据备份" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
上线前手动备份现有 blog.sqlite。

## 依赖
- T5.4

## 估时
0.5 小时

## 验收标准
- [ ] 备份文件本地保存一份

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

create_issue "[T5.6] deploy.sh 升级" "phase-5,devops,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
更新部署脚本，一条命令完成 docker build / push / scp / ssh restart。

## 依赖
- T5.4

## 估时
1 小时

## 验收标准
- [ ] 一条命令完成部署

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

create_issue "[T5.7] 监控验证" "phase-5,verify,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
登录新后台、查看 PV、查看监控、查看审计。

## 依赖
- T5.6

## 估时
0.5 小时

## 验收标准
- [ ] 全部正常

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

create_issue "[T5.8] 旧 EJS 后台过渡提示" "phase-5,backend,priority-normal" "$M5" "$(cat <<'EOF'
## 任务描述
在 nav 加入"已迁移到新后台"提示，保留 1 个月作为兜底。

## 依赖
- T5.7

## 估时
1 小时

## 验收标准
- [ ] 提示明显
- [ ] 链接到新后台

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

create_issue "[T5.9] 部署文档发布" "phase-5,docs,priority-high" "$M5" "$(cat <<'EOF'
## 任务描述
- docs/06-deployment-guide.md — 部署手册
- docs/09-rollback-runbook.md — 应急回滚
- docs/07-user-manual.md — 用户手册定稿

## 依赖
- T5.7

## 估时
2 小时

## 验收标准
- [ ] 三份文档齐全

## 关联
- docs/05-implementation-plan.md 14.2 节
EOF
)"

create_issue "[T5.10] EJS 后台正式下线" "phase-5,backend,priority-normal" "$M5" "$(cat <<'EOF'
## 任务描述
1 周后注释 EJS 路由，/admin/posts 等返回 404 或重定向。

## 依赖
- T5.8

## 估时
0.5 小时

## 验收标准
- [ ] 旧路由返回 404
- [ ] 重定向到新后台

## 关联
- docs/05-implementation-plan.md 8 节
EOF
)"

# ============================================================================
# Step 4: 创建 Project Board
# ============================================================================
echo_section "Step 4/4: 创建 Project Board"

OWNER=$(echo "$REPO" | cut -d'/' -f1)

echo "  + creating project: $PROJECT_TITLE"
PROJECT_OUTPUT=$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json 2>&1 || echo "FAILED")

if echo "$PROJECT_OUTPUT" | grep -q "FAILED\|error"; then
  echo "    ⚠️  自动创建失败，可能需要 'project' 权限。请手动创建："
  echo "    1) 访问 https://github.com/users/$OWNER/projects 或 https://github.com/orgs/$OWNER/projects"
  echo "    2) 点击 'New project' → 选择 Board 模板"
  echo "    3) 命名为「$PROJECT_TITLE」"
  echo "    4) 通过 Add item → 把所有 Issue 拖入"
else
  PROJECT_NUMBER=$(echo "$PROJECT_OUTPUT" | grep -o '"number":[0-9]*' | head -n1 | cut -d':' -f2)
  PROJECT_URL=$(echo "$PROJECT_OUTPUT" | grep -o '"url":"[^"]*"' | head -n1 | cut -d'"' -f4)
  echo "    ✅ Project #$PROJECT_NUMBER 已创建: $PROJECT_URL"
  echo ""
  echo "  补充建议（手动配置）："
  echo "  - 添加自定义字段 Phase / Type / Priority / Estimate / Actual"
  echo "  - 创建视图：Table（总览）/ Board by Phase / Board by Status / Roadmap"
  echo "  - 用 'Add item' → 把 95 个 Issue 批量加入项目"
fi

# ============================================================================
# 完成
# ============================================================================
echo ""
echo "=========================================="
echo "  🎉 全部完成！"
echo "=========================================="
echo "  仓库 Issues:    https://github.com/$REPO/issues"
echo "  仓库 Milestones: https://github.com/$REPO/milestones"
echo "  Project Board:  https://github.com/users/$OWNER/projects"
echo ""
echo "  下一步建议："
echo "  1) 打开 Issues 页面，确认 95 个任务都已创建"
echo "  2) 在 Project Board 中关联所有 Issue"
echo "  3) 把 T1.1 拖到 In Progress 开始第一周冲刺"
echo "=========================================="
