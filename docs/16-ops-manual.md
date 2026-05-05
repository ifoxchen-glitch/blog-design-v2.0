# 运维手册

> ifoxchen.com 个人博客 v2 —— 生产运维指南。
>
> 最后更新：2026-05-05

---

## 目录

1. [首次部署](#1-首次部署)
2. [日常运维](#2-日常运维)
3. [备份与恢复](#3-备份与恢复)
4. [故障处理](#4-故障处理)
5. [安全事件响应](#5-安全事件响应)
6. [回滚流程](#6-回滚流程)

---

## 1. 首次部署

### 1.1 前置条件

- Docker 24+ & Docker Compose v2+
- Nginx（用于 SSL 终止 + 反向代理）
- 域名 DNS 已指向服务器公网 IP
- Git clone 仓库到 `/var/www/blog`

### 1.2 环境变量

```bash
cd /var/www/blog
cp server/.env.example server/.env
# 编辑 .env，填入以下值：
#   JWT_SECRET=<openssl rand -hex 32>
#   ADMIN_EMAIL=admin@ifoxchen.com
#   ADMIN_PASSWORD_HASH=$(htpasswd -bnBC 10 "" "your-password" | tr -d ':\n')
#   SESSION_SECRET=<openssl rand -hex 16>
```

### 1.3 启动

```bash
# 构建并启动
docker compose up -d --build

# 检查健康状态
curl http://localhost:8787/health
curl http://localhost:3000/health

# 查看日志
docker compose logs -f
```

### 1.4 SSL 证书

```bash
chmod +x scripts/setup-ssl.sh
sudo ./scripts/setup-ssl.sh
```

### 1.5 Nginx

```bash
sudo ln -s /var/www/blog/nginx/blog.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. 日常运维

### 2.1 容器管理

```bash
# 查看状态
docker ps

# 查看日志
docker compose logs --tail=50
docker compose logs -f

# 重启
docker compose restart

# 更新（拉取最新镜像并重启）
docker compose pull && docker compose up -d
```

### 2.2 备份检查

```bash
# 查看备份列表
docker compose exec blog ls -la /app/server/db/backups/

# 手动触发备份
# 通过 Admin 后台 → 运维 → 备份管理 → 立即备份
```

### 2.3 审计日志清理

自动清理由定时任务管理（默认保留 90 天），无需手动操作。

### 2.4 资源监控

- Admin 后台 → 运维 → 系统监控（CPU/内存/磁盘）
- 命令行：
  ```bash
  docker stats --no-stream
  df -h
  free -m
  ```

---

## 3. 备份与恢复

### 3.1 数据库备份

自动备份每天凌晨 3:00 执行，保留最近 30 天。

备份文件位置：`server/db/backups/blog-YYYY-MM-DD.sqlite`

### 3.2 全库数据导出（JSON）

Admin 后台 → 数据导入导出 → 导出 JSON 备份

导出文件包含：文章、标签、分类、友链及其关联。

### 3.3 数据库恢复

**从 SQLite 备份恢复：**

```bash
# 停止容器
docker compose down

# 替换数据库文件
cp server/db/backups/blog-2026-05-05.sqlite server/db/blog.sqlite

# 启动
docker compose up -d
```

**从 JSON 备份恢复：**

Admin 后台 → 数据导入导出 → 选择 JSON 文件 → 确认导入（覆盖式还原）

注意：JSON 导入会清空并重新写入全库数据，不可恢复。

---

## 4. 故障处理

### 4.1 容器启动失败

```bash
# 查看错误日志
docker compose logs --tail=100

# 常见原因：
# - 端口被占用 → 检查 lsof -i :8787 / :3000
# - 环境变量缺失 → 检查 server/.env
# - SQLite 文件损坏 → 从备份恢复
```

### 4.2 后台 500 错误

1. 检查容器日志：`docker compose logs`
2. 检查 API 响应体中的 `message` 字段
3. 确认数据库文件权限：`ls -la server/db/blog.sqlite`
4. 确认磁盘空间：`df -h`

### 4.3 登录失败

- 确认 ADMIN_EMAIL / ADMIN_PASSWORD_HASH 匹配
- 查看审计日志（登录后会记录 401）
- JWT_SECRET 变更会导致已有 token 失效——需重新登录

### 4.4 页面白屏 / SPA 不加载

1. 确认 admin 端口 3000 可访问：`curl http://localhost:3000`
2. 检查 Nginx 反向代理配置
3. 确认 `admin/dist/` 存在且包含 `index.html`
4. 浏览器控制台查看 CSP 错误

### 4.5 磁盘空间不足

```bash
# 清理旧备份
docker compose exec blog find /app/server/db/backups -name "*.sqlite" -mtime +30 -delete

# 清理 Docker 残留
docker system prune -f

# 清理 Nginx 日志
sudo truncate -s 0 /var/log/nginx/access.log
sudo truncate -s 0 /var/log/nginx/error.log
```

---

## 5. 安全事件响应

### 5.1 密码泄露

1. 立即更改 ADMIN_PASSWORD_HASH 并重启容器
2. 更换 JWT_SECRET（使所有已签发 token 失效）
3. 检查审计日志中是否有异常登录记录
4. 检查 access log 中是否有异常 IP

### 5.2 异常登录检测

- Rate Limit 10 次/分钟 会自动拦截暴力破解
- 审计日志记录每次登录的 IP、User-Agent、时间
- 定期检查：Admin 后台 → 运维 → 审计日志

### 5.3 数据库损坏

```bash
# 1. 停止容器
docker compose down

# 2. 尝试修复
sqlite3 server/db/blog.sqlite "PRAGMA integrity_check;"

# 3. 如果损坏，从备份恢复
cp server/db/backups/$(ls -t server/db/backups/ | head -1) server/db/blog.sqlite

# 4. 启动
docker compose up -d
```

---

## 6. 回滚流程

```bash
# 回滚到上一版本
git log --oneline -5              # 查看最近的提交
git checkout <previous-commit>    # 切到上一个稳定版本
docker compose up -d --build      # 重建并启动

# 或拉取特定镜像标签
docker compose up -d              # 默认使用 :latest 标签
```

---

## 参考链接

- GitHub 仓库：https://github.com/ifoxchen-glitch/blog-design-v2.0
- 前台博客：https://ifoxchen.com
- Admin 后台：https://ifoxchen.com/admin/
- API v2：https://ifoxchen.com/api/v2/
- 健康检查：https://ifoxchen.com/health
