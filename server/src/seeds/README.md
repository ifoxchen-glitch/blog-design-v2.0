# server/src/seeds/

数据库种子（seed）脚本 — 系统首次启动时初始化必要的内置数据。

## 文件清单

| 文件 | 用途 | Phase |
|------|------|-------|
| `rbacSeed.js` | RBAC 基础数据：12 权限 / 3 角色 / 默认菜单 / 超管账号迁移 | T1.4 |

## 设计约定

- **幂等**：所有 seed 必须可以重复执行不报错（`INSERT OR IGNORE` / 存在性判断 / 行计数判空）。
- **导出方式**：每个 seed 文件导出一个 `ensureXxxSeed(db, options)` 函数，由 `src/index.js` 启动尾部统一调用。
- **职责单一**：每个 seed 只关心自己那块内置数据，不跨模块写入。
- **依赖顺序**：所有 seed 在 `migrate(db)` 之后运行。如果 seed 之间有依赖（例如 user_roles 依赖 users + roles），同一个 seed 内用 `db.transaction` 包裹。

## 详见

- 数据初始化清单：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §7.5
- 12 权限码定义：[`docs/04-admin-architecture.md`](../../../docs/04-admin-architecture.md) §7.3
- 实施任务：[`docs/05-implementation-plan.md`](../../../docs/05-implementation-plan.md) T1.4
