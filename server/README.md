# Blog 后台（Node + SQLite）

## 启动

1) 进入目录并安装依赖

```bash
cd blog-design/server
npm install
```

2) 设置环境变量（PowerShell 示例）

```powershell
$env:SESSION_SECRET="replace-me"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="admin"
# 或者用 hash（优先级更高）
# $env:ADMIN_PASSWORD_HASH="<bcrypt-hash>"
```

3) 启动

```bash
npm run dev
# 或 npm start
```

打开：
- 后台：`http://localhost:8787/admin/login`
- 前台：首页 `http://localhost:8787/index.html`，归档 `http://localhost:8787/archive.html`

## 发布/修改文章流程

- 登录后台 → `文章管理` → `新建文章` 或点 `编辑`
- 保存后仍是 **草稿**；点 **发布** 才会出现在前台列表与详情接口中
- 前台文章详情链接格式：`post.html?slug=<slug>`

## 数据库

- SQLite 文件位置：`blog-design/server/db/blog.sqlite`
- 首次启动会自动建表并插入 1 篇示例文章与标签

## 公开 API（前台用）

- `GET /api/posts?limit=12&offset=0&tag=<tagSlug>&q=<keyword>`
- `GET /api/posts/:slug`
- `GET /api/tags`

## 备注（安全）

- 正文建议用 Markdown；后端会渲染为 HTML 并做基础 XSS 清洗（允许标签白名单）。

