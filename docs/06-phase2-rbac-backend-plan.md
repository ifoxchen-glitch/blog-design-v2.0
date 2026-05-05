# Phase 2 §5.1.1 RBAC 后端整片设计

> 本文档配合 [`docs/05-implementation-plan.md`](./05-implementation-plan.md) §5.1.1 中的 T2.2 ~ T2.7。
>
> 给 Claude Code 执行用。每节末有 **"提交检查清单"**——按那个跑就能合 PR、关 Issue。
>
> 文件路径全部基于 T2.1 已经定下来的约定：`server/src/apps/admin/<domain>/<file>.js`，handler + router 两层（不另起 service 层）。
>
> 完成时间：2026-05-?? 起，预计 14h（按计划估时合计），可拆 6 个 PR。

---

## 0. 前置：T2.1 留下的两个洞，一起在 T2.2 PR 里补

### 0.1 权限种子缺 `user:update` / `user:delete`

T2.1 的 `usersRouter.js` 第 11、12 行用了 `user:update` 和 `user:delete`，但 `seeds/rbacSeed.js` 的 12 条权限里没有。导致除超管外，所有人调用 `PUT /users/:id` 和 `DELETE /users/:id` 都会 403——因为 `permissions` 表里**根本没有**这两条 code，再赋权也赋不进去。

**修复**：在 `server/src/seeds/rbacSeed.js` 的 `PERMISSIONS` 数组追加 2 条（紧跟 `user:create` 之后）：

```js
{ code: "user:update",    resource: "user",      action: "update",    name: "更新用户",       description: "修改后台用户资料 / 状态" },
{ code: "user:delete",    resource: "user",      action: "delete",    name: "删除用户",       description: "永久删除后台用户" },
```

并把 `super_admin` 角色的 `permissions: "*"` 自动覆盖（已经是了）；`content_admin` / `viewer` 不动（他们本来就不该管用户）。

更新后跑 `node server/scripts/check-rbac-seed.js`，需要把 `permissions = 12` 改成 `= 14`，同时 `super_admin bound to all 12` 改成 `= 14`。文件位置：`server/scripts/check-rbac-seed.js` 第 18、44 行附近。

### 0.2 `role:assign` 在 T2.3~T2.5 全程复用

为避免权限码爆炸，T2.3（角色 CRUD）、T2.4（角色分配权限）、T2.5（权限列表 + 编辑）**全部复用 `role:assign`**——粗粒度，但和架构文档 §7.3 一致。后续如果需要细化（比如分出 `role:create` 和 `role:list`），再走"权限模型扩展"的单独 issue，不在 Phase 2 阶段做。

### 0.3 `menu:manage` 在 T2.6 全程复用

同上，T2.6 的菜单 CRUD + 排序 全部用 `menu:manage`。

---

## 1. 总体节奏 & 依赖图

```
0. seed 修复 + verify 脚本断言更新
   ↓
T2.2 PUT users/:id/roles         (1h)  ┐
                                       │
T2.3 角色 CRUD                    (3h) ┼─ 任意顺序，互不依赖
                                       │
T2.5 权限列表 + 编辑              (2h) ┘
   ↓
T2.4 PUT roles/:id/permissions   (1h)  ← 依赖 T2.3 的 role 详情结构
   ↓
T2.6 菜单 CRUD + 拖拽排序        (4h)
   ↓
T2.7 审计日志中间件               (3h)  ← 写在最后，全局挂载，回头补 T2.1~T2.6 的写操作
```

**建议合并节奏**：每个任务一个 PR，6 PR 全程，各自 `Closes #<n>`。Issue 编号映射：T2.N → #(4 + 26 + N) → T2.2=#32, T2.3=#33, T2.4=#34, T2.5=#35, T2.6=#36, T2.7=#37。

---

## 2. T2.2 — 用户分配角色 API

**Issue**: #32 / **估时**：1h / **依赖**：T2.1 已合并

### 2.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `PUT` | `/api/v2/admin/rbac/users/:id/roles` | `role:assign` |

**请求体**：
```json
{ "role_ids": [1, 3, 5] }
```

**成功响应**（200）：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "userId": 12,
    "roles": [
      { "id": 1, "code": "super_admin", "name": "超级管理员" },
      { "id": 3, "code": "content_admin", "name": "内容管理员" }
    ]
  }
}
```

### 2.2 边界与拒绝条件

| 情形 | 状态码 | message |
|---|---|---|
| `:id` 非整数 / 无对应用户 | 404 | `"User not found"` |
| 目标用户 `is_super_admin = 1` | 403 | `"Cannot modify super admin roles"` |
| body 不是 `{ role_ids: number[] }` | 400 | `"role_ids must be an array of integers"` |
| `role_ids` 内含未知 / disabled role | **静默忽略**（事务内 join 时被滤掉） | — |
| 空数组 `[]` | 200 | 清空该用户所有角色（合法） |
| 调用者修改自己的角色 | **允许**（与 T2.1 deleteUser 的"不能删自己"对称：删自己破坏性强，分配自己角色风险低） | — |

### 2.3 文件改动

| 文件 | 动作 |
|---|---|
| `server/src/apps/admin/rbac/userHandlers.js` | 追加 `assignRoles(req, res)` 函数；`module.exports` 加上它；`setUserRoles` 已经存在直接复用 |
| `server/src/apps/admin/rbac/usersRouter.js` | 追加 `router.put("/:id/roles", jwtAuth, requirePermission("role:assign"), handlers.assignRoles);` |

### 2.4 实现要点

```js
function assignRoles(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const target = db.prepare("SELECT id, is_super_admin FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ code: 404, message: "User not found" });
  if (target.is_super_admin === 1) {
    return res.status(403).json({ code: 403, message: "Cannot modify super admin roles" });
  }

  const { role_ids } = req.body || {};
  if (!Array.isArray(role_ids) || !role_ids.every((x) => Number.isFinite(Number(x)))) {
    return res.status(400).json({ code: 400, message: "role_ids must be an array of integers" });
  }

  setUserRoles(db, id, role_ids);
  const roles = listUserRoles(db, id);
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { userId: id, roles },
  });
}
```

### 2.5 提交检查清单

- [ ] `server/src/apps/admin/rbac/userHandlers.js` 新增 `assignRoles` 并导出
- [ ] `server/src/apps/admin/rbac/usersRouter.js` 新增路由
- [ ] **手动冒烟**（`npm run dev` 起 3000 端口后）：
  ```bash
  # 用超管 token，先 login 拿 token，再：
  curl -X PUT http://localhost:3000/api/v2/admin/rbac/users/2/roles \
    -H "Authorization: Bearer <ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"role_ids":[2,3]}'
  ```
- [ ] commit + PR + `Closes #32` + merge

---

## 3. T2.3 — 角色管理 API（CRUD + 列表）

**Issue**: #33 / **估时**：3h / **依赖**：T2.1

### 3.1 接口

| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| `GET` | `/api/v2/admin/rbac/roles` | `role:assign` | 列表（无分页，整张返回；< 100 条） |
| `GET` | `/api/v2/admin/rbac/roles/:id` | `role:assign` | 详情 + 权限列表 |
| `POST` | `/api/v2/admin/rbac/roles` | `role:assign` | 创建 |
| `PUT` | `/api/v2/admin/rbac/roles/:id` | `role:assign` | 更新（**code 不可改**） |
| `DELETE` | `/api/v2/admin/rbac/roles/:id` | `role:assign` | 删除（**带使用检查**） |

### 3.2 数据形状

**列表响应**（200）：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1, "code": "super_admin", "name": "超级管理员",
        "description": "...", "status": "active",
        "userCount": 1, "permissionCount": 14,
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 3
  }
}
```

`userCount` / `permissionCount` 用 LEFT JOIN 子查询一次拿出来，不要 N+1。

**详情响应**（200）：
```json
{
  "code": 200,
  "data": {
    "id": 2,
    "code": "content_admin",
    "name": "内容管理员",
    "description": "...",
    "status": "active",
    "permissions": [
      { "id": 1, "code": "post:list", "resource": "post", "action": "list", "name": "查看文章列表" },
      { "id": 2, "code": "post:create", ... }
    ],
    "userCount": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**创建请求体**：
```json
{
  "code": "junior_editor",
  "name": "初级编辑",
  "description": "可写文章但不能发布",
  "status": "active"
}
```

`code` 必填、唯一、`/^[a-z][a-z0-9_]{1,31}$/`。`name` 必填、长度 1~32。`description` 可选。`status` 可选，默认 `active`。

**更新请求体**（PUT）：
```json
{ "name": "...", "description": "...", "status": "disabled" }
```
**code 字段忽略**（即便客户端传了，也不更新；返回 400 提示也行——选个一致风格）。

### 3.3 边界与拒绝

| 情形 | 状态码 | message |
|---|---|---|
| `code` 已存在（创建） | 409 | `"Role code already exists"` |
| `code` 格式不合法 | 400 | `"Invalid role code"` |
| `:id` 不存在 | 404 | `"Role not found"` |
| 删除内置角色（`code` ∈ `super_admin`/`content_admin`/`viewer`） | 403 | `"Cannot delete built-in role"` |
| 删除时仍有用户使用该角色（`COUNT(user_roles WHERE role_id) > 0`） | 409 | `"Role is still assigned to N users"` |
| 改 `code` | 忽略字段，返回 200 | （由前端确保 disabled） |
| 改内置角色的 `status` | **允许**（用户自愿禁用 super_admin 是另一种事故，但允许，由前端再三确认） | — |

### 3.4 文件清单

```
server/src/apps/admin/rbac/
├── roleHandlers.js   ← 新增（list, get, create, update, delete）
└── rolesRouter.js    ← 新增
```

`adminApp.js` 加挂载：
```js
const rolesRouter = require("./admin/rbac/rolesRouter");
v2Router.use("/admin/rbac/roles", rolesRouter);
```

### 3.5 提交检查清单

- [ ] 5 个 endpoint 全部实现，code/name 校验完整
- [ ] 删除前 user_roles 引用计数检查
- [ ] 内置 3 个角色不可删（按 code 判断）
- [ ] 列表带 `userCount` / `permissionCount`，无 N+1
- [ ] adminApp.js 挂上新路由
- [ ] 冒烟跑通：list / create / get / update / delete
- [ ] commit + PR + `Closes #33` + merge

---

## 4. T2.4 — 角色分配权限 API

**Issue**: #34 / **估时**：1h / **依赖**：T2.3 已合并

### 4.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `PUT` | `/api/v2/admin/rbac/roles/:id/permissions` | `role:assign` |

**请求体**：
```json
{ "permission_ids": [1, 2, 5, 8] }
```

**响应**（200）：
```json
{
  "code": 200,
  "data": {
    "roleId": 2,
    "permissions": [
      { "id": 1, "code": "post:list", "resource": "post", "name": "..." },
      ...
    ]
  }
}
```

### 4.2 边界

| 情形 | 状态码 | message |
|---|---|---|
| `:id` 不存在 | 404 | `"Role not found"` |
| 目标是 `super_admin` 角色 | 403 | `"Cannot modify super_admin permissions"`（理由：架构定义超管靠 `is_super_admin` 跳过 RBAC，绑定关系仅做可读审计，不允许通过这个接口绕过） |
| `permission_ids` 不是整数数组 | 400 | `"permission_ids must be an array of integers"` |
| `permission_ids` 中含未知 id | 静默忽略 | — |
| 空数组 | 200 | 清空该角色所有权限（合法但角色变废） |

### 4.3 实现位置

放在 `roleHandlers.js`（不另起文件）。新增 `assignPermissions(req, res)`，导出后在 `rolesRouter.js` 挂：

```js
router.put("/:id/permissions", jwtAuth, requirePermission("role:assign"), handlers.assignPermissions);
```

### 4.4 实时性

`middleware/rbac.js` 每次请求都查 DB（无内存缓存），所以权限变更立即对所有持有 token 的用户生效。**不需要踢出 / 强制重新登录**。

### 4.5 提交检查清单

- [ ] handler + router 都改了
- [ ] 超管角色保护 403 测过
- [ ] 冒烟：先把 `viewer` 多分一个 `post:create`，登录 viewer 用户验证能创建文章
- [ ] commit + PR + `Closes #34` + merge

---

## 5. T2.5 — 权限管理 API

**Issue**: #35 / **估时**：2h / **依赖**：T2.1

### 5.1 接口

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| `GET` | `/api/v2/admin/rbac/permissions` | `role:assign` | 列表，**返回 flat 数组 + 自带 `resource` 字段**，分组让前端做 |
| `PUT` | `/api/v2/admin/rbac/permissions/:id` | `role:assign` | 更新 `name` / `description` |

**故意不做 POST / DELETE**——permission code 是系统级，靠 seed 维护。

### 5.2 列表响应

```json
{
  "code": 200,
  "data": {
    "items": [
      { "id": 1, "code": "post:list", "resource": "post", "action": "list", "name": "查看文章列表", "description": "..." },
      ...
    ],
    "total": 14
  }
}
```

**支持可选 query**：`?resource=post`（按资源筛选）。

### 5.3 更新请求体

```json
{ "name": "新的中文名称", "description": "新描述" }
```

`code`、`resource`、`action` **任何字段都不可改**——客户端传了忽略。

### 5.4 文件清单

```
server/src/apps/admin/rbac/
├── permissionHandlers.js  ← 新增
└── permissionsRouter.js   ← 新增
```

`adminApp.js` 挂载：
```js
v2Router.use("/admin/rbac/permissions", permissionsRouter);
```

### 5.5 提交检查清单

- [ ] list 支持 `?resource=` 筛选
- [ ] update 只动 name/description，其他字段保护
- [ ] adminApp 挂上
- [ ] commit + PR + `Closes #35` + merge

---

## 6. T2.6 — 菜单管理 API（CRUD + 树形 + 拖拽排序）

**Issue**: #36 / **估时**：4h / **依赖**：T2.1

### 6.1 接口

| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| `GET` | `/api/v2/admin/rbac/menus` | `menu:manage` | 全树（不按权限过滤；管理后台需要看全） |
| `GET` | `/api/v2/admin/rbac/menus/:id` | `menu:manage` | 单节点详情 |
| `POST` | `/api/v2/admin/rbac/menus` | `menu:manage` | 新建 |
| `PUT` | `/api/v2/admin/rbac/menus/:id` | `menu:manage` | 更新 |
| `DELETE` | `/api/v2/admin/rbac/menus/:id` | `menu:manage` | 删除（默认拒绝带子节点；`?cascade=true` 强制） |
| `POST` | `/api/v2/admin/rbac/menus/reorder` | `menu:manage` | 批量调整 parent_id + sort_order |

**注意** 这个 GET 全树**不等于** `/api/v2/auth/menus`（后者按用户权限过滤、用于侧边栏渲染）。

### 6.2 树形响应

```json
{
  "data": {
    "tree": [
      {
        "id": 1, "name": "仪表盘", "path": "/cms/dashboard",
        "icon": "DashboardOutline", "permission_code": null,
        "sort_order": 1, "status": "active",
        "children": []
      },
      {
        "id": 2, "name": "博客管理", "path": null, "icon": "DocumentTextOutline",
        "permission_code": "post:list", "sort_order": 2, "status": "active",
        "children": [
          { "id": 3, "name": "文章", "path": "/cms/posts", "permission_code": "post:list", "sort_order": 1, "children": [] },
          ...
        ]
      }
    ]
  }
}
```

服务端组装树（一次 SQL 拿全表，内存递归 build）。子项按 `sort_order` 升序。

### 6.3 创建请求体

```json
{
  "parent_id": null,
  "name": "新节点",
  "path": "/cms/foo",
  "icon": "Cube",
  "permission_code": "post:list",
  "sort_order": 99,
  "status": "active"
}
```

### 6.4 reorder 请求体

```json
{
  "items": [
    { "id": 3, "parent_id": 2, "sort_order": 1 },
    { "id": 4, "parent_id": 2, "sort_order": 2 },
    { "id": 5, "parent_id": 2, "sort_order": 3 }
  ]
}
```

事务里逐条 UPDATE，一致性保证。

### 6.5 边界与拒绝

| 情形 | 状态码 | message |
|---|---|---|
| `parent_id` 指向自己 / 子孙（环） | 400 | `"parent_id forms a cycle"` |
| `parent_id` 不存在 | 400 | `"Parent menu not found"` |
| 删除节点有子节点（且未带 `?cascade=true`） | 409 | `"Menu has N children. Pass cascade=true to delete recursively"` |
| `permission_code` 在 permissions 表里不存在 | **警告但允许**（理由：可能是预留位） — 不挂 FK | — |
| `path` 重复 | **允许**（同一路径多个菜单是合法的，比如不同角色的快捷入口） | — |

### 6.6 环检测算法

更新或新建时，如果 `parent_id != null && parent_id != id`：从 `parent_id` 顺着 `parent_id` 链上溯，看是否会遇到自己。链长 ≤ 5 层，O(5) 性能不是问题。代码骨架：

```js
function wouldFormCycle(db, currentId, targetParentId) {
  if (!targetParentId) return false;
  if (currentId === targetParentId) return true;
  let p = targetParentId;
  for (let i = 0; i < 20; i++) {
    const row = db.prepare("SELECT parent_id FROM menus WHERE id = ?").get(p);
    if (!row) return false;
    if (!row.parent_id) return false;
    if (row.parent_id === currentId) return true;
    p = row.parent_id;
  }
  return true; // safety: 超过 20 层认为环
}
```

### 6.7 文件清单

```
server/src/apps/admin/rbac/
├── menuHandlers.js  ← list, get, create, update, delete, reorder
└── menusRouter.js
```

挂载：`v2Router.use("/admin/rbac/menus", menusRouter);`

### 6.8 提交检查清单

- [ ] 6 个 endpoint 全实现
- [ ] 树形组装正确（内存递归，sort 升序）
- [ ] 环检测覆盖"指向自己"和"指向子孙"两种情况
- [ ] reorder 走事务
- [ ] 删除带子节点拒绝逻辑 + cascade 路径
- [ ] 冒烟：调用 `/api/v2/auth/menus` 看现有用户的侧边栏菜单变化
- [ ] commit + PR + `Closes #36` + merge

---

## 7. T2.7 — 审计日志中间件

**Issue**: #37 / **估时**：3h / **依赖**：T2.2~T2.6 全部合并（最后做，统一覆盖）

### 7.1 设计目标

**自动**捕获 `/api/v2/admin/**` 下所有 **POST / PUT / DELETE** 请求，无论成败，写入 `audit_logs` 表。

不需要每个 handler 显式调用——靠中间件 + `res.on('finish')`。

### 7.2 文件位置

```
server/src/middleware/auditLogger.js
```

挂载：`adminApp.js` 在所有路由之前 `app.use(auditLogger())`，但要在 `express.json` 之后（要读 body）。

### 7.3 字段提取规则

| audit_logs 字段 | 来源 |
|---|---|
| `user_id` | `req.user?.userId`（可为 null —— 比如 login 失败前没 req.user） |
| `username` | `req.user?.username || (req.body?.username 仅 login 接口) || null` |
| `action` | `req.method.toLowerCase()`（`post`/`put`/`delete`/`patch`） |
| `resource_type` | 从路径推断：`/api/v2/admin/rbac/users/:id` → `user`；`/api/v2/admin/rbac/roles/:id/permissions` → `role`；`/api/v2/admin/rbac/menus` → `menu`；规则在下面 |
| `resource_id` | `req.params.id || null`（顶层资源 id；嵌套子资源不另记） |
| `detail` | `JSON.stringify({ status: res.statusCode, body: sanitizeBody(req.body), query: req.query })` |
| `ip` | `req.ip` |
| `user_agent` | `req.headers["user-agent"] || ""` |
| `created_at` | `nowIso()` |

### 7.4 resource_type 推断

正则 `/api/v2/admin/(?<group>[^/]+)/(?<resource>[^/]+)`：
- group = `auth` / `cms` / `rbac` / `ops` / `analytics`
- resource = `users` / `roles` / `permissions` / `menus` / `posts` / `tags` / ...

`resource_type = singularize(resource)`：去尾 `s`（`users` → `user`，`menus` → `menu`，`tags` → `tag`，`posts` → `post`）。如果没匹配上，用 `req.path` 作 fallback。

### 7.5 sanitizeBody（很重要）

**永远不要把密码 / token 写进 audit_logs**。屏蔽字段：

```js
const SENSITIVE_FIELDS = ["password", "new_password", "old_password", "password_hash", "token", "refresh_token", "access_token", "secret"];

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.includes(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
```

### 7.6 跳过路径

| 路径 | 原因 |
|---|---|
| `GET *` | 读不审计 |
| `POST /api/v2/auth/refresh` | 高频自动调用，会刷屏 |
| `OPTIONS *` | CORS 预检 |
| `/health` | 健康检查 |

### 7.7 实现骨架

```js
const { openDb } = require("../db");
const { nowIso } = require("../utils");

const SENSITIVE_FIELDS = [...];
const SKIP_PATHS = [/^\/health/, /^\/api\/v2\/auth\/refresh$/];

function sanitizeBody(body) { /* ... */ }
function inferResourceType(path) { /* 正则 + singularize */ }

function auditLogger() {
  return function (req, res, next) {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "OPTIONS" || method === "HEAD") return next();
    if (SKIP_PATHS.some((re) => re.test(req.path))) return next();

    const startedAt = Date.now();
    const captureBody = req.body ? JSON.parse(JSON.stringify(req.body)) : null;

    res.on("finish", () => {
      try {
        const db = openDb();
        db.prepare(`
          INSERT INTO audit_logs
            (user_id, username, action, resource_type, resource_id, detail, ip, user_agent, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user?.userId || null,
          req.user?.username || (req.path.endsWith("/auth/login") ? captureBody?.email : null) || null,
          method.toLowerCase(),
          inferResourceType(req.path),
          req.params?.id || null,
          JSON.stringify({
            status: res.statusCode,
            body: sanitizeBody(captureBody),
            query: req.query,
            durationMs: Date.now() - startedAt,
          }),
          req.ip || null,
          req.headers["user-agent"] || null,
          nowIso(),
        );
      } catch (err) {
        // 审计日志失败不能影响主流程，吞掉只 console.error
        console.error("[auditLogger] write failed:", err.message);
      }
    });

    next();
  };
}

module.exports = auditLogger;
```

### 7.8 挂载位置（adminApp.js）

```js
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(auditLogger());          // ← 在 body parser 之后，路由之前

app.get("/health", ...);
app.use("/api/v2", v2Router);
```

### 7.9 验证脚本

写一个 `server/scripts/check-audit-log.js`：
1. 直接打开 db
2. 取 `audit_logs` 最近 10 条
3. 打印 user_id / action / resource_type / status 一栏

帮你冒烟时检查写入对不对。

### 7.10 提交检查清单

- [ ] `middleware/auditLogger.js` 写完
- [ ] `adminApp.js` 在 body parser 之后路由之前挂上
- [ ] sanitizeBody 覆盖所有敏感字段
- [ ] SKIP_PATHS 至少包含 refresh、health
- [ ] 写入失败必须吞错，不能让请求挂掉
- [ ] 冒烟：发一个 `PUT /users/2/roles`，去 audit_logs 看是否有一条 `action='put', resource_type='user', resource_id='2', body 不含密码`
- [ ] 冒烟（边界）：发一个 `POST /auth/login` 失败，应记录但 password 字段 = `[REDACTED]`
- [ ] commit + PR + `Closes #37` + merge

---

## 8. 共用约定（已经在 T2.1 落定，全部沿用）

### 8.1 响应格式

```json
{ "code": 200, "message": "success", "data": { ... } }
{ "code": 400, "message": "Invalid id" }
{ "code": 404, "message": "User not found" }
```

`code` **就是 HTTP status code**（不是业务码）。message 是英文短句。data 仅成功时存在。

### 8.2 命名约定

| 位置 | 风格 | 例子 |
|---|---|---|
| DB 列名（v2 表） | `snake_case` | `is_super_admin`, `permission_code` |
| 请求 body 字段 | `snake_case`（与 DB 对齐） | `role_ids`, `parent_id` |
| 响应 body 字段 | `camelCase` | `roleIds`, `parentId` —— **注意**：T2.1 的实际响应里既有 camelCase（`displayName`）又有 snake_case（`permission_code`），这是 T2.1 留下的不一致。整个 Phase 2 沿用 T2.1 的具体输出形态——不强行重写。新接口的响应字段统一选择 **跟 T2.1 同字段同名**，新增字段用 `camelCase`。 |

### 8.3 文件结构（每个域 2 个文件）

```
apps/admin/<group>/<resource>Handlers.js    ← 业务 + DB 直接交互
apps/admin/<group>/<resource>sRouter.js     ← 路由 + 中间件
```

### 8.4 错误码

| 状态 | 用途 |
|---|---|
| 200 | 正常返回 |
| 201 | 创建成功 |
| 400 | 入参格式错 |
| 401 | 未鉴权（jwtAuth 兜底） |
| 403 | 鉴权了但权限不够 / 业务规则拒绝（如不能删超管） |
| 404 | 资源不存在 |
| 409 | 冲突（如 code 重复、删除被引用资源） |
| 500 | 兜底（不主动用） |

---

## 9. 给 Claude Code 的快速接入提示

把下面整段贴到 Claude Code 的第一条消息：

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.1.1 RBAC 后端整片。完整设计文档在：
docs/06-phase2-rbac-backend-plan.md

按文档的"总体节奏"顺序推进：
1. 先做 §0 修复（seed 加 user:update / user:delete + check-rbac-seed.js 断言改 14）
2. 然后 T2.2 → T2.3 → T2.5 → T2.4 → T2.6 → T2.7（每个 PR 一个 issue）

每个任务完成步骤：
- 写代码（按文档的"文件改动"清单）
- 跑冒烟（curl 或 Postman）
- 跑 verifier 脚本（如有）
- commit message 末行 Closes #<issue>
- gh pr create + gh pr merge --merge --delete-branch

不用每步问我。常用 node / git / gh / npm 全自动。只有 push --force / 删 db 文件 / 改 main 才停下来。

目标：6 个 PR 跑完。中途如果遇到文档里没写到的边界情况，按现有 T2.1 风格选最不破坏现状的方案，提个 TODO 注释，PR 里说明就行。

Phase 2 §5.1.1 全部合并后告诉我，回 Cowork 复盘 + 进 §5.1.2 博客 CMS 后端规划。
```

---

## 10. 后续衔接（不在本文档范围）

- **§5.1.2 博客 CMS 后端**（T2.8 ~ T2.15）：8 任务，预计 14h——文章 / 标签 / 分类 / 友链 / 媒体上传 / 导入导出。逻辑和现有 `frontApp.js` 里的旧 `/api/admin/*` 等价，重写为 v2 版本。
- **§5.1.3 通用前端组件**（T2.16 ~ T2.21）：表格、抽屉、Markdown 编辑器、图片上传 6 个组件，预计 13h。
- **§5.1.4 RBAC 前端 + §5.1.5 博客 CMS 前端**：合计 11 任务，预计 25h。

完成本节后回 Cowork 出 §5.1.2 的整片设计。

---

**写于**：2026-05-XX（Phase 2 启动后回 Cowork 设计）
**作者**：Cowork session 出方案 + Claude Code session 落地
