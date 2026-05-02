# 项目检查报告

> 生成日期：2026-05-02
> 范围：blog-design v2.0 全栈代码审查（后端 / 前端 / EJS 后台 / 部署）
> 优先级：1 必修 → 2 安全 → 3 一致性 → 4 性能 → 5 风格

> **2026-05-02 修复进度**：1.x / 3.x / 4.x 全部已修；2.x 中 2.4-2.9 已修，2.1/2.2/2.3 暂缓；5.x 中 5.1/5.2/5.4/5.5/5.6 已修，5.3 暂缓。

---

## 1. Bug — 必修

### 1.1 `/admin/api` 路由会 500 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:683`
- 现象：`res.render("api", { agentApiKey: AGENT_API_KEY })`，但 `server/views/` 下只有 `edit.ejs / links.ejs / login.ejs / posts.ejs`，没有 `api.ejs`。
- 影响：进入后台「API 管理」页直接抛 `Error: Failed to lookup view "api"`。
- 修复：补 `server/views/api.ejs`，或临时注释掉 `GET /admin/api`、`POST /admin/api/regenerate-key` 两条路由。
- **实施**：注释掉两条路由；AGENT_API_KEY 改为 `.env` 手工维护。

### 1.2 `/api/admin/export` 漏导出 categories ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:159-165`
- 现象：只导出 `links / posts / tags / postTags`，缺 `categories` 与 `post_categories`。
- 影响：导入恢复后所有分类绑定丢失。
- 修复：在响应体中新增 `categories` 与 `postCategories` 字段。
- **实施**：响应体增加 `categories`、`postCategories`，`version` 提升为 2。

### 1.3 `/api/admin/import` 不清理 categories 表 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:171-202`
- 现象：删了 posts/tags/postTags/links，没删 categories 与 post_categories。
- 影响：导入新数据后留下旧分类（孤儿数据）。
- 修复：在事务里加 `DELETE FROM post_categories; DELETE FROM categories;`，并在 import 数据中循环恢复。
- **实施**：事务中增加 categories/post_categories 的清理与重建（兼容 v1 旧文件：字段不存在则跳过）。

### 1.4 `sync-obsidian` 路径遍历 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:297-376`
- 现象：接收用户传入的 `vaultPath` 直接 `fs.readdirSync` / `readFileSync`。
- 影响：API key 一旦泄露，攻击者可通过 `vaultPath: "/etc"` 等读取任意 `.md` 文件并写入博文。
- 修复：把 `vaultPath` 限制在白名单根目录下，使用 `path.resolve` + `startsWith` 校验。
- **实施**：直接删除该路由整段。

### 1.5 `post.html` 命中判定脆弱 ✅ 已修复（2026-05-02）
- 位置：`js/blog.js:297`
- 现象：`if (location.pathname.endsWith("/post.html") || page.includes("单篇"))` —— 后者只是因示例标题包含「单篇」才能侥幸触发。
- 影响：删除示例文章后，直接进 `/post.html`（无 slug）会停留在硬编码内容。
- 修复：删掉 `page.includes("单篇")` 这条 fallback。
- **实施**：已按建议删除 fallback。

---

## 2. 安全

### 2.1 默认凭据 / 密钥隐患 ⏭️ 暂缓（2026-05-02）
- `server/.env` 仍是模板默认值（`SESSION_SECRET=change-me-to-a-random-string`、`ADMIN_PASSWORD=admin`）。
- `docker-compose.yml:11-13` 用 `${SESSION_SECRET:-change-me-in-production}` 兜底，会静默接受弱值。
- 修复：启动时校验 `SESSION_SECRET` 必须 ≥ 32 字符且不在弱值黑名单内，否则拒绝启动。
- **状态**：用户决定暂不实现启动校验，需上线前手工更换 `SESSION_SECRET`、`ADMIN_PASSWORD`。

### 2.2 cookie 未设 `secure`，`sameSite: false` ⏭️ 暂缓（2026-05-02）
- 位置：`server/src/index.js:72-81`
- 修复：生产 HTTPS 下应显式 `sameSite: "lax"`、`secure: process.env.NODE_ENV === "production"`。
- **状态**：用户决定暂不修改。

### 2.3 后台无 CSRF 防护 ⏭️ 暂缓（2026-05-02）
- 现象：所有 `POST /admin/*` 都靠 session，没有 CSRF token。`/admin/posts/:id/delete`、`/admin/links` 等表单可被第三方页面跨站提交。
- 修复：加 `csurf` 中间件或自己注入 token。
- **状态**：用户决定暂不实现。

### 2.4 登录无速率限制 ✅ 已修复（2026-05-02）
- 位置：`/admin/login`
- 现象：没有任何节流，可被字典爆破。
- 修复：加 `express-rate-limit`（失败 5 次 / 15 分钟）。
- **实施**：引入 `express-rate-limit`，`loginLimiter`（10 次/5 分钟，IP 维度）挂载到 `POST /admin/login`，达限返回 429 并渲染登录页错误提示。

### 2.5 上传允许 SVG ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:60`
- 现象：SVG 可内嵌 `<script>`，`/admin-static/uploads/xxx.svg` 直接以 `image/svg+xml` 返回时会执行脚本（站内 XSS）。
- 修复：去掉 `.svg`，或上传时做 `sanitize-html` 清洗后再写盘。
- **实施**：从 multer allowlist 中移除 `.svg`，仅保留 `.jpg/.jpeg/.png/.gif/.webp`。

### 2.6 静态资源 CSP / Helmet 缺失 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:84-89`
- 现象：只手写了三个老 header，没有 `Content-Security-Policy`、`Referrer-Policy`、`Permissions-Policy`。
- 修复：引入 `helmet` 一站式补齐；CSP 至少限制 `script-src 'self'`（如允许 Google Fonts 加 `fonts.googleapis.com`）。
- **实施**：替换为 `helmet({contentSecurityPolicy: {...}})`，CSP 允许 self + inline + Google Fonts + data/https 图片。

### 2.7 链接图标 XSS 风险 ✅ 已修复（2026-05-02）
- 位置：`links.html:114`
- 现象：`link.icon` 来自数据库，仅做了 `escapeHtml` 字符转义，没有协议白名单，可能被 `javascript:`、`data:` 协议利用。
- 修复：前 / 后端校验 URL 协议（只允许 `http(s)://` 与 `/`）。
- **实施**：后端 `safeUrl()` 在 `POST/PUT /api/admin/links` 校验，非法返回 400；前端 `links.html` 渲染时同样过滤 `link.url`/`link.icon`，icon 额外允许 `data:image/`。

### 2.8 `requireAgentApiKey` 信息泄漏 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:30`
- 现象：`AGENT_API_KEY` 未配置时返回 `agent_api_not_configured`，向攻击者泄漏后端配置状态。
- 修复：统一返回 `invalid_api_key`，内部用日志区分。
- **实施**：未配置分支改为 `console.warn(...)` + 统一返回 `invalid_api_key`。

### 2.9 `db.pragma("foreign_keys = OFF")` 在事务里 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:172`
- 现象：SQLite 文档明确这条 pragma 在事务内无效，会被忽略。
- 修复：在事务外提前关、事务后再开；或改成先 `DELETE` 再 `INSERT` 的有序方案。
- **实施**：pragma 移到 `tx()` 调用前，`try/catch/finally` 中恢复 `foreign_keys = ON`，事务体内不再含 pragma。

---

## 3. 数据 / 接口一致性

### 3.1 接口与 docs 字段名不一致 ✅ 已修复（2026-05-02）
- `docs/04-content-model.md:11-22` 用 `cover_image / published / featured / created_at`，实际代码用 `coverImageUrl / status='published'|'draft' / createdAt`，且没有 `featured`。
- 修复：同步文档，或给 `posts` 表加 `featured` 字段实现「首页置顶」。
- **实施**：改文档对齐代码（camelCase）；明确标注 `featured` 未实现；同步更新 categories/external_links 字段。

### 3.2 `splitTags` 接受数组，但表单里始终是字符串 ✅ 已修复（2026-05-02）
- 后台目前 OK，但 `/api/admin/posts` 文档暗示可接受数组，需要补充边界值测试。
- **实施**：在 `docs/04-content-model.md` 增加「接口字段约定」小节，明确 tags/categories 同时接受逗号分隔字符串与数组（项目无测试套件，故仅文档化）。

### 3.3 `SITE_URL` env 未被使用 ✅ 已修复（2026-05-02）
- 位置：`server/src/index.js:515`
- 现象：`.env.example` 声明 `SITE_URL=https://ifoxchen.com`，但 RSS 把站点 URL 硬编码。
- 修复：`const SITE_URL = optional("SITE_URL", "https://ifoxchen.com")`。
- **实施**：顶部读取 `SITE_URL`（去末尾 `/`），RSS handler 改用该常量。

---

## 4. 性能 / 正确性

### 4.1 `/api/posts` 总数查询效率 ✅ 已修复（2026-05-02）
- 现象：有 tag / category 过滤时 `COUNT(*)` + `LIMIT/OFFSET` 双查询；`postIds` 多次往返。
- 当前规模 OK，后续超过几百篇时改成窗口函数或单次 SQL 一并拿到 total。
- **实施**：在 SELECT 列表加 `COUNT(*) OVER() AS _total`，主查询一次拿到 total；offset 越界（结果空）时 fallback 单独 count。`_total` 在响应前剥离不返回客户端。

### 4.2 `archive` 分页页数计算 ✅ 已修复（2026-05-02）
- 位置：`js/blog.js:162-164`
- 现象：同时算了 `totalPages` 和 `displayPages`，但只用了 `displayPages`；`total === 0` 时分页 DOM 不重置，残留上一次状态。
- **实施**：删除冗余 `displayPages`；`total <= 0` 时 `pagination.innerHTML = ""` 显式重置。

### 4.3 `await checkUrlOk` 用 GET 探活 ✅ 已修复（2026-05-02）
- 位置：`server/views/links.ejs:266-273`
- 现象：用 `fetch(url, { method: "GET" })` 探测图标存在性，大文件会全量下载。
- 修复：改 `HEAD`（jsDelivr 支持）。
- **实施**：method 改为 `HEAD`。

---

## 5. 风格 / 工程

### 5.1 清理 server/ 下临时脚本 ✅ 已修复（2026-05-02）
- 现象：`server/` 下散落 `port-test.*`、`server-smoke*.*`、`smoke-manual.*`、`deploy-help.sh`、`deploy-remote.bat/sh`、`deploy-run.bat` 等 8 个临时文件。
- 修复：`git rm` 删除 4 个已跟踪的脚本文件；其余未跟踪文件已在 `.gitignore` 中。
- **实施**：已删除 `deploy-help.sh`、`deploy-remote.bat`、`deploy-remote.sh`、`deploy-run.bat`。

### 5.2 `.env.example` 双份不一致 ✅ 已修复（2026-05-02）
- 现象：根目录 `.env.example` 与 `server/.env.example` 字段不一致。
- 修复：合并为根目录一份，删除 `server/.env.example`。
- **实施**：根目录 `.env.example` 已合并 `AGENT_API_KEY`、`SITE_URL`、`BCRYPT_HASH` 等字段；`server/.env.example` 已删除。

### 5.3 部署路径未统一 ⏭️ 暂缓（2026-05-02）
- 现象：`docker-compose.yml`（env 注入）与 `deploy.sh`（SCP `.env` 文件）两条路径并存，AGENTS.md 和 `deploy.sh` 都没用 compose。
- 修复：统一到 `docker compose -f compose.prod.yml up -d`。
- **状态**：用户决定暂不处理，保持现有 `deploy.sh` 工作流。

### 5.4 HTML 主题 modal 重复 ✅ 已修复（2026-05-02）
- 现象：5 个静态 HTML 页各有一份 25 行主题选择 modal  markup。
- 修复：`js/theme.js` 在运行时注入 modal DOM，HTML 只保留触发按钮。
- **实施**：`js/theme.js` 新增 `MODAL_HTML` 模板与 `ensureModal()` 函数；`index.html`、`post.html`、`archive.html`、`links.html`、`about.html` 均已移除 modal markup。

### 5.5 `escapeHtml` / 链接渲染重复 ✅ 已修复（2026-05-02）
- 现象：`js/blog.js` 与 `links.html` 内联脚本各有一份 `escapeHtml` 和链接渲染逻辑。
- 修复：提取到公共 `js/utils.js`，通过 `window.BlogUtils` 共享。
- **实施**：新建 `js/utils.js` 暴露 `escapeHtml`、`safeUrl`、`renderLinkCards`；`links.html` 改为调用 `window.BlogUtils.renderLinkCards(data.links)`；5 个 HTML 页均已引入 `js/utils.js`。

### 5.6 slug fallback 未过滤特殊字符 ✅ 已修复（2026-05-02）
- 位置：`server/src/utils.js:17`
- 现象：`s.toLowerCase().replace(/\s+/g, "-")` 未过滤 `/`、`?`、`#`、`%`、`&`。
- 修复：追加 `.replace(/[\/?#%&]+/g, "")`。
- **实施**：`normalizeSlug` fallback 已补过滤。

---

## 修复建议顺序

1. **1.1 / 1.2 / 1.3** — 直接影响功能，先修。
2. **2.1 / 2.2 / 2.3 / 2.4 / 2.5** — 上线前必修。
3. **1.4 / 2.6 / 2.7 / 2.8 / 2.9** — 安全加固。
4. **3.x / 4.x** — 视优先级排期。
5. **5.x** — 长期维护改进。

---

## 修复进度（2026-05-02）

| 编号 | 状态 | 说明 |
| --- | --- | --- |
| 1.1 | ✅ | 注释 `/admin/api` 路由 |
| 1.2 | ✅ | export 增 categories/postCategories，version=2 |
| 1.3 | ✅ | import 兼容 v1/v2，重建 categories |
| 1.4 | ✅ | 删除 sync-obsidian 路由 |
| 1.5 | ✅ | 移除 `page.includes("单篇")` fallback |
| 2.1 | ⏭️ | 暂缓（上线前手工换密钥/口令） |
| 2.2 | ⏭️ | 暂缓 |
| 2.3 | ⏭️ | 暂缓 |
| 2.4 | ✅ | loginLimiter 10 次/5min |
| 2.5 | ✅ | 上传移除 .svg |
| 2.6 | ✅ | helmet + CSP |
| 2.7 | ✅ | 前后端 URL 协议白名单 |
| 2.8 | ✅ | 统一 invalid_api_key + warn 日志 |
| 2.9 | ✅ | pragma 移出事务，try/finally 兜底 |
| 3.1 | ✅ | docs/04-content-model.md 改用 camelCase，标注 featured 未实现 |
| 3.2 | ✅ | 文档增加 tags/categories 双格式说明 |
| 3.3 | ✅ | RSS 改读 SITE_URL env |
| 4.1 | ✅ | `/api/posts` 改用 `COUNT(*) OVER()` 窗口函数 |
| 4.2 | ✅ | archive 分页 total=0 时清空 DOM，删冗余 displayPages |
| 4.3 | ✅ | links.ejs 图标探活改 HEAD |
| 5.1 | ✅ | 删除 server/ 下 4 个已跟踪的临时脚本 |
| 5.2 | ✅ | 合并 .env.example 到根目录，删除 server/.env.example |
| 5.3 | ⏭️ | 暂缓（保持现有 deploy.sh 工作流） |
| 5.4 | ✅ | theme.js 运行时注入 modal，5 个 HTML 移除重复 markup |
| 5.5 | ✅ | 新建 js/utils.js，links.html 改用 window.BlogUtils |
| 5.6 | ✅ | normalizeSlug fallback 过滤 /?#%& |

依赖新增：`helmet ^7.1.0`、`express-rate-limit ^7.4.0`（均在 `server/package.json`）。
