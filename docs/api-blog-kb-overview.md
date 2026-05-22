# API 接口概览 — 博客 (CMS) & 知识库 (KB) 模块

> 本文档汇总了博客发布和知识库相关的所有后端 API 接口、路由、权限及关键文件路径。
> 生成时间：2026-05-22

---

## 一、博客 (CMS) API

路由前缀：`/api/v2/admin/cms`

### 1.1 文章 (Posts)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/cms/posts` | `post:list` | 列表（支持分页、关键词搜索、状态/分类/标签筛选、排序） |
| GET | `/admin/cms/posts/:id` | `post:list` | 获取单篇文章详情 |
| POST | `/admin/cms/posts` | `post:create` | 创建文章，自动处理 slug 唯一性，支持标签和分类关联 |
| PUT | `/admin/cms/posts/:id` | `post:update` | 更新文章 |
| DELETE | `/admin/cms/posts/:id` | `post:delete` | 删除文章（级联删除关联的标签和分类关系） |
| POST | `/admin/cms/posts/:id/publish` | `post:publish` | 发布文章 |
| POST | `/admin/cms/posts/:id/unpublish` | `post:publish` | 取消发布 |

**关键文件**：
- 路由：`server/src/apps/admin/cms/postsRouter.js`
- 控制器：`server/src/apps/admin/cms/postHandlers.js`

**数据模型**：
```javascript
{
  id, title, slug, excerpt, coverImageUrl,
  contentMarkdown, contentHtml, status,
  publishedAt, createdAt, updatedAt
}
```

### 1.2 分类 (Categories)

| 方法 | 路由 | 权限 |
|------|------|------|
| GET | `/admin/cms/categories` | `category:list` |
| POST | `/admin/cms/categories` | `category:create` |
| PUT | `/admin/cms/categories/:id` | `category:update` |
| DELETE | `/admin/cms/categories/:id` | `category:delete` |

**关键文件**：
- 路由：`server/src/apps/admin/cms/categoriesRouter.js`
- 控制器：`server/src/apps/admin/cms/categoryHandlers.js`

### 1.3 标签 (Tags)

| 方法 | 路由 | 权限 |
|------|------|------|
| GET | `/admin/cms/tags` | `tag:list` |
| POST | `/admin/cms/tags` | `tag:create` |
| PUT | `/admin/cms/tags/:id` | `tag:update` |
| DELETE | `/admin/cms/tags/:id` | `tag:delete` |

**关键文件**：
- 路由：`server/src/apps/admin/cms/tagsRouter.js`
- 控制器：`server/src/apps/admin/cms/tagHandlers.js`

### 1.4 导入/导出 (全库)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/cms/export` | `cms:export` | 导出完整数据库备份（links, posts, tags, categories 等） |
| POST | `/admin/cms/import` | `cms:import` | 导入备份数据，支持事务处理 |

**关键文件**：
- 路由：`server/src/apps/admin/cms/cmsRouter.js`
- 控制器：`server/src/apps/admin/cms/cmsHandlers.js`

---

## 二、知识库 (KB) API

路由前缀：`/api/v2/admin/kb`

### 2.1 文档 (Documents)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/kb/documents` | `kb:list` | 文档列表（支持分页、全文搜索、来源/状态/标签/分类/成熟度筛选） |
| POST | `/admin/kb/documents` | `kb:create` | 创建文档，自动计算 checksum 和 word_count，可异步同步到 Open WebUI |
| GET | `/admin/kb/documents/:id` | `kb:list` | 获取文档详情（含 connections 和 sources） |
| PUT | `/admin/kb/documents/:id` | `kb:update` | 更新文档；若已映射到博客文章且 sync_enabled=1，自动同步更新文章 |
| DELETE | `/admin/kb/documents/:id` | `kb:delete` | 删除文档，异步从 Open WebUI 知识库中移除 |
| GET | `/admin/kb/documents/categories` | `kb:list` | 获取所有文档分类列表 |
| GET | `/admin/kb/documents/graph` | `kb:list` | 获取知识图谱数据（节点+边，用于 Cytoscape 可视化） |

**关键文件**：
- 路由：`server/src/apps/admin/kb/documentsRouter.js`
- 控制器：`server/src/apps/admin/kb/documentHandlers.js`

**数据模型**：
```javascript
{
  id, title, slug, excerpt, content_markdown, content_html,
  source, tags, status, category, doc_type, doc_date,
  review_status, word_count, connections, sources,
  original_path, checksum, created_at, updated_at
}
```

### 2.2 画布 (Canvases)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/kb/canvases` | `kb:list` | 画布列表 |
| POST | `/admin/kb/canvases` | `kb:create` | 创建画布 |
| GET | `/admin/kb/canvases/:id` | `kb:list` | 获取画布详情 |
| PUT | `/admin/kb/canvases/:id` | `kb:update` | 更新画布 |
| DELETE | `/admin/kb/canvases/:id` | `kb:delete` | 删除画布 |
| POST | `/admin/kb/canvases/:id/nodes` | `kb:update` | 添加节点 |
| PUT | `/admin/kb/canvases/:id/nodes/:nid` | `kb:update` | 更新节点 |
| DELETE | `/admin/kb/canvases/:id/nodes/:nid` | `kb:update` | 删除节点 |
| POST | `/admin/kb/canvases/:id/edges` | `kb:update` | 添加边 |
| PUT | `/admin/kb/canvases/:id/edges/:eid` | `kb:update` | 更新边 |
| DELETE | `/admin/kb/canvases/:id/edges/:eid` | `kb:update` | 删除边 |

**关键文件**：
- 路由：`server/src/apps/admin/kb/canvasesRouter.js`
- 控制器：`server/src/apps/admin/kb/canvasHandlers.js`

### 2.3 同步 (Sync)

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/kb/sync/config` | `kb:sync` | 获取同步配置 |
| PUT | `/admin/kb/sync/config` | `kb:sync` | 更新同步配置 |
| POST | `/admin/kb/sync/trigger-import` | `kb:sync` | 触发 Obsidian Vault 导入 |
| POST | `/admin/kb/sync/trigger-export` | `kb:sync` | 触发导出到 Obsidian |
| GET | `/admin/kb/sync/logs` | `kb:sync` | 查看同步日志 |
| GET | `/admin/kb/sync/status` | `kb:sync` | 获取同步状态 |
| POST | `/admin/kb/sync/test-filesystem` | `kb:sync` | 测试文件系统连接 |
| GET | `/admin/kb/sync/remote-files` | `kb:sync` | 获取远程文件列表 |
| GET | `/admin/kb/sync/synced-files` | `kb:sync` | 获取已同步文件列表 |
| DELETE | `/admin/kb/sync/clear` | `kb:sync` | 清除同步数据 |
| GET | `/admin/kb/sync/openwebui-status` | `kb:sync` | Open WebUI 连接状态 |
| GET | `/admin/kb/sync/knowledge-bases` | `kb:sync` | 获取知识库列表 |
| POST | `/admin/kb/sync/openwebui-sync` | `kb:sync` | 同步到 Open WebUI 向量库 |
| POST | `/admin/kb/sync/openwebui-test` | `kb:sync` | 测试 Open WebUI 连接 |
| GET | `/admin/kb/sync/openwebui-progress` | `kb:sync` | 获取同步进度 |
| POST | `/admin/kb/sync/openwebui-import` | `kb:sync` | 从 Open WebUI 导入 |
| POST | `/admin/kb/sync/notes-sync` | `kb:sync` | Notes 双向同步 |
| GET | `/admin/kb/sync/notes-test` | `kb:sync` | 测试 Notes 连接 |

**关键文件**：
- 路由：`server/src/apps/admin/kb/syncRouter.js`
- 控制器：`server/src/apps/admin/kb/syncHandlers.js`
- 同步引擎：`server/src/apps/admin/kb/syncEngine.js`
- Open WebUI 服务：`server/src/services/kbSync.js`

### 2.4 AI 工作台

| 模块 | 路由 | 权限 | 说明 |
|------|------|------|------|
| **AI 模型** | `/admin/kb/models` | `kb:*` | 模型配置 CRUD、测试连接 |
| **AI 对话** | `/admin/kb/conversations` | `kb:*` | 对话管理；支持 SSE 流式输出 (`/messages/stream`)；保存到 KB |
| **任务看板** | `/admin/kb/tasks` | `kb:*` | 任务 CRUD（todo / in_progress / done） |
| **提示词模板** | `/admin/kb/templates` | `kb:*` | 模板 CRUD，支持变量替换 |
| **网络搜索** | `/admin/kb/search` | `kb:list` | 搜索配置（DuckDuckGo 等）和搜索执行 |

**关键文件**：
- 模型路由：`server/src/apps/admin/kb/modelsRouter.js`
- 对话路由：`server/src/apps/admin/kb/conversationsRouter.js`
- 任务路由：`server/src/apps/admin/kb/tasksRouter.js`
- 模板路由：`server/src/apps/admin/kb/templatesRouter.js`
- 搜索路由：`server/src/apps/admin/kb/webSearchRouter.js`

---

## 三、发布 (Publish) 功能 — KB → Blog

路由前缀：`/api/v2/admin/kb`

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| POST | `/documents/:id/preview` | `kb:list` | 预览文档渲染后的 HTML |
| POST | `/documents/:id/publish` | `kb:publish` | **将 KB 文档发布为博客文章**（支持创建新文章或更新已有文章） |
| GET | `/document-posts` | `kb:list` | 列出文档-文章映射关系 |
| PUT | `/document-posts/:id` | `kb:publish` | 更新映射关系（如 sync_enabled） |
| DELETE | `/document-posts/:id` | `kb:publish` | 删除映射关系 |

**关键文件**：
- 路由：`server/src/apps/admin/kb/publishRouter.js`
- 控制器：`server/src/apps/admin/kb/publishHandlers.js`
- 前端发布对话框：`admin/src/components/kb/publish/PublishDialog.vue`

**发布逻辑要点**：
- 将 KB 文档的 Markdown 内容渲染为 HTML 后写入博客文章
- 可选择立即发布或保存为草稿
- 支持自动同步开关 (`syncEnabled`)：KB 文档更新时自动同步更新博客文章

---

## 四、外部发布 API

路由前缀：`/api/v2/publish`（需 API Key 认证）

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/publish/blog` | 通过 API Key 发布博客文章（自动创建标签和分类） |
| POST | `/publish/kb` | 通过 API Key 发布 KB 文档 |

### 前台 Agent API

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/agent/publish` | 代理发布文章 |
| POST | `/api/agent/sync-categories` | 同步分类 |
| POST | `/api/agent/sync-tags` | 同步标签 |

**关键文件**：
- 发布路由：`server/src/apps/publishApi.js`
- 发布控制器：`server/src/apps/admin/kb/publishApiHandlers.js`
- API Key 中间件：`server/src/middleware/publishApiKey.js`

---

## 五、数据库表关联

```
posts (博客文章)
  ↑
  |  1:N
  |
kb_document_posts (映射表：document_id, post_id, sync_enabled, last_synced_at)
  |
  |  N:1
  ↓
kb_documents (知识库文档)
```

### 5.1 博客相关表

| 表名 | 说明 |
|------|------|
| `posts` | 文章主表 |
| `tags` | 标签表 |
| `post_tags` | 文章-标签关联表 |
| `categories` | 分类表 |
| `post_categories` | 文章-分类关联表 |
| `external_links` | 外部链接表 |

### 5.2 知识库相关表

| 表名 | 说明 |
|------|------|
| `kb_documents` | KB 文档主表（含 doc_type, review_status, connections 等扩展字段） |
| `kb_document_posts` | 文档-文章映射表（支持双向同步） |
| `kb_canvases` | 画布主表 |
| `kb_canvas_nodes` | 画布节点表 |
| `kb_canvas_edges` | 画布边表 |
| `kb_sync_config` | 同步配置表 |
| `kb_sync_logs` | 同步日志表 |
| `kb_model_config` | AI 模型配置表 |
| `kb_conversations` | AI 对话表 |
| `kb_conversation_branches` | 对话分支表 |
| `kb_tasks` | 任务看板表 |
| `kb_prompt_templates` | 提示词模板表 |
| `kb_web_search_config` | 网络搜索配置表 |

---

## 六、权限体系

### 6.1 RBAC 权限定义 (`server/src/seeds/rbacSeed.js`)

| 权限代码 | 资源 | 操作 | 说明 |
|---------|------|------|------|
| `post:list` | post | list | 查看文章 |
| `post:create` | post | create | 创建文章 |
| `post:update` | post | update | 编辑文章 |
| `post:delete` | post | delete | 删除文章 |
| `post:publish` | post | publish | 发布/取消发布文章 |
| `category:list` | category | list | 查看分类 |
| `category:create` | category | create | 创建分类 |
| `category:update` | category | update | 编辑分类 |
| `category:delete` | category | delete | 删除分类 |
| `tag:list` | tag | list | 查看标签 |
| `tag:create` | tag | create | 创建标签 |
| `tag:update` | tag | update | 编辑标签 |
| `tag:delete` | tag | delete | 删除标签 |
| `cms:export` | cms | export | 导出 CMS 数据 |
| `cms:import` | cms | import | 导入 CMS 数据 |
| `kb:list` | kb | list | 查看知识库 |
| `kb:create` | kb | create | 创建知识库内容 |
| `kb:update` | kb | update | 编辑知识库内容 |
| `kb:delete` | kb | delete | 删除知识库内容 |
| `kb:sync` | kb | sync | 同步 Obsidian / Open WebUI |
| `kb:publish` | kb | publish | 发布到博客 |

### 6.2 超级管理员

- `is_super_admin = 1` 的用户绕过所有 RBAC 检查。
- 前端通过 `user.isSuperAdmin` 或权限码集合判断。

---

## 七、前端路由与页面

### 7.1 管理后台路由 (`admin/src/router/index.ts`)

| 路径 | 名称 | 所需权限 |
|------|------|---------|
| `/cms/posts` | 文章管理 | `post:list` |
| `/cms/categories` | 分类管理 | `category:list` |
| `/cms/tags` | 标签管理 | `tag:list` |
| `/cms/kb/documents` | 知识库文档 | `kb:list` |
| `/cms/kb/documents/new` | 新建文档 | `kb:create` |
| `/cms/kb/documents/:id/edit` | 编辑文档 | `kb:update` |
| `/cms/kb/canvases` | 画布列表 | `kb:list` |
| `/cms/kb/canvases/:id` | 画布编辑器 | `kb:update` |
| `/cms/kb/sync` | 同步管理 | `kb:sync` |
| `/cms/kb/graph` | 知识图谱 | `kb:list` |

### 7.2 前端 API 客户端

- 完整 TypeScript 接口定义：`admin/src/api/kb.ts`
- 包含 Document、Graph、Publish、Canvas、Sync、OpenWebUI、Models、Conversations、Tasks、Templates、WebSearch 等模块。

---

## 八、关键服务与工具

| 文件 | 说明 |
|------|------|
| `server/src/services/kbSync.js` | Open WebUI 同步服务：将 KB 文档同步到 Chroma 向量库，支持全量/增量/删除同步 |
| `server/src/apps/admin/kb/syncEngine.js` | 文件系统同步引擎：扫描 Obsidian Vault、解析 YAML front matter、处理冲突策略 |
| `server/src/jobs/kbSync.js` | 定时同步任务（cron） |
| `server/src/middleware/jwtAuth.js` | JWT Access Token 校验，挂载 `req.user` |
| `server/src/middleware/rbac.js` | `requirePermission(code)` 工厂函数，超级管理员 bypass |

---

## 九、参考文档

- [CLAUDE.md](../../CLAUDE.md) — 项目整体架构和开发规范
- [docs/07-phase2-cms-backend-plan.md](07-phase2-cms-backend-plan.md) — CMS 后端实现计划
- [docs/open-webui-integration.md](open-webui-integration.md) — Open WebUI 集成说明
