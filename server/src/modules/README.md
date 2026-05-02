# server/src/modules/

业务模块层 — 按领域切分，每个模块自包含路由 / 控制器 / 服务三层。

## 计划模块清单

| 模块 | 用途 | Phase |
|------|------|-------|
| `core/` | 健康检查、文件上传、系统信息 | Phase 1 |
| `blog/` | 文章 / 标签 / 分类 / 友链 / 导入导出（替代旧 `/api/admin/*`） | Phase 2 |
| `rbac/` | 用户 / 角色 / 权限 / 菜单管理 | Phase 1-2 |
| `analytics/` | PV/UV、内容统计、趋势图表数据 | Phase 3 |
| `ops/` | 日志查询、备份、系统监控指标 | Phase 4 |
| `front/` | 前台预留模块（读者账号、评论体系，预留接入点） | Phase 5+ |

## 三层结构约定

每个模块目录下固定三层（不允许越层调用）：

```
modules/<name>/
├── <name>.routes.js       # 路由声明 + 中间件挂载，无业务逻辑
├── <name>.controller.js   # req/res 处理、参数解析、调用 service、返回 JSON
└── <name>.service.js      # 业务逻辑 + 数据库读写，不感知 HTTP
```

- **routes**：只挂载路由，例如 `router.get('/v2/admin/posts', jwtAuth, requirePermission('post:list'), ctrl.list)`
- **controller**：最薄，把 req 拆成普通参数 → 调 service → service 结果包装成 `{ code, data, message }`
- **service**：纯函数化的业务逻辑，便于单测

## 统一响应格式

```json
{ "code": 0, "data": {...}, "message": "ok" }
{ "code": 4001, "message": "用户名或密码错误" }
```

错误码段（详见架构文档）：`0 = 成功`、`4xxx = 客户端错误`、`5xxx = 服务端错误`。

## 详见

- 模块结构与示例：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §4.2 / §4.3 / §6
- 实施任务：[`docs/05-implementation-plan.md`](../../../docs/05-implementation-plan.md) 全部 5 个 Phase
