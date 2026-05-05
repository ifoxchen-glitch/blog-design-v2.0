# Phase 5 正式上线计划

> 目标：从开发态切换到生产态，具备对外服务能力。
>
> **预计总工时**：10h（2 个子阶段）。
> **里程碑**：M5（2026-07-26）

---

## 0. 上线范围

Phase 5 不添加新功能，只关注"生产就绪"（Production Ready）：

| 模块 | 内容 | 优先级 |
|------|------|--------|
| 生产部署 | Docker 生产配置 + Nginx + SSL | P0 |
| 安全加固 | CSP / HSTS / Rate Limit / XSS / CSRF | P0 |
| 性能优化 | gzip / 缓存 / 静态资源 CDN / 数据库索引 | P0 |
| 旧后台下线 | EJS admin 路由关闭 + 跳转 | P1 |
| SEO / 域名 | 自定义域名 + HTTPS + robots.txt + sitemap | P1 |
| 监控报警 | 进程守护 + 异常通知（邮件/企业微信） | P1 |
| 运维手册 | 故障恢复 + 备份还原 + 回滚流程 | P2 |

---

## 1. 生产部署架构

```
User
  │
  ▼
Cloudflare / Nginx (SSL termination)
  │
  ├─► blog-design-v2.0 (Docker Compose)
  │     ├─ frontApp  :8787  ── 前台博客
  │     ├─ adminApp  :3000  ── v2 API
  │     └─ SQLite    ./db/blog.sqlite
  │
  └─► Optional: CDN for /uploads
```

**容器编排**：单容器单进程（`server/` + `admin/dist/`），用 `docker-compose.yml` 管理。

---

## 2. Docker 生产优化

### 2.1 Dockerfile 改进

`Dockerfile` 当前使用 `node:20-alpine`，需补充：

- 多阶段构建：stage1 编译 admin SPA → stage2 只拷贝产物
- 非 root 用户运行（`USER node`）
- 只暴露 8787 + 3000
- `.dockerignore` 排除 `node_modules` / `.git` / `db/backups/*.sqlite`
- 健康检查：`HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8787/health || exit 1`

### 2.2 docker-compose.yml

新增 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  blog:
    build: .
    restart: unless-stopped
    ports:
      - "8787:8787"
      - "3000:3000"
    volumes:
      - ./data/db:/app/server/db
      - ./data/backups:/app/server/db/backups
      - ./data/uploads:/app/server/public/uploads
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8787/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### 2.3 环境变量清单

生产环境 `.env` 必须包含（不可提交到 git）：

```bash
JWT_SECRET=<随机64位字符串>
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=<bcrypt_hash>
SESSION_SECRET=<随机32位字符串>
# 可选
AUDIT_LOG_RETENTION_DAYS=90
BACKUP_RETENTION_DAYS=30
```

---

## 3. Nginx 反向代理

`nginx.conf` 或 `nginx/sites-available/blog`：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 前台博客
    location / {
        proxy_pass http://localhost:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # v2 API
    location /api/v2/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态文件（可选走 CDN）
    location /admin-static/uploads/ {
        alias /var/www/blog/server/public/uploads/;
        expires 30d;
    }
}
```

---

## 4. SSL / HTTPS

- 使用 Let's Encrypt + Certbot 自动续期
- 或 Cloudflare 全站 SSL（灵活模式）
- HSTS 头：`Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 5. 安全加固

### 5.1 后端

`server/src/apps/frontApp.js` / `adminApp.js`：

- Helmet 中间件已启用，需补充：
  - `Content-Security-Policy`（限制内联脚本、只允许自身域名）
  - `X-Frame-Options: DENY`
- Rate Limit 增强：
  - 前台 PV `/api/pv`：60/分钟/IP（已有）
  - 登录 `/api/v2/auth/login`：10/分钟/IP（防止暴力破解）
  - 通用 API：300/分钟/IP
- CORS 生产白名单：`https://yourdomain.com`，关闭 devCors
- JWT Secret 强度校验：启动时检查长度 ≥ 32

### 5.2 前端

- Admin SPA `index.html` 加 `<meta http-equiv="Content-Security-Policy" ...>`
- 密码输入框强制 autocomplete="new-password"

---

## 6. 性能优化

### 6.1 后端

- `express.json()` / `express.static()` 启用 gzip（或交给 Nginx）
- `better-sqlite3` WAL 模式检查（已在 db.js？需确认）
- 图片上传限制：2MB → 5MB，但生产环境建议接图床/CDN

### 6.2 前端

- Admin SPA `vite build` 产物已优化，补充：
  - `rollup-plugin-visualizer` 分析包体积
  - `echarts` 按需导入（当前全量 import，生产可优化）
- 前台静态 HTML 启用 Nginx gzip + 缓存头

---

## 7. 旧 EJS 后台下线

`server/src/apps/frontApp.js`：

- 所有 `/admin/*` EJS 路由返回 410 Gone 或 302 重定向到 `/cms/login`
- `/api/admin/*` 旧 API 返回 `{ error: "deprecated", redirect: "/api/v2" }`
- 保留 `server/views/` 目录但不渲染，等待 Phase 5 结束后删除

---

## 8. 监控报警

- 进程守护：systemd 或 Docker `restart: unless-stopped`
- 健康检查：`/health` 接口 + Uptime Kuma / 阿里云监控
- 异常通知：
  - 备份失败 → 邮件/企业微信
  - 磁盘 > 85% → 报警
  - 5xx 错误率 > 1% → 报警

---

## 9. 运维手册

`docs/16-ops-manual.md`：

- 首次部署流程
- 日常运维（备份检查、日志查看、重启）
- 故障恢复（DB 损坏、回滚上一版本）
- 安全事件响应（密码泄露、异常登录）

---

## 10. 任务拆分

### T5.1 — Docker 生产配置（2h）
- 多阶段 Dockerfile
- docker-compose.yml + .env.example
- .dockerignore
- HEALTHCHECK

### T5.2 — Nginx + SSL 配置（1.5h）
- nginx.conf 模板
- Certbot 自动续期脚本
- HTTP → HTTPS 强制跳转

### T5.3 — 安全加固（2h）
- Helmet CSP / HSTS
- Rate Limit 增强（登录/API）
- CORS 生产白名单
- JWT Secret 启动校验

### T5.4 — 性能优化（1.5h）
- gzip / 缓存头
- echarts 按需导入评估
- 包体积分析

### T5.5 — 旧 EJS 下线（0.5h）
- `/admin/*` 返回 302/410
- `/api/admin/*` 返回 deprecation

### T5.6 — 监控报警（1h）
- systemd 服务文件 或 Docker restart
- Uptime Kuma 配置
- 磁盘/5xx 报警脚本

### T5.7 — 运维手册（1h）
- docs/16-ops-manual.md
- 故障恢复流程

### T5.8 — 验收部署（0.5h）
- 在测试服务器上完整走一遍部署流程
- 验证 HTTPS / 备份 / 监控

---

## 11. 验收标准

- [ ] `docker compose up -d` 一次启动成功
- [ ] HTTPS 证书有效，HTTP 自动跳转
- [ ] 旧 EJS `/admin/login` 返回 302/410
- [ ] Rate Limit 生效（登录 10/分钟）
- [ ] 备份定时任务正常写入文件
- [ ] 健康检查接口返回 200
- [ ] 运维手册入库

---

**写于**：2026-05-05（Phase 4 完成后）
**执行方**：Claude Code（host 端 CLI）
