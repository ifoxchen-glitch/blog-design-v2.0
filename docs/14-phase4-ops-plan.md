# Phase 4 运维监控模块计划

> 目标：让系统具备生产级运维能力 — 备份、日志清理、系统监控。
>
> **预计总工时**：12h（3 个子阶段）。
> **里程碑**：M4（2026-07-12）

---

## 0. 当前状态

**已有基础**：
- 审计日志中间件（`auditLogger.js`）自动写入 `audit_logs` 表
- 审计日志查询 API（`opsRouter.js`）支持分页 + action/resourceType/username/date 筛选
- 审计日志前端页面（`admin/src/views/cms/ops/logs/index.vue`）表格 + 详情弹窗
- `node-cron` 已安装，`server/src/jobs/` 目录已预留

**Phase 4 增量**：

| 模块 | 内容 | 优先级 | Issue |
|------|------|--------|-------|
| 审计日志增强 | 导出 CSV、统计卡片（操作分布/用户活跃度） | P1 | #79 / #87 |
| SQLite 备份 | 备份脚本 + 列表/下载 API + 定时任务 + 清理策略 | P0 | #80~#83 / #88 |
| 系统监控 | CPU/内存/磁盘 API + 看板页面 | P0 | #84 / #89 |
| 日志清理 | 旧审计日志自动清理（保留 N 天） | P1 | #85 / #86 |

---

## 1. 审计日志增强

### 1.1 后端增强

`server/src/apps/admin/ops/opsRouter.js` 现有 `/audit-logs` 基础上新增：

```
GET /api/v2/admin/ops/audit-logs/stats
```

返回：
```json
{
  "code": 200,
  "data": {
    "todayCount": 156,
    "actionDistribution": [
      { "action": "post", "count": 45 },
      { "action": "put", "count": 78 },
      { "action": "delete", "count": 33 }
    ],
    "topUsers": [
      { "username": "admin", "count": 89 }
    ]
  }
}
```

### 1.2 前端增强

`admin/src/views/cms/ops/logs/index.vue`：
- 页面顶部增加统计卡片行（今日操作数、各操作类型数量）
- 表格右上角增加"导出 CSV"按钮：导出当前筛选条件下的全部日志
- 使用 `BarChart` 组件展示操作类型分布（复用 Phase 3 封装的图表）

---

## 2. SQLite 备份系统

### 2.1 数据库设计

新增 `backups` 表（migration）：

```sql
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'scheduled'
  status TEXT NOT NULL DEFAULT 'ok',    -- 'ok' | 'failed' | 'restored'
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
```

### 2.2 备份脚本

`server/src/jobs/backupSqlite.js`：
- 使用 SQLite 的 `VACUUM INTO` 或 `backup API`（`better-sqlite3` 的 `.backup()` 方法）
- 备份路径：`server/db/backups/backup-YYYY-MM-DD-HH-mm-ss.sqlite`
- 备份完成后写入 `backups` 表记录
- 失败时记录状态为 `failed` 并写日志

`server/src/utils/backup.js` — 备份核心函数（供脚本和 API 复用）：

```js
function createBackup(type = 'manual', note = '')
  // 返回 { filename, size, path }
```

### 2.3 API

`server/src/apps/admin/ops/opsRouter.js` 新增：

```
POST /api/v2/admin/ops/backup      # 手动触发备份
GET  /api/v2/admin/ops/backups     # 列表（page/pageSize）
GET  /api/v2/admin/ops/backups/:id/download  # 下载备份文件
DELETE /api/v2/admin/ops/backups/:id         # 删除备份（文件+记录）
```

权限：`ops:backup`

### 2.4 定时任务

`server/src/jobs/backupSqlite.js`：
- 每天 02:00 自动备份（`0 2 * * *`）
- type = 'scheduled'
- 备份成功后，调用清理策略删除旧备份

### 2.5 清理策略

`server/src/jobs/backupCleanup.js`：
- 保留最近 7 天的每日备份
- 保留最近 4 周的每周一备份（取每周最早的）
- 删除时同时删文件和 `backups` 表记录

### 2.6 前端页面

`admin/src/views/cms/ops/backup/index.vue`（已有路由 `/cms/ops/backup`，当前空白）：
- 顶部："立即备份"按钮 + 最近备份时间统计卡片
- 表格：备份列表（文件名、大小、类型、状态、创建时间）
- 操作：下载、删除
- 支持筛选：type（手动/自动）、status

---

## 3. 系统监控

### 3.1 监控 API

`server/src/apps/admin/ops/opsRouter.js` 新增：

```
GET /api/v2/admin/ops/monitor
```

返回：
```json
{
  "code": 200,
  "data": {
    "cpu": { "usage": 23.5 },
    "memory": { "total": 8589934592, "used": 4294967296, "usage": 50.0 },
    "disk": { "total": 536870912000, "used": 268435456000, "usage": 50.0 },
    "uptime": 86400,
    "dbSize": 10485760,
    "activeUsers": 3
  }
}
```

实现方式：
- CPU：`os.loadavg()`（1分钟平均）或 `process.cpuUsage()`
- 内存：`os.totalmem()` / `os.freemem()`
- 磁盘：`fs.statfs`（Node 18+）或 `check-disk-space` npm 包
- 运行时间：`process.uptime()`
- DB 大小：`fs.statSync(dbPath).size`
- 在线人数：`SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at >= datetime('now', '-5 minutes')`

### 3.2 前端看板

`admin/src/views/cms/ops/monitor/index.vue`（已有路由 `/cms/ops/monitor`，当前空白）：
- 顶部统计卡片：CPU、内存、磁盘、运行时间、DB 大小、在线人数
- 使用 `PieChart` 展示内存/磁盘使用比例（ donut 图）
- 简单进度条/仪表盘展示 CPU 使用率
- 每 30 秒自动刷新（`setInterval`）

---

## 4. 审计日志清理定时任务

`server/src/jobs/cleanupAuditLogs.js`：
- 每天 03:00 执行（`0 3 * * *`）
- 删除 90 天前的 `audit_logs` 记录（保留策略可配置，从 `.env` 读取 `AUDIT_LOG_RETENTION_DAYS=90`）
- 清理后写入 `audit_logs` 留痕（type = 'system'，记录删除了多少条）

---

## 5. 任务拆分

### T4.1 — 审计日志增强（1.5h）
- `/audit-logs/stats` API
- 前端统计卡片 + CSV 导出
- 操作分布柱状图

### T4.2 — SQLite 备份核心（2h）
- `backups` 表 migration
- `utils/backup.js` 核心函数
- 手动备份 API（POST/GET/download/DELETE）

### T4.3 — 备份前端页面（1.5h）
- `ops/backup/index.vue` 备份管理页
- 立即备份按钮 + 列表 + 下载/删除

### T4.4 — 自动备份定时任务（1h）
- `jobs/backupSqlite.js` 每天 02:00
- `jobs/backupCleanup.js` 清理旧备份

### T4.5 — 系统监控 API（1h）
- `/ops/monitor` API（CPU/内存/磁盘/在线人数）
- 安装 `check-disk-space`（如需要）

### T4.6 — 系统监控看板（1.5h）
- `ops/monitor/index.vue` 监控看板
- 统计卡片 + 饼图 + 自动刷新

### T4.7 — 审计日志清理定时任务（0.5h）
- `jobs/cleanupAuditLogs.js`
- `.env` 配置 `AUDIT_LOG_RETENTION_DAYS`

### T4.8 — 权限与路由（0.5h）
- 确认所有新 API 有 `ops:logs` / `ops:backup` / `ops:monitor` 权限
- 菜单 seed 如有缺失需补

---

## 6. 验收标准

- [ ] 审计日志页有统计卡片和 CSV 导出按钮
- [ ] 手动备份成功，文件出现在 `db/backups/`，`backups` 表有记录
- [ ] 备份列表页可下载和删除备份
- [ ] 系统监控看板显示 CPU/内存/磁盘/在线人数，30 秒自动刷新
- [ ] 定时任务注册成功，无报错（`node-cron` 打印确认）
- [ ] 审计日志清理任务删除 90 天前的记录
- [ ] 所有新 API 有权限控制

---

## 7. 设计决策

- **备份方式**：使用 `better-sqlite3` 的 `.backup()` 方法（在线热备份，不锁库）
- **备份存储**：本地文件系统 `server/db/backups/`，不上传云存储（后续 Phase 5 可扩展）
- **监控刷新**：前端轮询 30 秒，不推 WebSocket（简单可靠）
- **清理策略**：保留 7 天每日 + 4 周每周一，总计约 11 个备份文件，空间可控

---

**写于**：2026-05-05（Phase 3 完成后）
**执行方**：Claude Code（host 端 CLI）
