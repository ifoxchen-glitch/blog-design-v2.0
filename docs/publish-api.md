# Publish API 接口文档

> 用于外部系统（如脚本、自动化工具、Agent）通过 API Key 向博客和知识库发布内容。
>
> 基础地址：`http://192.168.3.100:8787/api/v2/publish`

---

## 认证方式

所有 Publish API 接口均需要 API Key 认证。

### 传递方式（二选一）

| 方式 | 示例 |
|------|------|
| **Header**（推荐） | `X-API-Key: Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl` |
| **Query 参数** | `?api_key=Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl` |

### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| 503 | `{"error":"api_key_not_configured"}` | 后台未配置 Publish API Key |
| 503 | `{"error":"api_key_disabled"}` | API Key 功能未启用 |
| 401 | `{"error":"invalid_api_key"}` | API Key 错误或缺失 |

### 后台配置

1. 登录管理后台 `http://192.168.3.100:3000`
2. 进入 **系统设置**
3. 找到 **Publish API** 配置项
4. 填入 API Key 并启用开关

或者通过数据库直接配置：

```sql
UPDATE system_settings
SET publish_api_key = 'Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl',
    publish_api_key_enabled = 1
WHERE id = 1;
```

---

## 编码注意事项（中文内容）

**问题**：在 Windows 终端使用 curl 的 `-d '{"title":"中文"}'` 内联 JSON 时，中文字符可能出现乱码（如 `���Բ�������`）。

**原因**：Windows shell（bash / CMD / PowerShell）对命令行内的多字节字符编码处理不一致，导致发送给服务器的 JSON 实际为 GBK 编码，而服务器按 UTF-8 解码。

### 推荐方案

**方案一：JSON 文件 + `--data-binary`（最可靠）**

将请求体保存为 UTF-8 编码的 `.json` 文件：

```bash
curl -X POST "http://192.168.3.100:8787/api/v2/publish/blog" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-API-Key: Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl" \
  --data-binary @article.json
```

**方案二：PowerShell + `chcp 65001`**

```powershell
chcp 65001
curl -X POST "http://192.168.3.100:8787/api/v2/publish/blog" `
  -H "Content-Type: application/json; charset=utf-8" `
  -H "X-API-Key: Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl" `
  --data-binary "@article.json"
```

**方案三：编程语言调用（脚本/自动化场景推荐）**

用脚本语言构造请求体，彻底规避 shell 编码问题：

**Python：**
```python
import requests

requests.post(
    "http://192.168.3.100:8787/api/v2/publish/blog",
    headers={
        "Content-Type": "application/json; charset=utf-8",
        "X-API-Key": "Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl"
    },
    json={
        "title": "中文标题",
        "contentMarkdown": "# 中文正文\n\n内容...",
        "tags": ["中文标签"],
        "status": "published"
    }
)
```

**Node.js：**
```javascript
fetch("http://192.168.3.100:8787/api/v2/publish/blog", {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "X-API-Key": "Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl"
  },
  body: JSON.stringify({
    title: "中文标题",
    contentMarkdown: "# 中文正文\n\n内容...",
    tags: ["中文标签"],
    status: "published"
  })
});
```

---

## 接口一：发布博客文章

```
POST /api/v2/publish/blog
```

将内容发布为博客文章。支持自动创建不存在的标签和分类。

### 请求头

| 字段 | 值 |
|------|-----|
| Content-Type | `application/json` |
| X-API-Key | 你的 API Key |

### 请求参数（JSON Body）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | ✅ | - | 文章标题 |
| `contentMarkdown` | string | ✅ | - | Markdown 格式正文 |
| `slug` | string | ❌ | 由 title 自动生成 | URL 别名（唯一标识） |
| `excerpt` | string | ❌ | `""` | 文章摘要/导语 |
| `coverImageUrl` | string | ❌ | `""` | 封面图 URL |
| `tags` | string[] | ❌ | `[]` | 标签名称数组。不存在的标签会自动创建 |
| `categories` | string[] | ❌ | `[]` | 分类名称数组。不存在的分类会自动创建 |
| `status` | string | ❌ | `"draft"` | 文章状态：`published`（立即发布）或 `draft`（草稿） |

### 请求示例

```bash
curl -X POST "http://192.168.3.100:8787/api/v2/publish/blog" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-API-Key: Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl" \
  --data-binary @article.json
```

其中 `article.json` 为 UTF-8 编码的 JSON 文件：

```json
{
    "title": "向量数据库选型实战",
    "slug": "vector-database-selection",
    "excerpt": "本文对比 Chroma、Pinecone、Weaviate、Milvus、Qdrant 五款向量数据库的适用场景与性能表现。",
    "contentMarkdown": "# 向量数据库选型实战\n\n## 概述\n\n搭建 RAG 系统时，向量数据库是核心基础设施...",
    "coverImageUrl": "https://example.com/cover.png",
    "tags": ["RAG", "向量数据库", "AI"],
    "categories": ["技术", "AI"],
    "status": "published"
}
```

### 成功响应（201）

```json
{
  "code": 201,
  "message": "success",
  "data": {
    "postId": 35,
    "slug": "vector-database-selection",
    "wordCount": 1280
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `postId` | number | 创建的文章 ID |
| `slug` | string | 实际使用的 URL 别名（若传入的 slug 已存在会自动加序号） |
| `wordCount` | number | 自动计算的正文字数 |

### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| 400 | `{"error":"title and contentMarkdown are required"}` | 缺少必填字段 |
| 401 | `{"error":"invalid_api_key"}` | API Key 无效 |
| 503 | `{"error":"api_key_not_configured"}` | API Key 未配置 |

---

## 接口二：发布知识库文档

```
POST /api/v2/publish/kb
```

将内容发布为知识库（KB）文档。支持设置文档类型、成熟度、关联关系等元数据。

### 请求头

| 字段 | 值 |
|------|-----|
| Content-Type | `application/json` |
| X-API-Key | 你的 API Key |

### 请求参数（JSON Body）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | ✅ | - | 文档标题 |
| `contentMarkdown` | string | ✅ | - | Markdown 格式正文 |
| `slug` | string | ❌ | 由 title 自动生成 | URL 别名（唯一标识） |
| `excerpt` | string | ❌ | `""` | 文档摘要 |
| `contentHtml` | string | ❌ | `contentMarkdown` | HTML 渲染内容。不传则使用 Markdown 原文 |
| `category` | string | ❌ | `null` | 文档分类 |
| `doc_type` | string | ❌ | `"concept"` | 文档类型：`entity` / `concept` / `source` / `synthesis` |
| `connections` | string[] | ❌ | `[]` | 关联文档名称数组（如 `["另一篇文档"]`） |
| `sources` | string[] | ❌ | `[]` | 来源引用数组 |
| `doc_date` | string | ❌ | `null` | 文档日期（ISO 格式，如 `2026-05-23`） |
| `review_status` | string | ❌ | `"seed"` | 成熟度：`seed`（种子期）/ `developing`（发展中）/ `mature`（成熟） |
| `tags` | string[] | ❌ | `[]` | 标签数组 |
| `status` | string | ❌ | `"active"` | 文档状态：`active`（活跃）或 `archived`（已归档） |

### 文档类型说明

| 类型 | 含义 | 适用场景 |
|------|------|----------|
| `entity` | 实体 | 人物、组织、产品等具体对象 |
| `concept` | 概念 | 抽象概念、方法论、理论 |
| `source` | 来源 | 原始资料、参考文献、数据源 |
| `synthesis` | 综合 | 综述、总结、整合性文章 |

### 成熟度说明

| 状态 | 含义 |
|------|------|
| `seed` | 种子期：刚创建，内容初步 |
| `developing` | 发展中：内容在持续完善 |
| `mature` | 成熟：内容已完善，可信赖 |

### 请求示例

```bash
curl -X POST "http://192.168.3.100:8787/api/v2/publish/kb" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-API-Key: Sdh7zniMeEbBgZQ9Dfs8EH7fHvxcWUEl" \
  --data-binary @article.json
```

其中 `article.json` 为 UTF-8 编码的 JSON 文件：

```json
{
    "title": "RAG 系统架构设计",
    "slug": "rag-system-architecture",
    "excerpt": "从零搭建生产级 RAG 系统的完整架构设计与最佳实践。",
    "contentMarkdown": "# RAG 系统架构设计\n\n## 核心组件\n\n1. **文档加载器**\n2. **文本分割器**\n3. **Embedding 模型**\n4. **向量数据库**\n5. **重排序器**\n6. **大语言模型**\n\n## 数据流...",
    "category": "AI 工程",
    "doc_type": "synthesis",
    "review_status": "developing",
    "tags": ["RAG", "LLM", "系统架构"],
    "connections": ["向量数据库选型实战"],
    "status": "active"
}
```

### 成功响应（201）

```json
{
  "code": 201,
  "message": "success",
  "data": {
    "documentId": 1205,
    "slug": "rag-system-architecture",
    "wordCount": 2150
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `documentId` | number | 创建的文档 ID |
| `slug` | string | 实际使用的 URL 别名（若已存在会自动加序号） |
| `wordCount` | number | 自动计算的正文字数 |

### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| 400 | `{"error":"title and contentMarkdown are required"}` | 缺少必填字段 |
| 401 | `{"error":"invalid_api_key"}` | API Key 无效 |
| 503 | `{"error":"api_key_not_configured"}` | API Key 未配置 |

---

## 通用说明

### Slug 生成规则

- 若未传入 `slug`，则根据 `title` 自动生成为 URL 友好的格式（如 `RAG 系统架构设计` → `rag-xi-tong-jia-gou-she-ji`）
- 若传入的 `slug` 已存在，系统会自动追加序号（如 `my-post` → `my-post-1`）

### 字数统计

- 按空格分词统计（英文词）
- 中文按字符统计（每个中文字符计为一个词）

### 与 admin API 的区别

| 对比项 | Publish API | Admin API (`/api/v2/admin/*`) |
|--------|-------------|-------------------------------|
| 认证方式 | API Key | JWT Bearer Token |
| 适用场景 | 外部脚本、自动化、Agent | 管理后台人工操作 |
| 功能范围 | 仅发布（创建） | 完整的 CRUD |
| 权限粒度 | 统一控制 | RBAC 细粒度权限 |

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `server/src/apps/publishApi.js` | 路由定义 |
| `server/src/apps/admin/kb/publishApiHandlers.js` | 业务逻辑 |
| `server/src/middleware/publishApiKey.js` | API Key 认证中间件 |
| `server/src/index.js` | `frontApp.use("/api/v2/publish", publishApi)` 挂载点 |
