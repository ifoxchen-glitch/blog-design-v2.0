# ============================================================================
# 超级后台系统 v2 — GitHub 仓库初始化一键脚本（PowerShell 版）
#
# 一次性完成：
#   1) 创建 16 个标签
#   2) 创建 5 个里程碑
#   3) 创建 95 个 Issue
#   4) 创建 Project v2 看板
#
# 使用方法：
#   1. 安装 GitHub CLI: https://cli.github.com（下载 .msi 安装包，一路 Next）
#   2. 在 PowerShell 中登录: gh auth login --scopes "repo,project,write:org"
#   3. 在项目根目录执行: powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1
#      或先 Set-ExecutionPolicy -Scope CurrentUser RemoteSigned，然后 .\scripts\setup-github.ps1
# ============================================================================

# 严格模式
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# UTF-8 输出（Windows PowerShell 5.1 默认是 GBK，会乱码）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ----- 配置区 -----
$REPO          = if ($env:REPO)          { $env:REPO }          else { 'ifoxchen-glitch/blog-design-v2.0' }
$PROJECT_TITLE = if ($env:PROJECT_TITLE) { $env:PROJECT_TITLE } else { '超级后台系统 v2' }

# 里程碑标题
$M1 = 'M1: 双端口可用 + 后台登录'
$M2 = 'M2: 新后台可下线 EJS'
$M3 = 'M3: 数据分析模块上线'
$M4 = 'M4: 运维监控模块上线'
$M5 = 'M5: 项目正式上线'

# 里程碑截止日期（基于今天 2026-05-03，可自行调整）
$M1_DUE = '2026-05-17T23:59:59Z'
$M2_DUE = '2026-06-14T23:59:59Z'
$M3_DUE = '2026-06-28T23:59:59Z'
$M4_DUE = '2026-07-12T23:59:59Z'
$M5_DUE = '2026-07-26T23:59:59Z'

# ----- 工具函数 -----
function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host '==========================================' -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host '==========================================' -ForegroundColor Cyan
}

function New-Label {
    param([string]$Name, [string]$Color, [string]$Description)
    Write-Host "  + label: $Name"
    & gh label create $Name --repo $REPO --color $Color --description $Description 2>$null
    if ($LASTEXITCODE -ne 0) {
        & gh label edit $Name --repo $REPO --color $Color --description $Description 2>$null | Out-Null
    }
}

function New-Milestone {
    param([string]$Title, [string]$Description, [string]$DueOn)
    Write-Host "  + milestone: $Title"
    & gh api "repos/$REPO/milestones" `
        -f "title=$Title" `
        -f "description=$Description" `
        -f "due_on=$DueOn" `
        -f 'state=open' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '    (already exists, skipping)' -ForegroundColor Yellow
    }
}

function New-Issue {
    param([string]$Title, [string]$Labels, [string]$Milestone, [string]$Body)
    Write-Host "  + issue: $Title"
    & gh issue create `
        --repo $REPO `
        --title $Title `
        --label $Labels `
        --milestone $Milestone `
        --body $Body | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ⚠️  failed to create: $Title" -ForegroundColor Red
    }
}

# ============================================================================
# Step 0: 前置检查
# ============================================================================
Write-Section '前置检查'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '❌ 未安装 GitHub CLI' -ForegroundColor Red
    Write-Host '   下载并安装: https://cli.github.com（选 .msi 版本）'
    exit 1
}

& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '❌ 未登录 GitHub，请先执行：' -ForegroundColor Red
    Write-Host '   gh auth login --scopes "repo,project,write:org"'
    exit 1
}

& gh repo view $REPO 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 无法访问仓库 $REPO" -ForegroundColor Red
    exit 1
}

Write-Host '✅ gh CLI 已就绪'
Write-Host "✅ 仓库: $REPO"

# ============================================================================
# Step 1: 创建标签
# ============================================================================
Write-Section 'Step 1/4: 创建标签'

# Phase 标签
New-Label 'phase-1' '1d76db' 'Phase 1: 基础脚手架'
New-Label 'phase-2' '0e8a16' 'Phase 2: RBAC + CMS 迁移'
New-Label 'phase-3' 'fbca04' 'Phase 3: 数据分析'
New-Label 'phase-4' 'd93f0b' 'Phase 4: 运维监控'
New-Label 'phase-5' '5319e7' 'Phase 5: 上线'

# 类型标签
New-Label 'backend'  '0366d6' '后端开发'
New-Label 'frontend' 'bfd4f2' '前端开发'
New-Label 'devops'   '0e8a16' '部署运维'
New-Label 'docs'     'c5def5' '文档'
New-Label 'verify'   'fef2c0' '集成验收'

# 优先级标签
New-Label 'priority-high'   'b60205' '高优先级'
New-Label 'priority-normal' 'fbca04' '普通优先级'
New-Label 'priority-low'    'c2e0c6' '低优先级'

# 状态标签
New-Label 'blocked'     'd93f0b' '被阻塞'
New-Label 'in-progress' 'fbca04' '进行中'
New-Label 'done'        '0e8a16' '已完成'

# ============================================================================
# Step 2: 创建里程碑
# ============================================================================
Write-Section 'Step 2/4: 创建里程碑'

New-Milestone $M1 'Phase 1 完成 — 双端口启动、后台登录闭环跑通' $M1_DUE
New-Milestone $M2 'Phase 2 完成 — 所有博客管理功能在新后台可用，可下线 EJS' $M2_DUE
New-Milestone $M3 'Phase 3 完成 — PV/UV 统计、流量趋势、内容分析图表' $M3_DUE
New-Milestone $M4 'Phase 4 完成 — 审计日志、备份、系统监控' $M4_DUE
New-Milestone $M5 'Phase 5 完成 — 生产部署、Nginx 配置、旧 EJS 下线' $M5_DUE

# ============================================================================
# Step 3: 创建 Issues
# ============================================================================
Write-Section 'Step 3/4: 创建 Issues (T1.1 ~ T5.10, 共 95 个)'

# ---------- Phase 1 (T1.1 ~ T1.26) ----------

New-Issue '[T1.1] 创建后端新目录结构' 'phase-1,backend,priority-high' $M1 @'
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
'@

New-Issue '[T1.2] 安装新依赖（jsonwebtoken/cors/joi/winston/node-cron）' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
在 `server/` 目录安装新增依赖：
- jsonwebtoken — JWT 签发与校验
- cors — 仅开发环境跨域
- joi — 请求参数校验
- winston — 结构化日志
- node-cron — 定时任务

## 依赖
- T1.1

## 估时
0.5 小时

## 验收标准
- [ ] `server/package.json` 包含上述依赖
- [ ] `npm install` 通过

## 关联
- docs/04-admin-architecture.md 第 4.2 节
'@

New-Issue '[T1.3] 数据库迁移：新增 RBAC 与扩展表' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
扩展 `server/src/db.js` 的 `migrate()`，新增以下表：
users、roles、permissions、role_permissions、user_roles、menus、audit_logs、front_users、page_views、sites

## 依赖
- T1.1

## 估时
2 小时

## 验收标准
- [ ] 启动 server 后所有新表自动创建
- [ ] 新表均使用 CREATE TABLE IF NOT EXISTS

## 关联
- docs/04-admin-architecture.md 第 5 节
'@

New-Issue '[T1.4] 数据库种子：超管账号 + 基础角色 + 权限 + 菜单' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
扩展 `ensureSeed()`：
- 超级管理员账号（从 .env 迁移、bcrypt 加密）
- 3 个基础角色：超级管理员 / 内容编辑 / 只读访客
- 12 个基础权限
- 默认菜单树

## 依赖
- T1.3

## 估时
1.5 小时

## 验收标准
- [ ] users 表中存在超管账号
- [ ] 用 ADMIN_EMAIL + ADMIN_PASSWORD 调用 v2 登录 API 成功

## 关联
- docs/04-admin-architecture.md 第 5、8 节
'@

New-Issue '[T1.5] 拆分 frontApp.js，迁移现有所有路由' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
新建 `server/src/apps/frontApp.js`，迁移现有 index.js 中的：
- 公共 API：/api/posts、/api/tags、/api/categories、/api/links、/rss.xml
- 旧 admin 页面（EJS）：/admin/*
- 旧 admin API：/api/admin/*

## 依赖
- T1.1

## 估时
2 小时

## 验收标准
- [ ] 8787 端口启动后所有现有功能正常

## 关联
- docs/04-admin-architecture.md 第 4.1 节
'@

New-Issue '[T1.6] 创建 adminApp.js，挂载 v2 路由前缀' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
新建 `server/src/apps/adminApp.js`，挂载 /api/v2/*

## 依赖
- T1.1

## 估时
1 小时

## 验收标准
- [ ] 3000 端口启动
- [ ] /health 返回 ok

## 关联
- docs/04-admin-architecture.md 第 4.1 节
'@

New-Issue '[T1.7] 改造 index.js 实现双端口同进程启动' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
- 同时引入 frontApp 与 adminApp
- 共享同一 SQLite 数据库连接
- 两个 HTTP 服务监听不同端口

## 依赖
- T1.5
- T1.6

## 估时
1 小时

## 验收标准
- [ ] npm run dev 同时打印两个端口
- [ ] 数据库连接只创建一次

## 关联
- docs/04-admin-architecture.md 第 4 节
'@

New-Issue '[T1.8] 实现 middleware/cors.js（仅开发环境）' 'phase-1,backend,priority-normal' $M1 @'
## 任务描述
- NODE_ENV !== production 时允许 5173 跨域访问
- 生产关闭 cors，由 Nginx 同域处理

## 依赖
- T1.6

## 估时
0.5 小时

## 验收标准
- [ ] 开发环境 5173 → 3000 请求成功
- [ ] 生产环境无 cors 头

## 关联
- docs/04-admin-architecture.md 第 7 节
'@

New-Issue '[T1.9] 实现 middleware/jwtAuth.js' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
- 从 Authorization: Bearer 提取 token
- 验证签名与过期
- req.user 挂载用户信息

## 依赖
- T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 无 token / 过期 / 有效三种场景测试通过

## 关联
- docs/04-admin-architecture.md 第 6.2 节
'@

New-Issue '[T1.10] 实现 middleware/rbac.js' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
RBAC 中间件工厂 requirePermission(code)：
- 超管直接放行
- 普通用户检查权限

## 依赖
- T1.9

## 估时
1 小时

## 验收标准
- [ ] 超管访问任何路由都通过
- [ ] 无权限用户 403

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T1.11] 实现 /api/v2/auth/login' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
- 输入：email / password
- bcrypt 校验
- 签发 accessToken (2h) + refreshToken (7d)

## 依赖
- T1.4

## 估时
1.5 小时

## 验收标准
- [ ] 正确密码返回 token + user
- [ ] 错误密码 401

## 关联
- docs/04-admin-architecture.md 第 6.2 节
'@

New-Issue '[T1.12] 实现 /api/v2/auth/refresh' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
refresh token 续期接口。

## 依赖
- T1.11

## 估时
1 小时

## 验收标准
- [ ] 有效 refresh 返回新 access
- [ ] 过期 refresh 401

## 关联
- docs/04-admin-architecture.md 第 6.2 节
'@

New-Issue '[T1.13] 实现 /api/v2/auth/logout、/me、/menus' 'phase-1,backend,priority-high' $M1 @'
## 任务描述
- /logout — 清 token
- /me — 用户详情 + 角色 + 权限
- /menus — 角色菜单树

## 依赖
- T1.11

## 估时
1 小时

## 验收标准
- [ ] 三个接口跑通

## 关联
- docs/04-admin-architecture.md 第 6.2 节
'@

New-Issue '[T1.14] 初始化 admin/ 目录（Vue 3 + Vite + TS）' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
项目根创建 admin/ 目录，npm create vite@latest，模板 vue-ts。

## 依赖
无

## 估时
1 小时

## 验收标准
- [ ] cd admin && npm run dev 启动 5173

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.15] 配置 Naive UI、Tailwind、Pinia、Vue Router' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
- naive-ui + @vicons/ionicons5
- Tailwind CSS
- Pinia
- Vue Router 4 + 懒加载

## 依赖
- T1.14

## 估时
1.5 小时

## 验收标准
- [ ] 测试组件渲染正常

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.16] 配置 vite.config.ts 代理 /api 到 3000' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
admin/vite.config.ts dev 代理 `/api` → http://localhost:3000

## 依赖
- T1.14

## 估时
0.5 小时

## 验收标准
- [ ] /api/v2/auth/login 请求被代理

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.17] 实现 api/request.ts（Axios 拦截器）' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
- 请求拦截：自动 Authorization: Bearer
- 401 自动 refresh 重试一次

## 依赖
- T1.16

## 估时
1.5 小时

## 验收标准
- [ ] 401 自动续期
- [ ] 续期失败跳登录

## 关联
- docs/04-admin-architecture.md 第 6.2 节
'@

New-Issue '[T1.18] 实现 stores/auth.ts' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
Pinia auth store：accessToken / refreshToken / user / login / logout，持久化到 localStorage。

## 依赖
- T1.17

## 估时
1 小时

## 验收标准
- [ ] login 后 token 存 localStorage
- [ ] 刷新页面 token 仍在

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.19] 实现 stores/permission.ts' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
Pinia permission store：menus / permissionCodes / loadMenus / hasPermission(code)。

## 依赖
- T1.18

## 估时
1 小时

## 验收标准
- [ ] 登录后 loadMenus 获取菜单
- [ ] hasPermission 返回正确布尔值

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T1.20] 实现 views/login/index.vue' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
登录页：邮箱 + 密码 + 提交按钮 + loading + 错误提示。

## 依赖
- T1.18

## 估时
1.5 小时

## 验收标准
- [ ] 正确账号跳 dashboard
- [ ] 错误账号清晰提示

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.21] 实现路由守卫' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
- 未登录跳 /login?redirect=
- 已登录访问 /login 跳 dashboard
- 无权限跳 403

## 依赖
- T1.18
- T1.19

## 估时
1.5 小时

## 验收标准
- [ ] 直接访问受保护路由未登录跳登录
- [ ] 登录后回跳到原目标

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T1.22] 实现 components/layout/AdminLayout.vue' 'phase-1,frontend,priority-high' $M1 @'
## 任务描述
- 顶栏：logo / 面包屑 / 用户菜单
- 侧边栏：菜单 store 渲染、可折叠
- 主区域 router-view

## 依赖
- T1.19

## 估时
2 小时

## 验收标准
- [ ] 侧边栏按权限渲染
- [ ] 折叠/展开切换流畅

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.23] 实现 views/dashboard/index.vue 占位页' 'phase-1,frontend,priority-normal' $M1 @'
## 任务描述
最小可运行 Dashboard，欢迎页。

## 依赖
- T1.22

## 估时
0.5 小时

## 验收标准
- [ ] 登录后看到欢迎语

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T1.24] 实现 directives/permission.ts' 'phase-1,frontend,priority-normal' $M1 @'
## 任务描述
v-permission 指令控制按钮显隐，支持单值和数组。

## 依赖
- T1.19

## 估时
1 小时

## 验收标准
- [ ] 无权限按钮 DOM 不生成

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T1.25] Phase 1 集成验收' 'phase-1,verify,priority-high' $M1 @'
## 任务描述
端到端测试：双端口启动 → 登录 → 加载菜单 → Dashboard，录制 GIF。

## 依赖
T1.1 ~ T1.24

## 估时
1 小时

## 验收标准
- [ ] Phase 1 Checklist 全部勾选
- [ ] GIF 演示文件入库

## 关联
- docs/05-implementation-plan.md 4.2 节
'@

New-Issue '[T1.26] Phase 1 文档更新' 'phase-1,docs,priority-normal' $M1 @'
## 任务描述
- CLAUDE.md：双端口启动、新目录结构
- README.md：开发指南
- CHANGELOG.md：Phase 1 变更总结

## 依赖
- T1.25

## 估时
1 小时

## 验收标准
- [ ] 新人 5 分钟内能启动开发环境

## 关联
- docs/05-implementation-plan.md 4.2 节
'@

# ---------- Phase 2 (T2.1 ~ T2.35) ----------

New-Issue '[T2.1] 用户管理 API' 'phase-2,backend,priority-high' $M2 @'
## 任务描述
/api/v2/admin/rbac/users CRUD：列表（分页/搜索/状态）、详情、创建、更新、删除、重置密码。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] Postman 全部跑通
- [ ] 响应不含 password_hash

## 关联
- docs/04-admin-architecture.md 第 6.3 节
'@

New-Issue '[T2.2] 用户分配角色 API' 'phase-2,backend,priority-high' $M2 @'
## 任务描述
PUT /users/:id/roles — 全量替换用户角色，事务化。

## 依赖
- T2.1

## 估时
1 小时

## 验收标准
- [ ] 一次提交全量替换
- [ ] 删除最后一个超管被拒绝

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T2.3] 角色管理 API（CRUD）' 'phase-2,backend,priority-high' $M2 @'
## 任务描述
/api/v2/admin/rbac/roles CRUD，code 唯一校验，删除前检查引用。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 全部接口跑通
- [ ] 重复 code 报错

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T2.4] 角色分配权限 API' 'phase-2,backend,priority-high' $M2 @'
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
'@

New-Issue '[T2.5] 权限管理 API' 'phase-2,backend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.6] 菜单管理 API' 'phase-2,backend,priority-high' $M2 @'
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
'@

New-Issue '[T2.7] 审计日志中间件' 'phase-2,backend,priority-high' $M2 @'
## 任务描述
全局中间件自动捕获 POST/PUT/DELETE 写入 audit_logs。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 每次写操作记录一条
- [ ] 日志写失败不阻塞业务

## 关联
- docs/04-admin-architecture.md 第 9 节
'@

New-Issue '[T2.8] 文章 CRUD API（v2）' 'phase-2,backend,priority-high' $M2 @'
## 任务描述
/api/v2/admin/cms/posts CRUD（分页/搜索/筛选/排序）。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 字段、错误码与旧 API 等价
- [ ] 列表性能 1000 篇 < 200ms

## 关联
- docs/04-admin-architecture.md 第 6.3 节
'@

New-Issue '[T2.9] 文章发布/下架 API（v2）' 'phase-2,backend,priority-high' $M2 @'
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
'@

New-Issue '[T2.10] 标签管理 API（v2）' 'phase-2,backend,priority-normal' $M2 @'
## 任务描述
/api/v2/admin/cms/tags CRUD + 文章数统计。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] 删除标签自动解除文章关联

## 关联
- docs/04-admin-architecture.md 第 6.3 节
'@

New-Issue '[T2.11] 分类管理 API（v2）' 'phase-2,backend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.12] 友链管理 API（v2）' 'phase-2,backend,priority-normal' $M2 @'
## 任务描述
/api/v2/admin/cms/links CRUD + 拖拽排序。

## 依赖
M1 完成

## 估时
2 小时

## 验收标准
- [ ] sortOrder 持久化

## 关联
- docs/04-admin-architecture.md 第 6.3 节
'@

New-Issue '[T2.13] 文件上传 API（v2）' 'phase-2,backend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.14] 数据导出 API（v2）' 'phase-2,backend,priority-low' $M2 @'
## 任务描述
GET /api/v2/admin/cms/export — 导出 JSON，兼容旧格式。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 导出文件可用 v2 导入还原

## 关联
- docs/04-admin-architecture.md 第 6.3 节
'@

New-Issue '[T2.15] 数据导入 API（v2）' 'phase-2,backend,priority-low' $M2 @'
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
'@

New-Issue '[T2.16] PageHeader 组件' 'phase-2,frontend,priority-normal' $M2 @'
## 任务描述
components/common/PageHeader.vue：标题、面包屑、操作按钮。

## 依赖
M1 完成

## 估时
1 小时

## 验收标准
- [ ] 三个 props 槽都可独立配置

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T2.17] DataTable 组件' 'phase-2,frontend,priority-high' $M2 @'
## 任务描述
通用表格：搜索、分页、批量、排序、加载状态。

## 依赖
M1 完成

## 估时
4 小时

## 验收标准
- [ ] 接受 columns + 数据 API 函数
- [ ] 切换搜索/分页自动刷新

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T2.18] FormDrawer 组件' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.19] MarkdownEditor 组件' 'phase-2,frontend,priority-high' $M2 @'
## 任务描述
封装 Vditor 或 Bytemd：图片粘贴上传、预览、源码切换。

## 依赖
M1 完成

## 估时
3 小时

## 验收标准
- [ ] 复制图片粘贴自动上传
- [ ] 内容双向绑定

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T2.20] ImageUploader 组件' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.21] useTable composable' 'phase-2,frontend,priority-normal' $M2 @'
## 任务描述
composables/useTable.ts — 列表数据获取与分页通用 hook。

## 依赖
- T2.17

## 估时
1.5 小时

## 验收标准
- [ ] 切换搜索条件自动刷新

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T2.22] 用户管理页' 'phase-2,frontend,priority-high' $M2 @'
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
'@

New-Issue '[T2.23] 角色管理页' 'phase-2,frontend,priority-high' $M2 @'
## 任务描述
列表 + CRUD + 分配权限（树形勾选）。

## 依赖
- T2.3
- T2.4

## 估时
3 小时

## 验收标准
- [ ] 权限按 resource 分组
- [ ] 勾选父节点自动选中子节点

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T2.24] 权限管理页' 'phase-2,frontend,priority-low' $M2 @'
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
'@

New-Issue '[T2.25] 菜单管理页' 'phase-2,frontend,priority-normal' $M2 @'
## 任务描述
树形列表 + 拖拽排序 + CRUD。

## 依赖
- T2.6

## 估时
3 小时

## 验收标准
- [ ] 拖拽后保存接口调用成功

## 关联
- docs/04-admin-architecture.md 第 8 节
'@

New-Issue '[T2.26] 文章列表页' 'phase-2,frontend,priority-high' $M2 @'
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
'@

New-Issue '[T2.27] 文章新建/编辑页' 'phase-2,frontend,priority-high' $M2 @'
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
'@

New-Issue '[T2.28] 标签管理页' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.29] 分类管理页' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.30] 友链管理页' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.31] 媒体库页' 'phase-2,frontend,priority-normal' $M2 @'
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
'@

New-Issue '[T2.32] 数据导入导出页' 'phase-2,frontend,priority-low' $M2 @'
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
'@

New-Issue '[T2.33] 端到端验收' 'phase-2,verify,priority-high' $M2 @'
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
'@

New-Issue '[T2.34] 旧后台对照测试' 'phase-2,verify,priority-high' $M2 @'
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
'@

New-Issue '[T2.35] 用户使用手册' 'phase-2,docs,priority-normal' $M2 @'
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
'@

# ---------- Phase 3 (T3.1 ~ T3.13) ----------

New-Issue '[T3.1] PV/UV 上报 API' 'phase-3,backend,priority-high' $M3 @'
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
'@

New-Issue '[T3.2] 上报字段写入 page_views' 'phase-3,backend,priority-high' $M3 @'
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
'@

New-Issue '[T3.3] Dashboard 概览 API' 'phase-3,backend,priority-high' $M3 @'
## 任务描述
返回 5-10 个核心指标：总文章 / 总评论 / 今日 PV/UV / 最近 7 天趋势。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 单次请求返回全部
- [ ] 响应 < 100ms

## 关联
- docs/04-admin-architecture.md 第 6 节
'@

New-Issue '[T3.4] 流量趋势 API' 'phase-3,backend,priority-high' $M3 @'
## 任务描述
按天/小时聚合 PV/UV，支持时间范围。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 7/30/90 天的时序数据

## 关联
- docs/04-admin-architecture.md 第 6 节
'@

New-Issue '[T3.5] 内容分析 API' 'phase-3,backend,priority-normal' $M3 @'
## 任务描述
文章热度 Top 10 + 分类/标签分布。

## 依赖
- T3.2

## 估时
2 小时

## 验收标准
- [ ] 各维度排行榜

## 关联
- docs/04-admin-architecture.md 第 6 节
'@

New-Issue '[T3.6] 实时统计 API' 'phase-3,backend,priority-low' $M3 @'
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
'@

New-Issue '[T3.7] 定时聚合任务' 'phase-3,backend,priority-normal' $M3 @'
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
'@

New-Issue '[T3.8] 前台埋点 track 函数' 'phase-3,frontend,priority-high' $M3 @'
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
'@

New-Issue '[T3.9] session_id / UV 持久化' 'phase-3,frontend,priority-normal' $M3 @'
## 任务描述
session_id 用 sessionStorage，UV ID 用 localStorage。

## 依赖
- T3.8

## 估时
0.5 小时

## 验收标准
- [ ] 同浏览器不重复算 UV

## 关联
- docs/04-admin-architecture.md 第 6 节
'@

New-Issue '[T3.10] Dashboard 升级（核心指标 + 趋势）' 'phase-3,frontend,priority-high' $M3 @'
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
'@

New-Issue '[T3.11] 流量分析页' 'phase-3,frontend,priority-high' $M3 @'
## 任务描述
ECharts 折线图（PV/UV）+ 时间范围切换。

## 依赖
- T3.4

## 估时
2.5 小时

## 验收标准
- [ ] 切换无明显卡顿
- [ ] 双 Y 轴

## 关联
- docs/04-admin-architecture.md 第 3 节
'@

New-Issue '[T3.12] 内容分析页' 'phase-3,frontend,priority-normal' $M3 @'
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
'@

New-Issue '[T3.13] 实时面板（Dashboard 卡片）' 'phase-3,frontend,priority-low' $M3 @'
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
'@

# ---------- Phase 4 (T4.1 ~ T4.11) ----------

New-Issue '[T4.1] 审计日志查询 API' 'phase-4,backend,priority-high' $M4 @'
## 任务描述
列表（多条件筛选）+ 详情。

## 依赖
M2 完成（含 T2.7）

## 估时
2.5 小时

## 验收标准
- [ ] 支持按用户/资源/时间范围筛选

## 关联
- docs/04-admin-architecture.md 第 9 节
'@

New-Issue '[T4.2] SQLite 备份脚本' 'phase-4,backend,priority-high' $M4 @'
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
'@

New-Issue '[T4.3] 备份列表 API' 'phase-4,backend,priority-normal' $M4 @'
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
'@

New-Issue '[T4.4] 手动备份 + 下载 API' 'phase-4,backend,priority-normal' $M4 @'
## 任务描述
- POST /backups — 立即备份
- GET /backups/:filename/download — 下载

## 依赖
- T4.2

## 估时
1.5 小时

## 验收标准
- [ ] 下载需权限
- [ ] 大文件流式输出

## 关联
- docs/04-admin-architecture.md 第 9 节
'@

New-Issue '[T4.5] 备份清理策略' 'phase-4,backend,priority-low' $M4 @'
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
'@

New-Issue '[T4.6] 系统监控 API' 'phase-4,backend,priority-high' $M4 @'
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
'@

New-Issue '[T4.7] 自动备份定时任务' 'phase-4,backend,priority-normal' $M4 @'
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
'@

New-Issue '[T4.8] 旧审计日志清理任务' 'phase-4,backend,priority-low' $M4 @'
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
'@

New-Issue '[T4.9] 审计日志查询页' 'phase-4,frontend,priority-high' $M4 @'
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
'@

New-Issue '[T4.10] 备份管理页' 'phase-4,frontend,priority-normal' $M4 @'
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
'@

New-Issue '[T4.11] 系统监控看板' 'phase-4,frontend,priority-high' $M4 @'
## 任务描述
仪表盘式展示 CPU/内存/磁盘/数据库大小，30 秒刷新。

## 依赖
- T4.6

## 估时
2 小时

## 验收标准
- [ ] 30 秒刷新一次

## 关联
- docs/04-admin-architecture.md 第 9 节
'@

# ---------- Phase 5 (T5.1 ~ T5.10) ----------

New-Issue '[T5.1] Dockerfile 升级' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.2] docker-compose 双端口与卷' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.3] Nginx 反向代理配置' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.4] 灰度发布' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.5] 生产数据备份' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.6] deploy.sh 升级' 'phase-5,devops,priority-high' $M5 @'
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
'@

New-Issue '[T5.7] 监控验证' 'phase-5,verify,priority-high' $M5 @'
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
'@

New-Issue '[T5.8] 旧 EJS 后台过渡提示' 'phase-5,backend,priority-normal' $M5 @'
## 任务描述
nav 加入"已迁移到新后台"提示，保留 1 个月作为兜底。

## 依赖
- T5.7

## 估时
1 小时

## 验收标准
- [ ] 提示明显
- [ ] 链接到新后台

## 关联
- docs/05-implementation-plan.md 8 节
'@

New-Issue '[T5.9] 部署文档发布' 'phase-5,docs,priority-high' $M5 @'
## 任务描述
- docs/06-deployment-guide.md
- docs/09-rollback-runbook.md
- docs/07-user-manual.md 定稿

## 依赖
- T5.7

## 估时
2 小时

## 验收标准
- [ ] 三份文档齐全

## 关联
- docs/05-implementation-plan.md 14.2 节
'@

New-Issue '[T5.10] EJS 后台正式下线' 'phase-5,backend,priority-normal' $M5 @'
## 任务描述
1 周后注释 EJS 路由，/admin/posts 等返回 404 或重定向。

## 依赖
- T5.8

## 估时
0.5 小时

## 验收标准
- [ ] 旧路由返回 404

## 关联
- docs/05-implementation-plan.md 8 节
'@

# ============================================================================
# Step 4: 创建 Project Board
# ============================================================================
Write-Section 'Step 4/4: 创建 Project Board'

$OWNER = ($REPO -split '/')[0]

Write-Host "  + creating project: $PROJECT_TITLE"

$projectOutput = & gh project create --owner $OWNER --title $PROJECT_TITLE --format json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '    ⚠️  自动创建失败，可能需要 project 权限。请手动创建：' -ForegroundColor Yellow
    Write-Host "    1) 访问 https://github.com/users/$OWNER/projects"
    Write-Host '    2) 点击 New project → 选择 Board 模板'
    Write-Host "    3) 命名为「$PROJECT_TITLE」"
    Write-Host '    4) 通过 Add item → 把所有 Issue 拖入'
} else {
    try {
        $project = $projectOutput | ConvertFrom-Json
        Write-Host "    ✅ Project #$($project.number) 已创建: $($project.url)" -ForegroundColor Green
    } catch {
        Write-Host '    ✅ Project 已创建（无法解析返回 JSON）' -ForegroundColor Green
    }
    Write-Host ''
    Write-Host '  补充建议（手动配置）：'
    Write-Host '  - 添加自定义字段 Phase / Type / Priority / Estimate / Actual'
    Write-Host '  - 创建视图：Table / Board by Phase / Board by Status / Roadmap'
    Write-Host '  - 用 Add item → 把 95 个 Issue 批量加入项目'
}

# ============================================================================
# 完成
# ============================================================================
Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host '  🎉 全部完成！' -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host "  仓库 Issues:    https://github.com/$REPO/issues"
Write-Host "  仓库 Milestones: https://github.com/$REPO/milestones"
Write-Host "  Project Board:  https://github.com/users/$OWNER/projects"
Write-Host ''
Write-Host '  下一步建议：'
Write-Host '  1) 打开 Issues 页面，确认 95 个任务都已创建'
Write-Host '  2) 在 Project Board 中关联所有 Issue'
Write-Host '  3) 把 T1.1 拖到 In Progress 开始第一周冲刺'
