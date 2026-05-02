# server/src/jobs/

定时任务层 — 用 `node-cron` 注册的周期性后台作业。

## 计划任务清单

| 文件 | 任务 | 触发频率 | Phase |
|------|------|----------|-------|
| `aggregateStats.js` | 聚合 `page_views` 原始记录 → `stats_daily` 日维度汇总表 | 每小时 | Phase 3 |
| `cleanupAuditLogs.js` *（待定）* | 清理 N 天前的 `audit_logs`（保留策略可配置） | 每天 03:00 | Phase 4 |
| `backupSqlite.js` *（待定）* | 触发 SQLite 在线备份到 `db/backups/` | 每天 02:00 | Phase 4 |

## 约定

- 每个 job 独立文件，**导出一个 `register(cron)` 函数**，由顶层 `index.js` 启动时统一调用。
- 任务体内异常必须捕获并写日志，不能让进程崩溃。
- 关键路径（聚合、备份）需写入 `audit_logs` 留痕。
- 时区一律使用服务器本地时间（部署在国内 → CST），cron 表达式按本地时间。
- 部署在多实例时，需要外部锁（暂不需要，单实例 Docker 部署）。

## 启动模式

```js
// 在 server/src/index.js 启动尾部统一注册：
require('./jobs/aggregateStats').register();
// require('./jobs/cleanupAuditLogs').register();
// require('./jobs/backupSqlite').register();
```

## 详见

- 数据分析聚合任务设计：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §6.3 / §9
- 实施任务：[`docs/05-implementation-plan.md`](../../../docs/05-implementation-plan.md) Phase 3 / Phase 4
