# 内容模型（字段说明）

供 CMS 或静态生成器对齐；与 [01-audience-and-sitemap.md](01-audience-and-sitemap.md) 决策一致。
实际数据库表结构见 `server/src/db.js`。

## 文章 `Post` (表: `posts`)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | PK | 自增主键 |
| `title` | string | 是 | 标题 |
| `slug` | string | 是 | URL 段，唯一 |
| `excerpt` | string | 否 | 列表摘要 |
| `content` | Markdown | 是 | 正文原始 Markdown |
| `contentHtml` | HTML | 否 | 渲染后的 HTML（懒生成，更新时置 NULL） |
| `cover_image` | URL | 否 | 封面；无则走「无图卡片」布局 |
| `published` | boolean | 否 | 是否发布（默认 false） |
| `featured` | boolean | 否 | 首页置顶 |
| `created_at` | ISO 8601 | 自动 | 创建时间 |
| `updated_at` | ISO 8601 | 自动 | 更新时间 |
| `published_at` | ISO 8601 | 自动 | 发布时间（发布时设置） |

## 分类 `Category` (表: `categories`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `name` | string | 展示名 |
| `slug` | string | URL slug，唯一 |
| `description` | string | 可选，分类页 SEO/副标题 |

## 标签 `Tag` (表: `tags`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `name` | string | 展示名 |
| `slug` | string | URL slug，唯一 |

## 中间表

| 表名 | 字段 | 说明 |
|------|------|------|
| `post_tags` | `post_id`, `tag_id` | 文章-标签多对多 |
| `post_categories` | `post_id`, `category_id` | 文章-分类多对多 |

## 外部链接 `ExternalLink` (表: `external_links`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | PK |
| `title` | string | 链接标题 |
| `url` | string | 链接地址 |
| `description` | string | 可选描述 |
| `icon` | string | 可选图标标识 |
| `sort_order` | integer | 排序权重 |

## 作者 `Author`（多作者时）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 展示名 |
| `bio` | string | 简介 |
| `avatar` | URL | 头像 |
| `social_links` | { label, url }[] | 社交链接 |
