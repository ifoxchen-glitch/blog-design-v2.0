# 内容模型（字段说明）

供 CMS 或静态生成器对齐；与 [01-audience-and-sitemap.md](01-audience-and-sitemap.md) 决策一致。
**实际数据库表结构以 `server/src/db.js` 为准**——本文件仅做摘录与字段语义说明，命名与代码保持一致（camelCase）。

## 文章 `Post` (表: `posts`)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | PK | 自增主键 |
| `title` | string | 是 | 标题 |
| `slug` | string | 是 | URL 段，唯一 |
| `excerpt` | string | 否 | 列表摘要 |
| `contentMarkdown` | Markdown | 是 | 正文原始 Markdown |
| `contentHtml` | HTML | 否 | 渲染后的 HTML（懒生成；更新文章时置 NULL，下次读取时按需渲染） |
| `coverImageUrl` | URL | 否 | 封面；无则走「无图卡片」布局 |
| `status` | enum | 是 | `'draft'` 或 `'published'`（默认 `'draft'`），用于代替布尔 `published` |
| `publishedAt` | ISO 8601 | 自动 | 发布时间（首次发布时设置） |
| `createdAt` | ISO 8601 | 自动 | 创建时间 |
| `updatedAt` | ISO 8601 | 自动 | 更新时间 |

> **未实现**：`featured`（首页置顶）字段尚未落库。早期文档保留过该字段，目前代码未使用。如未来需要"首页置顶"，需在 `posts` 表加 `featured INTEGER DEFAULT 0` 并扩展 `/api/posts` 排序。

## 分类 `Category` (表: `categories`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `name` | string | 展示名（唯一） |
| `slug` | string | URL slug，唯一 |
| `createdAt` | ISO 8601 | 创建时间 |

> 文档以前列出过 `description` 字段，目前未实现；分类页 SEO/副标题如有需要再加。

## 标签 `Tag` (表: `tags`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `name` | string | 展示名（唯一） |
| `slug` | string | URL slug，唯一 |
| `createdAt` | ISO 8601 | 创建时间 |

## 中间表

| 表名 | 字段 | 说明 |
|------|------|------|
| `post_tags` | `postId`, `tagId` | 文章-标签多对多 |
| `post_categories` | `postId`, `categoryId` | 文章-分类多对多 |

## 外部链接 `ExternalLink` (表: `external_links`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `title` | string | 链接标题 |
| `url` | string | 链接地址（仅允许 `http(s)://` 或 `/` 开头，后端 `safeUrl()` 校验） |
| `icon` | string | 可选图标 URL；额外允许 `data:image/...` |
| `iconSize` | enum | `'1x1'` `'2x1'` `'1x2'` `'2x2'`，默认 `'1x1'` |
| `sortOrder` | integer | 排序权重（升序） |
| `createdAt` / `updatedAt` | ISO 8601 | 时间戳 |

## 接口字段约定

### `tags` / `categories` 入参格式

`POST/PUT /api/admin/posts`、`POST /api/agent/publish` 等接口的 `tags` 与 `categories` 字段，
后端 [`splitTags()`](../server/src/utils.js) 同时接受两种格式：

- **字符串**：用英文逗号分隔，例如 `"tech, javascript, web"`
- **数组**：例如 `["tech", "javascript", "web"]`

两种格式都会被 trim 并去掉空项。前端后台表单目前一律使用逗号分隔字符串。

## 作者 `Author`（多作者时）

> 当前未实现，仅作为后续多作者扩展预留。

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 展示名 |
| `bio` | string | 简介 |
| `avatar` | URL | 头像 |
| `social_links` | { label, url }[] | 社交链接 |
