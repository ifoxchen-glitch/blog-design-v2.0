# server/src/middleware/

Express 中间件层 — 横切关注点（错误处理、鉴权、日志、CORS 等）统一放在这里。

## 计划文件清单（按 Phase 1 实施顺序）

| 文件 | 用途 | Phase |
|------|------|-------|
| `errorHandler.js` | 统一错误处理（捕获 throw，输出标准 JSON 响应） | T1.x |
| `requestValidator.js` | 请求参数校验（基于 `joi`） | T1.x |
| `requestLogger.js` | 请求日志（接入 `winston`，记录方法/路径/状态/耗时） | T1.x |
| `jwtAuth.js` | JWT 校验中间件（后台 + 前台预留读者） | T1.x |
| `sessionAuth.js` | Session 校验中间件（兼容旧 `/api/admin/*`，逐步淘汰） | T1.x |
| `rbac.js` | 权限校验中间件（`requirePermission('post:create')`） | T1.x |
| `cors.js` | 跨域配置（仅开发环境 → `localhost:8787` & `localhost:5173`） | T1.x |

## 约定

- **每个文件只导出一个或一组中间件函数**，不写业务逻辑。
- 中间件必须 next() 或 return，绝不允许半截响应。
- 鉴权类中间件失败时统一返回 `401 / 403`，错误格式：`{ code, message }`。
- 顺序敏感：`requestLogger` → `cors` → `jwtAuth` → `rbac` → 业务路由 → `errorHandler`。

## 详见

- 整体架构与中间件职责：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §4.2 / §7
- 实施任务：[`docs/05-implementation-plan.md`](../../../docs/05-implementation-plan.md) Phase 1
