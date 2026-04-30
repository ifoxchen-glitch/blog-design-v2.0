# 内容模型（字段说明）

供 CMS 或静态生成器对齐；与 [01-audience-and-sitemap.md](01-audience-and-sitemap.md) 决策一致。

## 文章 `Post`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 标题 |
| `slug` | string | 是 | URL 段，唯一 |
| `published_at` | ISO 8601 | 是 | 发布时间 |
| `excerpt` | string | 否 | 列表摘要 |
| `cover_image` | URL | 否 | 封面；无则走「无图卡片」布局 |
| `body` | Markdown/HTML | 是 | 正文 |
| `author` | ref → Author | 否* | 单作者博客可省略，硬编码站点名 |
| `categories` | string[] | 否 | 分类 slug 或名称 |
| `tags` | string[] | 否 | 标签 |
| `featured` | boolean | 否 | 首页置顶 |

## 作者 `Author`（多作者时）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 展示名 |
| `bio` | string | 简介 |
| `avatar` | URL | 头像 |
| `social_links` | { label, url }[] | 社交链接 |

## 分类 / 标签

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 展示名 |
| `slug` | string | URL |
| `description` | string | 可选，分类页 SEO/副标题 |
