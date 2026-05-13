# Open WebUI 集成文档

## 概述

本项目已将 Open WebUI 嵌入为 AI 工作台，完全替代了原有的自定义聊天和知识库检索功能。

## 架构

```
用户 → /cms/workspace → iframe → /workbench → Express代理 → Open WebUI (port 8080)
                ↓
           JWT 桥接（自动登录）
                ↓
        kb_documents → 同步 → Chroma 向量库
```

## 文件结构

```
server/
├── open-webui/              # Git 子模块 (Open WebUI 源码)
│   └── backend/
│       ├── open_webui/      # Python 后端
│       └── data/            # 数据目录 (SQLite + Chroma)
├── src/
│   ├── openwebui/
│   │   └── launcher.js      # Open WebUI 子进程启动器
│   ├── middleware/
│   │   └── openWebUIAuth.js # JWT → Open WebUI 认证桥接
│   ├── services/
│   │   └── kbSync.js        # 知识库同步服务
│   └── apps/
│       └── adminApp.js      # Express 代理配置
```

## 环境变量

在 `server/.env` 中添加：

```env
# Open WebUI 配置
OPEN_WEBUI_PORT=8080
OPEN_WEBUI_HOST=127.0.0.1
VECTOR_DB=chroma
SCARF_NO_ANALYTICS=true
DO_NOT_TRACK=true
ANONYMOUS_TELEMETRY=false

# Windows 下指定 Python 路径 (可选)
PYTHON_PATH=C:\Users\用户名\AppData\Local\Programs\Python\Python312\python
```

## 启动流程

### 开发环境

1. **安装 Python 依赖**（首次）：
   ```bash
   cd server/open-webui/backend
   pip install -r requirements.txt
   ```

2. **启动服务**：
   ```bash
   cd server
   npm run dev
   ```

3. **首次启动**：Open WebUI 会从 HuggingFace 下载 embedding 模型，需要 2-5 分钟

### 生产环境 (Docker)

```bash
docker build -t blog-design .
docker run -d \
  --name blog-design \
  -p 8787:8787 -p 3000:3000 \
  -v blog-data:/app/server/db \
  -v blog-uploads:/app/server/public/uploads \
  -v openwebui-data:/app/server/open-webui/backend/data \
  blog-design
```

## 认证流程

1. 用户登录 blog admin → 获取 JWT token
2. 访问 `/cms/workspace` → iframe 加载 `/workbench`
3. Express 中间件 `openWebUIAuth.js`：
   - 验证 blog JWT
   - 调用 Open WebUI API 创建/获取用户
   - 获取 Open WebUI token
4. 代理请求到 Open WebUI，注入 token
5. 用户无需再次登录

## 知识库同步

### 触发时机

- 文档创建/更新/删除时实时触发
- 定时全量同步（通过 cron job）
- 手动触发（管理界面按钮）

### API

```javascript
// 同步单个文档
const { syncDocumentById } = require('./services/kbSync');
await syncDocumentById(docId);

// 全量同步
const { fullSync } = require('./services/kbSync');
await fullSync();
```

## 故障排除

### Open WebUI 启动失败

**现象**: `[OpenWebUI] Failed to start: spawn python ENOENT`

**解决**: 设置 `PYTHON_PATH` 环境变量指向 Python 可执行文件

### 健康检查超时

**现象**: `[OpenWebUI] Health check failed after 120 attempts`

**解决**: 首次启动需要下载模型，等待 2-5 分钟。后续启动会快很多。

### 认证失败

**现象**: 401 Unauthorized on `/workbench`

**解决**: 
1. 检查 blog JWT 是否过期
2. 检查 `JWT_SECRET` 是否配置
3. 查看 Open WebUI 是否正常运行：`GET /workbench/health`

## 升级 Open WebUI

```bash
cd server/open-webui
git fetch origin
git checkout <version-tag>
cd ../..
git add server/open-webui
git commit -m "chore: upgrade Open WebUI to vX.Y.Z"
```

## 回滚

如需回滚到旧版工作台：

1. 恢复 `admin/src/views/workspace/index.vue`
2. 恢复 `admin/src/router/index.ts`
3. 恢复 `server/src/seeds/rbacSeed.js`
4. 移除 `server/src/apps/adminApp.js` 中的代理配置
5. 停止启动 Open WebUI：`server/src/index.js`
