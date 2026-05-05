# Phase 2 §5.1.2 CMS 后端整片设计

> 本文档配合 [`docs/05-implementation-plan.md`](./05-implementation-plan.md) §5.1.2 中的 T2.8 ~ T2.15。
>
> 给 Claude Code 执行用。每节末有 **"提交检查清单"**——按那个跑就能合 PR、关 Issue。
>
> 所有 CMS 接口都挂在 `/api/v2/admin/cms/*`，handler + router 两层（不另起 service 层）。
>
> 旧 API 在 `server/src/apps/frontApp.js` 里（`/api/admin/*` 段），v2 版要求字段、错误码、行为与旧 API **等价**，响应格式统一为 `{ code, message, data }`。
>
> 完成时间：2026-05-05 起，预计 14h（8 个 PR）。

---

## 0. 前置依赖

- **§5.1.1 RBAC 后端已全部合并**（T2.2~T2.7）。
- **权限复用约定**：CMS 模块不新增权限 code（seed 已冻结 14 条）。
  - 文章/标签/分类/友链的读 → `post:list`
  - 文章/标签/分类/友链的写 → `post:create`
  - 文章/标签/分类/友链的改 → `post:update`
  - 文章/标签/分类/友链的删 → `post:delete`
  - 文章发布/下架 → `post:publish`
  - 文件上传 → `post:create`（上传即创建媒体资源）
  - 导入/导出 → `ops:backup`
- **复用现有 db helper**：`db.js` 已暴露 `listTagsForPost`, `setPostTags`, `listCategoriesForPost`, `setPostCategories`, `listTagsForPosts`, `listCategoriesForPosts`。这些在 T2.8 里直接 require 复用，不复制实现。
- **复用现有 utils**：`normalizeSlug`, `splitTags`, `nowIso`, `toInt`。
- **旧表结构不变**：`posts`, `tags`, `post_tags`, `categories`, `post_categories`, `external_links` 都是 legacy 表（camelCase 字段名），不做迁移。

---

## 1. 总体节奏 & 依赖图

```
T2.8 文章 CRUD                    (4h)
   ↓
T2.9 文章发布/下架                (1h)
   ↓
T2.10 标签管理 API（v2）          (2h) ┐
                                      │ 互不依赖，可并列
T2.11 分类管理 API（v2）          (2h) ┘
   ↓
T2.12 友链管理 API（v2）          (2h)
   ↓
T2.13 文件上传 API（v2）          (1h)
   ↓
T2.14 数据导出 API（v2）          (1h)
   ↓
T2.15 数据导入 API（v2）          (1.5h)
```

**建议合并节奏**：每个任务一个 PR，8 PR 全程，各自 `Closes #<n>`。Issue 编号映射：
- T2.8=#38, T2.9=#39, T2.10=#40, T2.11=#41, T2.12=#42, T2.13=#43, T2.14=#44, T2.15=#45

---

## 2. T2.8 — 文章 CRUD API（v2）

**Issue**: #38 / **估时**：4h / **依赖**：T2.1（db helper 已就绪）

### 2.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/api/v2/admin/cms/posts` | `post:list` |
| `GET` | `/api/v2/admin/cms/posts/:id` | `post:list` |
| `POST` | `/api/v2/admin/cms/posts` | `post:create` |
| `PUT` | `/api/v2/admin/cms/posts/:id` | `post:update` |
| `DELETE` | `/api/v2/admin/cms/posts/:id` | `post:delete` |

### 2.2 列表（GET /posts）

**Query 参数**（全部可选）：
- `page` (int, default=1)
- `pageSize` (int, default=20, max=100)
- `keyword` (string) — 搜索 `title`, `excerpt`, `contentMarkdown`
- `status` (string) — `published` / `draft`
- `tagId` (int) — 按标签筛选
- `categoryId` (int) — 按分类筛选
- `sortBy` (string) — `updatedAt` (default) / `createdAt` / `publishedAt`
- `sortOrder` (string) — `desc` (default) / `asc`

**响应**（200）：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "title": "...",
        "slug": "...",
        "excerpt": "...",
        "coverImageUrl": null,
        "status": "published",
        "publishedAt": "2026-01-01T00:00:00.000Z",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z",
        "tags": [{ "id": 1, "name": "Vue" }],
        "categories": [{ "id": 1, "name": "前端" }]
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "counts": { "all": 42, "published": 30, "draft": 12 }
  }
}
```

**实现要点**：
- 关键词搜索：`title LIKE ? OR excerpt LIKE ? OR contentMarkdown LIKE ?`
- tagId / categoryId 筛选：通过 `post_tags` / `post_categories` JOIN 子查询实现
- `counts` 一次性查 3 个 COUNT：all / published / draft（前端状态筛选器用）
- tags / categories 用 `listTagsForPosts(db, postIds)` + `listCategoriesForPosts(db, postIds)` 批量查，禁止 N+1
- 排序字段白名单：`updatedAt`, `createdAt`, `publishedAt`；非法值 fallback 到 `updatedAt DESC`

### 2.3 详情（GET /posts/:id）

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "title": "...",
    "slug": "...",
    "excerpt": "...",
    "coverImageUrl": null,
    "contentMarkdown": "# Hello",
    "contentHtml": null,
    "status": "published",
    "publishedAt": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "tags": [{ "id": 1, "name": "Vue", "slug": "vue" }],
    "categories": [{ "id": 1, "name": "前端", "slug": "frontend" }]
  }
}
```

`contentHtml` 字段直接返回 DB 里的值（旧逻辑是 lazy render，v2 保持同样行为）。

### 2.4 创建（POST /posts）

**请求体**：
```json
{
  "title": "文章标题",
  "slug": "article-slug",
  "excerpt": "摘要",
  "coverImageUrl": "https://...",
  "contentMarkdown": "# Markdown",
  "status": "draft",
  "tags": "Vue, React",
  "categories": "前端"
}
```

- `title` 必填；`slug` 可选，默认从 `title` 生成；`status` 可选，默认 `draft`
- `tags` / `categories` 是逗号分隔字符串（和旧 API 一致），`splitTags` 处理
- `contentHtml` 不写入（保持 NULL，和旧 API 一致）
- slug 唯一冲突 → 409 `"Slug already exists"`
- 成功 201，返回完整 post 对象（含 tags, categories）

### 2.5 更新（PUT /posts/:id）

请求体同创建，但全部可选（partial update）。
- 不传字段 = 保持原值
- 传 `tags` / `categories` = 全量替换关联（和旧 API 一致）
- slug 唯一冲突 → 409
- 404 如果 id 不存在

### 2.6 删除（DELETE /posts/:id）

- 404 如果不存在
- 级联删除 `post_tags` + `post_categories`（FK ON DELETE CASCADE 已配置，直接 DELETE posts 就行）
- 200 返回 `{ deleted: true }`

### 2.7 文件改动

```
server/src/apps/admin/cms/
├── postHandlers.js   ← 新增
└── postsRouter.js    ← 新增
```

`adminApp.js` 挂载：
```js
const postsRouter = require("./admin/cms/postsRouter");
v2Router.use("/admin/cms/posts", postsRouter);
```

### 2.8 提交检查清单

- [ ] list 分页 + keyword + status + tagId + categoryId + sort
- [ ] list 返回 counts { all, published, draft }
- [ ] create/update 处理 tags/categories 全量替换
- [ ] slug 唯一冲突 409
- [ ] delete 404 检查
- [ ] 冒烟：list → create → get → update → delete 跑通
- [ ] commit + PR + `Closes #38` + merge

---

## 3. T2.9 — 文章发布/下架 API（v2）

**Issue**: #39 / **估时**：1h / **依赖**：T2.8

### 3.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `POST` | `/api/v2/admin/cms/posts/:id/publish` | `post:publish` |
| `POST` | `/api/v2/admin/cms/posts/:id/unpublish` | `post:publish` |

### 3.2 行为

- publish：`status='published'`, `publishedAt=nowIso()`, `updatedAt=nowIso()`
- unpublish：`status='draft'`, `updatedAt=nowIso()`（publishedAt 不清零，留作历史记录）
- 404 如果 id 不存在
- 200 返回 `{ id, status, publishedAt, updatedAt }`

### 3.3 文件改动

追加到 `server/src/apps/admin/cms/postsRouter.js`：
```js
router.post("/:id/publish", jwtAuth, requirePermission("post:publish"), handlers.publishPost);
router.post("/:id/unpublish", jwtAuth, requirePermission("post:publish"), handlers.unpublishPost);
```

`postHandlers.js` 追加 `publishPost` / `unpublishPost`。

### 3.4 提交检查清单

- [ ] publish 设置 publishedAt
- [ ] unpublish 不清 publishedAt
- [ ] 404 检查
- [ ] commit + PR + `Closes #39` + merge

---

## 4. T2.10 — 标签管理 API（v2）

**Issue**: #40 / **估时**：2h / **依赖**：T2.8（文章已能关联标签）

### 4.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/api/v2/admin/cms/tags` | `post:list` |
| `GET` | `/api/v2/admin/cms/tags/:id` | `post:list` |
| `POST` | `/api/v2/admin/cms/tags` | `post:create` |
| `PUT` | `/api/v2/admin/cms/tags/:id` | `post:update` |
| `DELETE` | `/api/v2/admin/cms/tags/:id` | `post:delete` |

### 4.2 数据形状

**列表响应**：
```json
{
  "code": 200,
  "data": {
    "items": [
      { "id": 1, "name": "Vue", "slug": "vue", "postCount": 5, "createdAt": "..." }
    ],
    "total": 12
  }
}
```

`postCount` 用子查询 `(SELECT COUNT(*) FROM post_tags WHERE tagId = t.id)`。

**创建请求体**：`{ "name": "Vue" }` —— slug 自动从 name 生成（`normalizeSlug`），冲突时加 `-2`、`-3`... 但 `tags.slug` 有 UNIQUE 约束，最简单的方式是 `INSERT OR IGNORE`，如果冲突就返回 409 `"Tag slug already exists"`。实际上旧 API 没有 tag 独立创建端点，agent API 里是 `INSERT OR IGNORE`。

为了简单和一致性：**slug 由 name 自动生成，唯一冲突时 409**。前端负责 name 去重。

**删除**：DELETE tags 后，FK `ON DELETE CASCADE` 会自动清理 `post_tags`。但 **不** 需要额外检查，直接删即可。

### 4.3 提交检查清单

- [ ] list 带 postCount 子查询
- [ ] create 自动生成 slug，409 冲突
- [ ] delete 级联清理 post_tags（靠 FK）
- [ ] commit + PR + `Closes #40` + merge

---

## 5. T2.11 — 分类管理 API（v2）

**Issue**: #41 / **估时**：2h / **依赖**：T2.8

### 5.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/api/v2/admin/cms/categories` | `post:list` |
| `GET` | `/api/v2/admin/cms/categories/:id` | `post:list` |
| `POST` | `/api/v2/admin/cms/categories` | `post:create` |
| `PUT` | `/api/v2/admin/cms/categories/:id` | `post:update` |
| `DELETE` | `/api/v2/admin/cms/categories/:id` | `post:delete` |

### 5.2 数据形状

同 T2.10，只是把 tag → category。`postCount` 子查询从 `post_categories` 查。

### 5.3 提交检查清单

- [ ] list 带 postCount 子查询
- [ ] create 自动生成 slug，409 冲突
- [ ] delete 级联清理 post_categories（靠 FK）
- [ ] commit + PR + `Closes #41` + merge

---

## 6. T2.12 — 友链管理 API（v2）

**Issue**: #42 / **估时**：2h / **依赖**：无

### 6.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/api/v2/admin/cms/links` | `post:list` |
| `POST` | `/api/v2/admin/cms/links` | `post:create` |
| `PUT` | `/api/v2/admin/cms/links/:id` | `post:update` |
| `DELETE` | `/api/v2/admin/cms/links/:id` | `post:delete` |
| `POST` | `/api/v2/admin/cms/links/reorder` | `post:update` |

### 6.2 数据形状

**列表响应**：
```json
{
  "code": 200,
  "data": {
    "items": [
      { "id": 1, "title": "GitHub", "url": "https://github.com", "icon": "...", "iconSize": "1x1", "sortOrder": 1 }
    ],
    "total": 5
  }
}
```

**字段规则**（沿用旧 API）：
- `title` 必填，默认 "未命名"
- `url` 必填，`safeUrl` 校验（必须以 http/https 开头，或相对路径 `/` 开头）
- `icon` 可选，`safeUrl({ allowDataImage: true })` 校验（支持 data:image）
- `iconSize` 可选，enum `['1x1','2x1','1x2','2x2']`，默认 `'1x1'`
- `sortOrder` 可选，默认 0

**reorder**：
```json
{ "items": [{ "id": 1, "sortOrder": 10 }, { "id": 2, "sortOrder": 20 }] }
```
事务逐条 UPDATE `sortOrder`。

### 6.3 提交检查清单

- [ ] url/icon safeUrl 校验，非法 400
- [ ] iconSize enum 校验
- [ ] reorder 事务
- [ ] commit + PR + `Closes #42` + merge

---

## 7. T2.13 — 文件上传 API（v2）

**Issue**: #43 / **估时**：1h / **依赖**：无

### 7.1 接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `POST` | `/api/v2/admin/cms/upload` | `post:create` |

### 7.2 行为

直接复用旧 multer 配置：`frontApp.js` 里有：
```js
const upload = multer({ storage: multer.diskStorage({ ... }) });
```

v2 版直接 copy 这段配置到 `adminApp.js` 或一个共享模块，然后：
```js
router.post("/", jwtAuth, requirePermission("post:create"), upload.single("image"), handlers.uploadImage);
```

响应：
```json
{ "code": 200, "message": "success", "data": { "url": "/admin-static/uploads/xxx.png" } }
```

注意：multer 放在 `requirePermission` 之后，这样 401/403 不会触发磁盘写入。

### 7.3 文件改动

`server/src/apps/admin/cms/uploadRouter.js` + `uploadHandlers.js`（或直接把 handler 写在 router 里，因为就一个函数）。

`adminApp.js` 挂载：
```js
const uploadRouter = require("./admin/cms/uploadRouter");
v2Router.use("/admin/cms/upload", uploadRouter);
```

### 7.4 提交检查清单

- [ ] multer 配置与旧版等价（destination: `admin-static/uploads/`）
- [ ] 401/403 先拒，multer 后执行（省磁盘）
- [ ] 响应含完整 url
- [ ] commit + PR + `Closes #43` + merge

---

## 8. T2.14 + T2.15 — 数据导出 & 导入 API（v2）

**Issue**: T2.14=#44 / T2.15=#45 / **估时**：2.5h（1h + 1.5h）/ **依赖**：无

建议 **合在一个 PR** 里做（导出 + 导入天然成对），但 commit message 里分别提两句。

### 8.1 导出（GET /api/v2/admin/cms/export）

权限：`ops:backup`

**行为**：和旧 `/api/admin/export` 完全一致——查出 `links`, `posts`, `tags`, `postTags`, `categories`, `postCategories` 全表，打包 JSON：
```json
{
  "code": 200,
  "data": {
    "version": 2,
    "exportedAt": "2026-05-05T...",
    "links": [...],
    "posts": [...],
    "tags": [...],
    "postTags": [...],
    "categories": [...],
    "postCategories": [...]
  }
}
```

### 8.2 导入（POST /api/v2/admin/cms/import）

权限：`ops:backup`

**请求体**：直接接上面的 JSON structure（data 嵌套或顶层都可以，前端传什么看什么）。

**行为**：copy 旧 `/api/admin/import` 逻辑，但注意两点：
1. **先关闭 foreign_keys**，再开事务，最后再打开（旧逻辑已经这样做了）
2. **响应格式改 `{ code, message, data }`**：
   ```json
   { "code": 200, "message": "success", "data": { "imported": true } }
   ```
3. **出错 400/500**，message 写具体原因

### 8.3 文件改动

```
server/src/apps/admin/cms/
├── backupHandlers.js   ← export + import
└── backupRouter.js
```

`adminApp.js` 挂载：
```js
const backupRouter = require("./admin/cms/backupRouter");
v2Router.use("/admin/cms/backup", backupRouter);
```

路由：
```js
router.get("/export", jwtAuth, requirePermission("ops:backup"), handlers.exportData);
router.post("/import", jwtAuth, requirePermission("ops:backup"), handlers.importData);
```

### 8.4 提交检查清单

- [ ] export 全表 JSON 结构与旧 API 等价
- [ ] import 先 `PRAGMA foreign_keys = OFF`，事务，再 `ON`
- [ ] import 出错 400（格式不对）/ 500（SQL 失败）
- [ ] 冒烟：export → 用 export 的 JSON 再 import → 数据一致
- [ ] commit + PR + `Closes #44, closes #45` + merge

---

## 9. 共用约定（全部沿用 T2.1 风格）

### 9.1 响应格式

统一 `{ code: number, message: string, data: any }`。旧 API 用 `{ ok: true }` 或 `{ error: "..." }` 的地方，v2 全改成标准格式。

### 9.2 错误码

| 场景 | code | message |
|---|---|---|
| 缺少必填字段 | 400 | `"Missing required field: title"` |
| slug 已存在 | 409 | `"Slug already exists"` |
| 非法 URL | 400 | `"Invalid URL"` |
| 非法 iconSize | 400 | `"Invalid iconSize"` |
| 资源不存在 | 404 | `"Post not found"` / `"Tag not found"` 等 |
| 无权限 | 403 | `requirePermission` 已处理 |

### 9.3 驼峰字段映射

legacy 表字段是 camelCase（`coverImageUrl`, `contentMarkdown`, `publishedAt`）。v2 API **不做转换**，直接返回 camelCase，前端也按 camelCase 处理。

只有 `created_at` / `updated_at` 在 v2 表里是 snake_case，但 legacy 表是 `createdAt` / `updatedAt`。所以 CMS 模块全部用 **camelCase**。

### 9.4 事务与并发

- create/update/delete 涉及多表（posts + post_tags + post_categories）时，用 `db.transaction()` 包起来。
- SQLite WAL 模式已开，读写并发不需要额外处理。

### 9.5 审计日志

T2.7 的 auditLogger 已经全局挂载，CMS 写操作会自动捕获，不需要额外处理。

---

## 10. 给 Claude Code 的快速接入提示

把下面整段贴到 Claude Code 的第一条消息：

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.1.2 CMS 后端整片。完整设计文档在：
docs/07-phase2-cms-backend-plan.md

按文档的"总体节奏"顺序推进：
T2.8 → T2.9 → T2.10 → T2.11 → T2.12 → T2.13 → T2.14+T2.15（最后两个合一个 PR）

每个任务完成步骤：
- 写代码（按文档的"文件改动"清单）
- 跑冒烟（curl 或 Postman）
- 跑 verifier 脚本（如有）
- commit message 末行 Closes #<issue>
- gh pr create + gh pr merge --merge --delete-branch

不用每步问我。常用 node / git / gh / npm 全自动。只有 push --force / 删 db 文件 / 改 main 才停下来。

目标：8 个 PR 跑完（T2.14+T2.15 合一个）。中途如果遇到文档里没写到的边界情况，按现有 T2.8 风格选最不破坏现状的方案，提个 TODO 注释，PR 里说明就行。

Phase 2 §5.1.2 全部合并后告诉我，回 Cowork 复盘 + 进 §5.1.3 通用前端组件规划。
```

---

## 11. 后续衔接（不在本文档范围）

- **§5.1.3 通用前端组件**（T2.16 ~ T2.21）：6 个组件，预计 13h
- **§5.1.4 RBAC 前端**（T2.22 ~ T2.25）：4 个页面，预计 12h
- **§5.1.5 CMS 前端**（T2.26 ~ T2.32）：7 个页面，预计 17h
- **§5.2 验收**（T2.33 ~ T2.35）：3 个任务，预计 5h

完成 §5.1.2 后回 Cowork 出 §5.1.3 整片设计。

---

**写于**：2026-05-05（Phase 2 §5.1.1 完成后立刻推进 §5.1.2）
**作者**：Cowork session 出方案 + Claude Code session 落地
