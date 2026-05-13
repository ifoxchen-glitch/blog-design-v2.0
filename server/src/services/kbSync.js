/**
 * 知识库单向同步服务
 * 将 blog 的 kb_documents 同步到 Open WebUI 的向量库（Chroma）
 *
 * 使用方法：
 * 1. 在 Open WebUI 页面按 F12 → Console → 输入 localStorage.getItem('token') 获取 JWT Token
 * 2. 在系统设置中配置 Open WebUI API Key（JWT Token 或 API Key）
 * 3. 文档的 CRUD 操作会自动触发同步
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { openDb } = require("../db");
const { nowIso } = require("../utils");

const DEFAULT_HOST = process.env.OPEN_WEBUI_HOST || "127.0.0.1";
const DEFAULT_PORT = parseInt(process.env.OPEN_WEBUI_PORT, 10) || 8080;
const ENV_API_KEY = process.env.OPEN_WEBUI_API_KEY || "";

function getOpenWebUIConfig() {
  // 优先从数据库读取，其次环境变量 OPEN_WEBUI_URL，最后默认 127.0.0.1:8080
  let urlStr = "";
  try {
    const db = openDb();
    const settings = db.prepare("SELECT open_webui_url, open_webui_api_key FROM system_settings WHERE id = 1").get();
    if (settings?.open_webui_url?.trim()) {
      urlStr = settings.open_webui_url.trim();
    }
  } catch { /* ignore */ }

  if (!urlStr) {
    urlStr = process.env.OPEN_WEBUI_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  }

  try {
    const parsed = new URL(urlStr);
    return {
      url: urlStr,
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80),
      protocol: parsed.protocol,
    };
  } catch {
    // fallback if URL is malformed
    return { url: `http://${DEFAULT_HOST}:${DEFAULT_PORT}`, host: DEFAULT_HOST, port: DEFAULT_PORT, protocol: "http:" };
  }
}

function getApiKey() {
  try {
    const db = openDb();
    const settings = db.prepare("SELECT open_webui_api_key FROM system_settings WHERE id = 1").get();
    if (settings?.open_webui_api_key?.trim()) {
      return settings.open_webui_api_key.trim();
    }
  } catch { /* ignore */ }
  return ENV_API_KEY;
}

function isConfigured() {
  return getApiKey().length > 0;
}

function makeRequest(targetPath, method, body, token) {
  const cfg = getOpenWebUIConfig();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: cfg.host,
      port: cfg.port,
      path: targetPath,
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
      reject(new Error(`Request timeout to ${cfg.host}:${cfg.port}`));
    });

    if (data) req.write(data);
    req.end();
  });
}

// 确保知识库集合存在
async function ensureKnowledgeBase(token) {
  try {
    const cfg = getOpenWebUIConfig();
    const listRes = await makeRequest("/api/v1/knowledge/", "GET", null, token);
    if (listRes.status >= 200 && listRes.status < 300) {
      const items = listRes.data?.items || listRes.data;
      if (Array.isArray(items)) {
        const existing = items.find((kb) => kb.name === "blog-kb");
        if (existing) return existing.id;
      }
    }

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

    if (createRes.status >= 200 && createRes.status < 300 && createRes.data?.id) {
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

// 上传文件到 Open WebUI 文件系统
async function uploadFileToOpenWebUI(doc, token) {
  try {
    const cfg = getOpenWebUIConfig();
    const tempDir = path.join(__dirname, "..", "..", "tmp");
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `kb-sync-${doc.id}.md`);
    fs.writeFileSync(tempFile, doc.content_markdown, "utf8");

    const boundary = `----FormBoundary${Date.now()}`;
    const fileContent = fs.readFileSync(tempFile);
    const safeFilename = (doc.slug || `doc-${doc.id}`).replace(/"/g, '\\"') + ".md";

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFilename}"\r\nContent-Type: text/markdown\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: cfg.host,
      port: cfg.port,
      path: "/api/v1/files/",
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
        reject(new Error(`Upload timeout to ${cfg.host}:${cfg.port}`));
      });
      req.write(body);
      req.end();
    });

    try { fs.unlinkSync(tempFile); } catch {}

    if (result.status >= 200 && result.status < 300 && result.data?.id) {
      return { success: true, fileId: result.data.id };
    }

    console.error(`[KBSync] Failed to upload file for doc ${doc.id} (HTTP ${result.status}):`, result.data);
    return { success: false, error: result.data, status: result.status };
  } catch (err) {
    console.error(`[KBSync] uploadFileToOpenWebUI error ${doc.id}:`, err.message);
    return { success: false, error: err.message };
  }
}

// 将文件添加到知识库
async function addFileToKnowledgeBase(fileId, knowledgeBaseId, token) {
  try {
    const result = await makeRequest(
      `/api/v1/knowledge/${knowledgeBaseId}/file/add`,
      "POST",
      { file_id: fileId },
      token
    );

    if (result.status >= 200 && result.status < 300) {
      return { success: true };
    }

    const detail = typeof result.data?.detail === "string" ? result.data.detail : JSON.stringify(result.data);
    if (detail && (detail.includes("Duplicate") || detail.includes("already exists") || detail.includes("already in"))) {
      console.log(`[KBSync] File ${fileId} already exists in knowledge base, skipping`);
      return { success: true, skipped: true };
    }

    console.error(`[KBSync] Failed to add file ${fileId} to knowledge base:`, result.data);
    return { success: false, error: result.data };
  } catch (err) {
    console.error(`[KBSync] addFileToKnowledgeBase error:`, err.message);
    return { success: false, error: err.message };
  }
}

// 同步单个文档
async function syncDocument(doc, knowledgeBaseId, token) {
  try {
    const uploadResult = await uploadFileToOpenWebUI(doc, token);
    if (!uploadResult.success) {
      return uploadResult;
    }

    const addResult = await addFileToKnowledgeBase(uploadResult.fileId, knowledgeBaseId, token);
    if (addResult.success) {
      console.log(`[KBSync] Synced document: ${doc.title} (${doc.id})`);
      return { success: true, fileId: uploadResult.fileId };
    }

    return addResult;
  } catch (err) {
    console.error(`[KBSync] syncDocument error ${doc.id}:`, err.message);
    return { success: false, error: err.message };
  }
}

// 全量同步
async function fullSync() {
  if (!isConfigured()) {
    console.log("[KBSync] OPEN_WEBUI_API_KEY not configured, skipping sync");
    return { synced: 0, failed: 0, skipped: true, reason: "api_key_not_configured" };
  }

  const token = getApiKey();
  const cfg = getOpenWebUIConfig();
  console.log(`[KBSync] Starting full sync to ${cfg.url}`);

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

  const errors = [];
  for (const doc of docs) {
    const result = await syncDocument(doc, knowledgeBaseId, token);
    if (result.success) {
      synced++;
    } else {
      failed++;
      errors.push({ title: doc.title, id: doc.id, error: result.error || result.status || "unknown" });
    }
  }

  const detailObj = { synced, failed, total: docs.length };
  if (errors.length > 0) {
    detailObj.errors = errors.slice(0, 5);
  }
  try {
    db.prepare(
      `INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      "export",
      "openwebui-kb",
      failed === 0 ? "success" : "error",
      JSON.stringify(detailObj),
      nowIso()
    );
  } catch (err) {
    console.error("[KBSync] Failed to write sync log:", err.message);
  }

  console.log(`[KBSync] Full sync complete: ${synced} synced, ${failed} failed, ${docs.length} total`);
  return { synced, failed, total: docs.length, errors: errors.length > 0 ? errors : undefined };
}

// 实时同步单个文档（在文档创建/更新时调用）
async function syncDocumentById(docId) {
  if (!isConfigured()) {
    console.log("[KBSync] OPEN_WEBUI_API_KEY not configured, skipping real-time sync");
    return { success: false, skipped: true, reason: "api_key_not_configured" };
  }
  const token = getApiKey();

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
    return { success: false, error: "document_not_found_or_inactive" };
  }

  const knowledgeBaseId = await ensureKnowledgeBase(token);
  if (!knowledgeBaseId) return { success: false, error: "knowledge_base_not_available" };

  return await syncDocument(doc, knowledgeBaseId, token);
}

// 从 Open WebUI 知识库中删除文档
async function deleteDocumentFromKB(docId) {
  if (!isConfigured()) {
    console.log("[KBSync] OPEN_WEBUI_API_KEY not configured, skipping delete sync");
    return { success: false, skipped: true, reason: "api_key_not_configured" };
  }

  const token = getApiKey();
  const knowledgeBaseId = await ensureKnowledgeBase(token);
  if (!knowledgeBaseId) return { success: false, error: "knowledge_base_not_available" };

  try {
    const listRes = await makeRequest(`/api/v1/knowledge/${knowledgeBaseId}`, "GET", null, token);
    if (listRes.status < 200 || listRes.status >= 300 || !listRes.data?.files) {
      return { success: false, error: "failed_to_list_files" };
    }

    const db = openDb();
    const doc = db.prepare("SELECT slug FROM kb_documents WHERE id = ?").get(docId);
    if (!doc) return { success: false, error: "document_not_found" };

    const targetFile = listRes.data.files.find(f => f.filename === `${doc.slug}.md` || f.meta?.name === doc.slug);
    if (!targetFile) {
      console.log(`[KBSync] Document ${docId} not found in knowledge base, nothing to delete`);
      return { success: true, skipped: true };
    }

    const deleteRes = await makeRequest(
      `/api/v1/knowledge/${knowledgeBaseId}/file/delete`,
      "POST",
      { file_id: targetFile.id },
      token
    );

    if (deleteRes.status >= 200 && deleteRes.status < 300) {
      console.log(`[KBSync] Deleted document ${docId} from knowledge base`);
      return { success: true };
    }

    console.error(`[KBSync] Failed to delete document ${docId}:`, deleteRes.data);
    return { success: false, error: deleteRes.data };
  } catch (err) {
    console.error(`[KBSync] deleteDocumentFromKB error ${docId}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getApiKey,
  isConfigured,
  fullSync,
  syncDocumentById,
  deleteDocumentFromKB,
  ensureKnowledgeBase,
};
