/**
 * 知识库单向同步服务
 * 将 blog 的 kb_documents 同步到 Open WebUI 的向量库（Chroma）
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { openDb } = require("../db");
const { nowIso } = require("../utils");

const OPEN_WEBUI_PORT = parseInt(process.env.OPEN_WEBUI_PORT, 10) || 8080;
const OPEN_WEBUI_HOST = process.env.OPEN_WEBUI_HOST || "127.0.0.1";
const OPEN_WEBUI_URL = `http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`;

// Open WebUI 内部 API token（需要 admin 权限）
// 实际使用时，应在 Open WebUI 启动后通过 API 获取
let adminToken = null;

function getAdminToken() {
  return adminToken;
}

function setAdminToken(token) {
  adminToken = token;
}

function makeRequest(path, method, body, token) {
  return new Promise((resolve, reject) =>> {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: OPEN_WEBUI_HOST,
      port: OPEN_WEBUI_PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (data) req.write(data);
    req.end();
  });
}

// 确保知识库集合存在
async function ensureKnowledgeBase(token) {
  try {
    // 查询现有知识库
    const listRes = await makeRequest("/api/v1/knowledge/", "GET", null, token);
    if (listRes.status === 200 && Array.isArray(listRes.data)) {
      const existing = listRes.data.find((kb) => kb.name === "blog-kb");
      if (existing) return existing.id;
    }

    // 创建新知识库
    const createRes = await makeRequest(
      "/api/v1/knowledge/create",
      "POST",
      {
        name: "blog-kb",
        description: "Blog knowledge base documents",
        data: {},
      },
      token
    );

    if (createRes.status === 200 && createRes.data?.id) {
      console.log(`[KBSync] Created knowledge base: ${createRes.data.id}`);
      return createRes.data.id;
    }

    console.error("[KBSync] Failed to create knowledge base:", createRes.data);
    return null;
  } catch (err) {
    console.error("[KBSync] ensureKnowledgeBase error:", err.message);
    return null;
  }
}

// 同步单个文档
async function syncDocument(doc, knowledgeBaseId, token) {
  try {
    // 将文档内容写入临时文件
    const tempDir = path.join(__dirname, "..", "..", "tmp");
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `kb-sync-${doc.id}.md`);
    fs.writeFileSync(tempFile, doc.content_markdown, "utf8");

    // 构建文件上传请求（使用 multipart/form-data）
    const boundary = `----FormBoundary${Date.now()}`;
    const fileContent = fs.readFileSync(tempFile);
    const metadata = JSON.stringify({
      name: doc.title,
      description: doc.excerpt || "",
      tags: doc.tags,
    });

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${doc.slug}.md"\r\nContent-Type: text/markdown\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${metadata}\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: OPEN_WEBUI_HOST,
      port: OPEN_WEBUI_PORT,
      path: `/api/v1/knowledge/${knowledgeBaseId}/file/add`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
      timeout: 60000,
    };

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Upload timeout"));
      });
      req.write(body);
      req.end();
    });

    // 清理临时文件
    try { fs.unlinkSync(tempFile); } catch {}

    if (result.status === 200) {
      console.log(`[KBSync] Synced document: ${doc.title} (${doc.id})`);
      return { success: true, fileId: result.data?.id };
    }

    console.error(`[KBSync] Failed to sync document ${doc.id}:`, result.data);
    return { success: false, error: result.data };
  } catch (err) {
    console.error(`[KBSync] syncDocument error ${doc.id}:`, err.message);
    return { success: false, error: err.message };
  }
}

// 全量同步
async function fullSync() {
  const token = getAdminToken();
  if (!token) {
    console.log("[KBSync] No admin token available, skipping sync");
    return { synced: 0, failed: 0 };
  }

  const knowledgeBaseId = await ensureKnowledgeBase(token);
  if (!knowledgeBaseId) {
    console.error("[KBSync] Knowledge base not available");
    return { synced: 0, failed: 0 };
  }

  const db = openDb();
  const docs = db
    .prepare(
      `SELECT id, title, slug, excerpt, content_markdown, tags, status, updated_at
       FROM kb_documents
       WHERE status = 'active'
       ORDER BY updated_at DESC`
    )
    .all();

  let synced = 0;
  let failed = 0;

  for (const doc of docs) {
    const result = await syncDocument(doc, knowledgeBaseId, token);
    if (result.success) {
      synced++;
    } else {
      failed++;
    }
  }

  // 记录同步日志
  try {
    db.prepare(
      `INSERT INTO kb_sync_logs (action, details, created_at)
       VALUES (?, ?, ?)`
    ).run(
      "full_sync",
      JSON.stringify({ synced, failed, total: docs.length }),
      nowIso()
    );
  } catch (err) {
    console.error("[KBSync] Failed to write sync log:", err.message);
  }

  console.log(`[KBSync] Full sync complete: ${synced} synced, ${failed} failed, ${docs.length} total`);
  return { synced, failed, total: docs.length };
}

// 实时同步单个文档（在文档创建/更新时调用）
async function syncDocumentById(docId) {
  const token = getAdminToken();
  if (!token) {
    console.log("[KBSync] No admin token available, skipping real-time sync");
    return false;
  }

  const db = openDb();
  const doc = db
    .prepare(
      `SELECT id, title, slug, excerpt, content_markdown, tags, status, updated_at
       FROM kb_documents
       WHERE id = ?`
    )
    .get(docId);

  if (!doc || doc.status !== "active") {
    console.log(`[KBSync] Document ${docId} not found or not active`);
    return false;
  }

  const knowledgeBaseId = await ensureKnowledgeBase(token);
  if (!knowledgeBaseId) return false;

  const result = await syncDocument(doc, knowledgeBaseId, token);
  return result.success;
}

module.exports = {
  getAdminToken,
  setAdminToken,
  fullSync,
  syncDocumentById,
  ensureKnowledgeBase,
};
