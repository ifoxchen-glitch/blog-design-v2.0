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

// ---- In-memory sync progress tracking ----
let syncProgress = {
  running: false,
  startedAt: null,
  total: 0,
  synced: 0,
  failed: 0,
  currentDoc: null,
  errors: [],
};

function getSyncProgress() {
  return { ...syncProgress };
}

function resetSyncProgress() {
  syncProgress = {
    running: false,
    startedAt: null,
    total: 0,
    synced: 0,
    failed: 0,
    currentDoc: null,
    errors: [],
  };
}

function startSyncProgress(total) {
  syncProgress = {
    running: true,
    startedAt: Date.now(),
    total,
    synced: 0,
    failed: 0,
    currentDoc: null,
    errors: [],
  };
}

function updateSyncProgress(doc, success, error) {
  if (success) {
    syncProgress.synced++;
  } else {
    syncProgress.failed++;
    syncProgress.errors.push({ title: doc.title, id: doc.id, error: error || "unknown" });
  }
  syncProgress.currentDoc = doc.title;
}

function finishSyncProgress() {
  syncProgress.running = false;
  syncProgress.currentDoc = null;
}

function makeRequest(targetPath, method, body, token, timeoutMs = 10000) {
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
    };

    console.log(`[KBSync] ${method} ${targetPath} -> ${cfg.host}:${cfg.port} (timeout ${timeoutMs}ms)`);

    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        clearTimeout(timer);
        console.log(`[KBSync] ${method} ${targetPath} response HTTP ${res.statusCode}`);
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    // Connection-level timeout: abort if socket cannot connect within timeoutMs
    const timer = setTimeout(() => {
      const timeoutErr = new Error(`Connection timeout (${timeoutMs}ms) to ${cfg.host}:${cfg.port}${targetPath}`);
      console.error(`[KBSync] ${method} ${targetPath} timed out`);
      req.destroy(timeoutErr);
      reject(timeoutErr);
    }, timeoutMs);

    req.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[KBSync] ${method} ${targetPath} error: ${err.message}`);
      reject(err);
    });

    if (data) req.write(data);
    req.end();
  });
}

// 测试 Open WebUI 连接
async function testConnection() {
  const cfg = getOpenWebUIConfig();
  const token = getApiKey();
  const results = {
    url: cfg.url,
    host: cfg.host,
    port: cfg.port,
    apiKeyConfigured: token.length > 0,
    apiKeyPrefix: token ? token.substring(0, 4) + "..." : null,
    steps: [],
    ok: false,
  };

  console.log(`[KBSync] Starting connection test to ${cfg.url}`);

  // Step 1: Health check
  console.log("[KBSync] Step 1/4: Health check...");
  try {
    const healthRes = await makeRequest("/health", "GET", null, null);
    results.steps.push({
      name: "health_check",
      status: healthRes.status >= 200 && healthRes.status < 300 ? "ok" : "fail",
      httpStatus: healthRes.status,
      response: typeof healthRes.data === "string" ? healthRes.data.substring(0, 200) : healthRes.data,
    });
  } catch (err) {
    console.error(`[KBSync] Step 1 failed: ${err.message}`);
    // Provide actionable hint for Docker/container environments
    let hint = "";
    const msg = err.message || "";
    if (
      msg.includes("timeout") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("EHOSTUNREACH")
    ) {
      hint = " (提示: 请确保 Open WebUI 地址在容器内可访问。如 blog 运行在 Docker 中，请使用 http://host.docker.internal:8080 或将两容器加入同一自定义网络)";
    }
    results.steps.push({ name: "health_check", status: "fail", error: err.message + hint });
    return results;
  }

  // Step 2: Auth check
  console.log("[KBSync] Step 2/4: Auth check...");
  try {
    const meRes = await makeRequest("/api/v1/auths/me", "GET", null, token);
    const authed = meRes.status >= 200 && meRes.status < 300;
    results.steps.push({
      name: "auth_check",
      status: authed ? "ok" : "fail",
      httpStatus: meRes.status,
      response: typeof meRes.data === "string" ? meRes.data.substring(0, 500) : meRes.data,
    });
    if (!authed) return results;
  } catch (err) {
    console.error(`[KBSync] Step 2 failed: ${err.message}`);
    results.steps.push({ name: "auth_check", status: "fail", error: err.message });
    return results;
  }

  // Step 3: List knowledge bases
  console.log("[KBSync] Step 3/4: List knowledge bases...");
  try {
    const kbRes = await makeRequest("/api/v1/knowledge/", "GET", null, token);
    const kbOk = kbRes.status >= 200 && kbRes.status < 300;
    results.steps.push({
      name: "list_knowledge_bases",
      status: kbOk ? "ok" : "fail",
      httpStatus: kbRes.status,
      count: Array.isArray(kbRes.data?.items) ? kbRes.data.items.length : null,
      response: !kbOk ? (typeof kbRes.data === "string" ? kbRes.data.substring(0, 500) : kbRes.data) : undefined,
    });
  } catch (err) {
    console.error(`[KBSync] Step 3 failed: ${err.message}`);
    results.steps.push({ name: "list_knowledge_bases", status: "fail", error: err.message });
  }

  // Step 4: Test file upload (with a small dummy file)
  console.log("[KBSync] Step 4/4: Test file upload...");
  try {
    const tempDir = "/tmp";
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `kb-test-connection.md`);
    fs.writeFileSync(tempFile, "# Test file for connection diagnostics\n", "utf8");

    const boundary = `----FormBoundary${Date.now()}`;
    const fileContent = fs.readFileSync(tempFile);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.md"\r\nContent-Type: text/markdown\r\n\r\n`),
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
    };

    const uploadRes = await new Promise((resolve, reject) => {
      console.log(`[KBSync] Uploading test file to ${cfg.host}:${cfg.port}/api/v1/files/`);
      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          clearTimeout(uploadTimer);
          console.log(`[KBSync] Upload response HTTP ${res.statusCode}`);
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); }
        });
      });

      // Connection-level timeout for upload (10s)
      const uploadTimer = setTimeout(() => {
        const timeoutErr = new Error(`Upload connection timeout (10000ms) to ${cfg.host}:${cfg.port}`);
        console.error("[KBSync] Upload timed out");
        req.destroy(timeoutErr);
        reject(timeoutErr);
      }, 10000);

      req.on("error", (err) => {
        clearTimeout(uploadTimer);
        console.error(`[KBSync] Upload error: ${err.message}`);
        reject(err);
      });

      req.write(body);
      req.end();
    });

    try { fs.unlinkSync(tempFile); } catch {}

    const uploadOk = uploadRes.status >= 200 && uploadRes.status < 300;
    results.steps.push({
      name: "upload_file",
      status: uploadOk ? "ok" : "fail",
      httpStatus: uploadRes.status,
      fileId: uploadRes.data?.id || null,
      response: !uploadOk ? (typeof uploadRes.data === "string" ? uploadRes.data.substring(0, 500) : uploadRes.data) : undefined,
    });

    // Clean up test file from Open WebUI
    if (uploadOk && uploadRes.data?.id) {
      try {
        await makeRequest(`/api/v1/files/${uploadRes.data.id}`, "DELETE", null, token);
      } catch { /* ignore cleanup failure */ }
    }
  } catch (err) {
    console.error(`[KBSync] Step 4 failed: ${err.message}`);
    results.steps.push({ name: "upload_file", status: "fail", error: err.message });
  }

  results.ok = results.steps.every((s) => s.status === "ok");
  console.log(`[KBSync] Connection test complete. ok=${results.ok}`);
  return results;
}

// 确保知识库集合存在
async function ensureKnowledgeBase(token, kbName = "blog-kb") {
  try {
    const listRes = await makeRequest("/api/v1/knowledge/", "GET", null, token);
    if (listRes.status >= 200 && listRes.status < 300) {
      const items = listRes.data?.items || listRes.data;
      if (Array.isArray(items)) {
        const existing = items.find((kb) => kb.name === kbName);
        if (existing) return existing.id;
      }
    }

    const createRes = await makeRequest(
      "/api/v1/knowledge/create",
      "POST",
      {
        name: kbName,
        description: `Knowledge base: ${kbName}`,
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

// 获取所有知识库列表
async function listKnowledgeBases(token) {
  try {
    const listRes = await makeRequest("/api/v1/knowledge/", "GET", null, token);
    if (listRes.status >= 200 && listRes.status < 300) {
      const items = listRes.data?.items || listRes.data;
      if (Array.isArray(items)) {
        return items.map((kb) => ({ id: kb.id, name: kb.name, description: kb.description || "" }));
      }
    }
    return [];
  } catch (err) {
    console.error("[KBSync] listKnowledgeBases error:", err.message);
    return [];
  }
}

// 上传文件到 Open WebUI 文件系统
async function uploadFileToOpenWebUI(doc, token) {
  try {
    const cfg = getOpenWebUIConfig();
    const tempDir = "/tmp";
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `kb-sync-${doc.id}.md`);
    fs.writeFileSync(tempFile, doc.content_markdown || "", "utf8");

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
async function fullSync(kbName = "blog-kb") {
  resetSyncProgress();

  if (!isConfigured()) {
    console.log("[KBSync] OPEN_WEBUI_API_KEY not configured, skipping sync");
    return { synced: 0, failed: 0, skipped: true, reason: "api_key_not_configured" };
  }

  const token = getApiKey();
  const cfg = getOpenWebUIConfig();
  console.log(`[KBSync] Starting full sync to ${cfg.url} (kb=${kbName})`);

  const knowledgeBaseId = await ensureKnowledgeBase(token, kbName);
  if (!knowledgeBaseId) {
    console.error("[KBSync] Knowledge base not available");
    finishSyncProgress();
    return { synced: 0, failed: 0, kbName };
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

  startSyncProgress(docs.length);

  for (const doc of docs) {
    const result = await syncDocument(doc, knowledgeBaseId, token);
    updateSyncProgress(doc, result.success, result.error || result.status);
    // Write per-document log entry
    try {
      db.prepare(
        `INSERT INTO kb_sync_logs (direction, document_id, file_path, status, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        "export",
        doc.id,
        doc.slug + ".md",
        result.success ? "success" : "error",
        result.fileId ? `file_id=${result.fileId}` : (result.error || result.status || "unknown"),
        nowIso()
      );
    } catch (err) {
      console.error(`[KBSync] Failed to write log for doc ${doc.id}:`, err.message);
    }
  }

  const { synced, failed, errors } = syncProgress;
  finishSyncProgress();

  const detailObj = { synced, failed, total: docs.length, kbName };
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
async function syncDocumentById(docId, kbName = "blog-kb") {
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

  const knowledgeBaseId = await ensureKnowledgeBase(token, kbName);
  if (!knowledgeBaseId) return { success: false, error: "knowledge_base_not_available" };

  const result = await syncDocument(doc, knowledgeBaseId, token);
  // Write per-document log entry
  try {
    db.prepare(
      `INSERT INTO kb_sync_logs (direction, document_id, file_path, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      "export",
      doc.id,
      doc.slug + ".md",
      result.success ? "success" : "error",
      result.fileId ? `file_id=${result.fileId}` : (result.error || result.status || "unknown"),
      nowIso()
    );
  } catch (err) {
    console.error(`[KBSync] Failed to write log for doc ${doc.id}:`, err.message);
  }
  return result;
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
      `/api/v1/knowledge/${knowledgeBaseId}/file/remove`,
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

async function importFromOpenWebUI() {
  const token = getApiKey();
  const knowledgeBaseId = await ensureKnowledgeBase(token);
  if (!knowledgeBaseId) return { success: false, error: 'knowledge_base_not_available' };

  try {
    const listRes = await makeRequest(`/api/v1/knowledge/${knowledgeBaseId}`, 'GET', null, token);
    if (listRes.status < 200 || listRes.status >= 300 || !listRes.data?.files) {
      return { success: false, error: 'failed_to_list_files' };
    }

    const db = openDb();
    let imported = 0, skipped = 0;

    for (const file of listRes.data.files) {
      const slug = file.filename ? file.filename.replace(/\.md$/i, '') : `ow-${file.id}`;
      const existing = db.prepare('SELECT id FROM kb_documents WHERE slug = ?').get(slug);
      
      if (existing) {
        skipped++;
        continue;
      }

      // Download file content
      const contentRes = await makeRequest(`/api/v1/knowledge/${knowledgeBaseId}/file/content`, 'POST', { file_id: file.id }, token);
      const content = contentRes.data?.content || contentRes.data?.text || '';

      const now = nowIso();
      db.prepare(`INSERT INTO kb_documents (slug, title, content, source, source_id, source_type, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, 'openwebui', ?, ?)`)
        .run(slug, file.meta?.name || slug, content, 'openwebui', file.id, now, now);
      imported++;
    }

    console.log(`[KBSync] importFromOpenWebUI: ${imported} imported, ${skipped} skipped`);
    return { success: true, imported, skipped };
  } catch (err) {
    console.error('[KBSync] importFromOpenWebUI error:', err.message);
    return { success: false, error: err.message };
  }
}

// Full sync from a sync source (called by syncSourcesHandlers)
async function fullSyncFromOpenWebUI(source) {
  console.log(`[KBSync] fullSyncFromOpenWebUI for source "${source.name}" (id=${source.id})`);
  const config = typeof source.config === 'string' ? JSON.parse(source.config) : (source.config || {});
  const result = await importFromOpenWebUI();
  
  const db = openDb();
  db.prepare(`INSERT INTO kb_sync_logs (source_id, sync_type, direction, status, result, created_at)
               VALUES (?, 'import', 'import', ?, ?, ?)`)
    .run(source.id, result.success ? 'success' : 'error', JSON.stringify(result), nowIso());

  return result;
}

// ---- Open WebUI Notes sync (bidirectional: /api/v1/notes/ ↔ notes/ directory) ----

function getVaultPath() {
  try {
    const db = openDb();
    const config = db.prepare("SELECT vault_path FROM kb_sync_config WHERE id = 1").get();
    return config?.vault_path || '';
  } catch { return ''; }
}

/**
 * Import: OWUI Notes → local notes/ directory
 * Reads all notes from /api/v1/notes/ and writes them as .md files.
 */
async function importNotesFromOpenWebUI() {
  const token = getApiKey();
  const vaultPath = getVaultPath();
  if (!vaultPath) return { success: false, error: 'vault_path_not_configured' };

  const notesDir = path.join(vaultPath, 'notes');
  fs.mkdirSync(notesDir, { recursive: true });

  const listRes = await makeRequest('/api/v1/notes/', 'GET', null, token);
  if (listRes.status < 200 || listRes.status >= 300) {
    return { success: false, error: 'failed_to_list_notes', detail: listRes.data };
  }

  const db = openDb();
  const logStmt = db.prepare(
    `INSERT INTO kb_sync_logs (direction, file_path, status, detail, sync_type, created_at)
     VALUES ('import', ?, ?, ?, 'notes_sync', ?)`
  );
  const now = nowIso();

  const notes = Array.isArray(listRes.data) ? listRes.data : [];
  let imported = 0, skipped = 0;

  for (const note of notes) {
    const md = note.data?.content?.md || '';
    if (!md.trim()) { skipped++; continue; }

    // Sanitize title to a valid filename
    const safeName = (note.title || `note-${note.id}`)
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `note-${note.id}`;
    const filename = safeName + '.md';
    const filePath = path.join(notesDir, filename);

    // Build frontmatter + body
    const frontmatter = `---\ntitle: ${note.title || ''}\nowui_id: ${note.id}\ncreated_at: ${note.created_at}\nupdated_at: ${note.updated_at}\n---\n\n`;
    const fullContent = frontmatter + md;

    // Skip if already exists and unchanged
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf8');
      if (existing === fullContent) {
        logStmt.run(filename, 'skipped', '内容无变化', now);
        skipped++; continue;
      }
    }

    fs.writeFileSync(filePath, fullContent, 'utf8');
    imported++;
    logStmt.run(filename, 'success', `导入 ${md.length} 字符`, now);
    console.log(`[KBSync] Imported note: ${filename} (${md.length} chars)`);
  }

  // Summary log
  logStmt.run(`notes_import_${now}`, 'success', `导入完成: ${imported} 条导入, ${skipped} 条跳过`, now);

  console.log(`[KBSync] importNotesFromOpenWebUI: ${imported} imported, ${skipped} skipped`);
  return { success: true, imported, skipped };
}

/**
 * Export: local notes/ directory → OWUI Notes
 * NOTE: OWUI Notes API is read-only (all write methods return 405).
 * This function scans the directory and reports the limitation.
 */
async function exportNotesToOpenWebUI() {
  const vaultPath = getVaultPath();
  if (!vaultPath) return { success: false, error: 'vault_path_not_configured' };

  const notesDir = path.join(vaultPath, 'notes');
  if (!fs.existsSync(notesDir)) {
    return { success: true, exported: 0, skipped: 0, note: 'notes_dir_not_found' };
  }

  // Only process files that have owui_id in frontmatter (imported from OWUI)
  const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
  const owuiFiles = files.filter(f => {
    try {
      const content = fs.readFileSync(path.join(notesDir, f), 'utf8');
      return /^---\s*\n[\s\S]*?\nowui_id:/m.test(content);
    } catch { return false; }
  });

  if (owuiFiles.length === 0) return { success: true, exported: 0, skipped: 0, note: 'no_owui_notes_to_export' };

  const db = openDb();
  const logStmt = db.prepare(
    `INSERT INTO kb_sync_logs (direction, file_path, status, detail, sync_type, created_at)
     VALUES ('export', ?, 'skipped', ?, 'notes_sync', ?)`
  );
  const now = nowIso();

  // OWUI Notes API is read-only — log and report
  for (const f of owuiFiles) {
    logStmt.run(f, 'OWUI Notes API 只读，不支持写入', now);
  }

  console.log(`[KBSync] exportNotesToOpenWebUI: ${owuiFiles.length} OWUI notes skipped (API read-only)`);
  return {
    success: false,
    exported: 0,
    skipped: owuiFiles.length,
    errors: files.length,
    note: 'owui_notes_api_read_only',
  };
}

/**
 * Bidirectional sync: import then export
 */
async function fullSyncNotes() {
  console.log('[KBSync] fullSyncNotes starting...');

  const importResult = await importNotesFromOpenWebUI();
  const exportResult = await exportNotesToOpenWebUI();

  return {
    import: importResult,
    export: exportResult,
  };
}

/**
 * Test connection to OWUI Notes API
 */
async function testNotesConnection() {
  const token = getApiKey();
  if (!token) return { ok: false, error: 'api_key_not_configured' };

  const vaultPath = getVaultPath();

  const results = { steps: [], ok: false };

  // Step 1: check vault path
  results.steps.push({
    name: 'vault_path',
    status: vaultPath ? 'ok' : 'fail',
    vaultPath: vaultPath || '(not configured)',
  });
  if (vaultPath) {
    const notesDirExists = require('fs').existsSync(require('path').join(vaultPath, 'notes'));
    results.steps.push({
      name: 'notes_dir',
      status: notesDirExists ? 'ok' : 'warn',
      detail: notesDirExists ? 'notes/ 目录存在' : 'notes/ 目录不存在（将自动创建）',
    });
  }

  // Step 2: call the notes API
  try {
    const listRes = await makeRequest('/api/v1/notes/', 'GET', null, token);
    const httpOk = listRes.status >= 200 && listRes.status < 300;
    results.steps.push({
      name: 'notes_api',
      status: httpOk ? 'ok' : 'fail',
      httpStatus: listRes.status,
      detail: httpOk ? '连接成功' : 'API 返回错误',
      data: !httpOk ? listRes.data : undefined,
    });

    if (httpOk) {
      const notes = Array.isArray(listRes.data) ? listRes.data : [];
      const withContent = notes.filter(n => n.data?.content?.md?.trim());
      results.steps.push({
        name: 'notes_count',
        status: 'ok',
        total: notes.length,
        withContent: withContent.length,
        samples: withContent.slice(0, 3).map(n => ({
          title: n.title,
          contentLength: (n.data?.content?.md || '').length,
        })),
      });
      results.ok = true;
    }
  } catch (err) {
    results.steps.push({
      name: 'notes_api',
      status: 'fail',
      error: err.message,
    });
  }

  return results;
}

module.exports = {
  getApiKey,
  isConfigured,
  fullSync,
  syncDocumentById,
  deleteDocumentFromKB,
  ensureKnowledgeBase,
  testConnection,
  getSyncProgress,
  listKnowledgeBases,
  importFromOpenWebUI,
  fullSyncFromOpenWebUI,
  importNotesFromOpenWebUI,
  exportNotesToOpenWebUI,
  fullSyncNotes,
  testNotesConnection,
};
