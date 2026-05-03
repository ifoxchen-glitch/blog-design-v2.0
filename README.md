# ifoxchen.com Blog v2

个人博客全栈项目 —— Express 5 + SQLite 后端，静态 HTML 前台，Vue 3 管理后台。

## 快速开始（5 分钟）

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url> blog-design-v2.0
cd blog-design-v2.0

# 后端依赖
cd server && npm install

# 前端依赖（另一个终端）
cd admin && npm install
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env，设置 ADMIN_EMAIL 和 ADMIN_PASSWORD（或 ADMIN_PASSWORD_HASH）
```

### 3. 启动服务

**终端 A — 后端**（同时启动两个端口）：

```bash
cd server && npm run dev
```

日志输出示例：

```
Front : http://localhost:8787
Legacy admin (EJS) : http://localhost:8787/admin/login
Admin v2 API : http://localhost:3000/api/v2
```

**终端 B — 前端开发服务器**：

```bash
cd admin && npm run dev
```

打开 http://localhost:5173 进入 Vue 后台登录页。

### 4. 首次登录

使用 `.env` 中配置的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 登录。

---

## 项目结构

```
.
├── server/                 # Express 5 后端
│   ├── src/
│   │   ├── apps/           # frontApp.js (8787) + adminApp.js (3000)
│   │   ├── middleware/     # jwtAuth.js, rbac.js, cors.js
│   │   ├── modules/        # 业务模块（预留 Phase 2）
│   │   ├── seeds/          # RBAC 种子数据
│   │   ├── db.js           # SQLite + better-sqlite3
│   │   ├── auth.js         # 旧 session 认证
│   │   └── index.js        # 双端口启动入口
│   ├── db/                 # SQLite 文件
│   ├── public/uploads/     # 上传图片
│   └── .env                # 环境变量
│
├── admin/                  # Vue 3 + TypeScript 管理后台
│   ├── src/
│   │   ├── api/            # Axios 请求 + auth 接口
│   │   ├── components/     # 布局组件
│   │   ├── directives/     # v-permission
│   │   ├── router/         # Vue Router + 路由守卫
│   │   ├── stores/         # Pinia (auth, permission)
│   │   └── views/          # 页面
│   ├── scripts/            # 验收验证脚本
│   └── vite.config.ts      # 代理 /api → localhost:3000
│
├── css/                    # 前台样式
├── js/                     # 前台脚本
├── *.html                  # 前台静态页面
└── docs/                   # 架构设计 + 实施计划
```

---

## 常用命令

| 命令 | 作用 |
|------|------|
| `cd server && npm run dev` | 启动后端（双端口） |
| `cd server && npm start` | 生产模式 |
| `cd admin && npm run dev` | 启动 Vue dev server |
| `cd admin && npm run build` | 构建生产包 |
| `cd admin && npx tsx scripts/check-integration.ts` | Phase 1 集成验收 |

---

## 技术栈

- **后端**: Express 5, better-sqlite3, jsonwebtoken, bcryptjs, multer, helmet
- **前台**: 原生 HTML/JS, CSS 自定义属性（11 主题）
- **后台**: Vue 3.5, Vite 8, TypeScript, Naive UI 2.44, Pinia 3, Vue Router 5
- **部署**: Docker, bash deploy.sh

---

## 文档

- [CLAUDE.md](CLAUDE.md) — 给 Claude Code 的上下文指南
- [docs/04-admin-architecture.md](docs/04-admin-architecture.md) — 架构设计
- [docs/05-implementation-plan.md](docs/05-implementation-plan.md) — 实施计划
- [CHANGELOG.md](CHANGELOG.md) — 版本变更记录
