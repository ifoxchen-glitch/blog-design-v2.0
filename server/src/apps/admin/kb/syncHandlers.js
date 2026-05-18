const fs = require("fs");
const path = require("path");
const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");
const syncEngine = require("./syncEngine");
const kbSync = require("../../../services/kbSync");

const CONTENT_DIRS = syncEngine.CONTENT_DIRS || ['wiki', 'notes'];

function hasContentDir(vaultPath) {
  return CONTENT_DIRS.some(d => fs.existsSync(path.join(vaultPath, d)));
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function auditLog(db, req, action, resourceId, detail, resourceType) {
  try {
    db.prepare(
      "INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, detail, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      req?.user?.userId ?? null,
      req?.user?.username ?? "system",
      action,
      resourceType || "kb_sync",
      String(resourceId ?? ""),
      detail ?? null,
      req?.ip || null,
      req?.headers?.["user-agent"] || null,
      nowIso(),
    );
  } catch {
    // audit log failure should not break the main operation
  }
}

function getSyncConfig(_req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  res.json({
    code: 200,
    data: config
      ? {
          vault_path: config.vault_path,
          auto_sync_enabled: !!config.auto_sync_enabled,
          sync_interval_minutes: config.sync_interval_minutes,
          conflict_strategy: config.conflict_strategy,
          last_sync_at: config.last_sync_at,
          selected_paths: parseJsonArray(config.selected_paths),
        }
      : null,
  });
}

function updateSyncConfig(req, res) {
  const db = openDb();
  const now = nowIso();
  const {
    vault_path, auto_sync_enabled, sync_interval_minutes, conflict_strategy, selected_paths,
  } = req.body || {};

  const existing = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  if (!existing) {
    return res.status(500).json({ code: 500, message: "同步配置行不存在" });
  }

  const updates = {
    vault_path: vault_path ?? existing.vault_path,
    auto_sync_enabled: auto_sync_enabled !== undefined ? (auto_sync_enabled ? 1 : 0) : existing.auto_sync_enabled,
    sync_interval_minutes: sync_interval_minutes ?? existing.sync_interval_minutes,
    conflict_strategy: conflict_strategy ?? existing.conflict_strategy,
    selected_paths: selected_paths !== undefined ? JSON.stringify(selected_paths) : existing.selected_paths,
    updated_at: now,
  };

  db.prepare(
    `UPDATE kb_sync_config SET vault_path=?, auto_sync_enabled=?, sync_interval_minutes=?, conflict_strategy=?, selected_paths=?, updated_at=? WHERE id=1`,
  ).run(
    updates.vault_path,
    updates.auto_sync_enabled,
    updates.sync_interval_minutes,
    updates.conflict_strategy,
    updates.selected_paths,
    updates.updated_at,
  );

  // Reload cron schedule
  try {
    require("../../../jobs/kbSync").restartSchedule();
  } catch {
    // cron module may not have been loaded yet — ignore
  }

  auditLog(db, req, "update_config", "1", "更新同步配置");

  res.json({ code: 200, message: "已更新", data: updates });
}

async function triggerImport(req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  if (!config || !config.vault_path) {
    return res.status(400).json({ code: 400, message: "请先配置仓库路径 (vault_path)" });
  }

  if (syncEngine.isRunning()) {
    return res.status(409).json({ code: 409, message: "同步正在进行中" });
  }

  // Respond immediately, run sync async
  auditLog(db, req, "trigger_import", config.vault_path, "触发文件系统同步");
  res.status(202).json({ code: 202, message: "同步已启动 (文件系统)", data: { status: "started" } });

  try {
    const selected = parseJsonArray(config.selected_paths);
    await syncEngine.fullImport(config.vault_path, config.conflict_strategy || "last_write_wins", selected.length > 0 ? selected : null);
  } catch (err) {
    console.error("[kb-sync] import failed:", err.message);
    try {
      const db2 = openDb();
      const now2 = nowIso();
      db2.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", config.vault_path, "error", `导入失败: ${err.message}`, now2);
    } catch { /* ignore */ }
  }
}

async function triggerExport(req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  if (!config || !config.vault_path) {
    return res.status(400).json({ code: 400, message: "请先配置仓库路径 (vault_path)" });
  }

  if (syncEngine.isRunning()) {
    return res.status(409).json({ code: 409, message: "同步正在进行中" });
  }

  // Validate at least one content directory exists
  if (!hasContentDir(config.vault_path)) {
    return res.status(400).json({ code: 400, message: `仓库路径下未找到 ${CONTENT_DIRS.join('/')} 子目录，请先创建或导入数据` });
  }

  auditLog(db, req, "trigger_export", config.vault_path, "触发平台→Obsidian导出");
  res.status(202).json({ code: 202, message: "导出已启动", data: { status: "started" } });

  try {
    const selected = parseJsonArray(config.selected_paths);
    await syncEngine.fullExport(config.vault_path, selected.length > 0 ? selected : null);
  } catch (err) {
    console.error("[kb-sync] export failed:", err.message);
    try {
      const db2 = openDb();
      const now2 = nowIso();
      db2.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("export", config.vault_path, "error", `导出失败: ${err.message}`, now2);
    } catch { /* ignore */ }
  }
}

function listSyncLogs(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const offset = (page - 1) * pageSize;
  const since = req.query.since;

  let where = "WHERE 1=1";
  const params = [];
  if (req.query.direction) {
    where += " AND direction = ?";
    params.push(req.query.direction);
  }
  if (req.query.status) {
    where += " AND status = ?";
    params.push(req.query.status);
  }
  if (since) {
    where += " AND created_at > ?";
    params.push(since);
  }

  const total = db.prepare(`SELECT COUNT(*) AS c FROM kb_sync_logs ${where}`).get(...params).c;
  const items = db
    .prepare(`SELECT * FROM kb_sync_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  res.json({ code: 200, data: { items, total, page, pageSize } });
}

function getSyncStatus(_req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();

  let lastResult = null;
  if (config && config.last_sync_at) {
    const logs = db
      .prepare("SELECT direction, status, COUNT(*) AS c FROM kb_sync_logs WHERE created_at = ? GROUP BY direction, status")
      .all(config.last_sync_at);
    if (logs.length > 0) {
      lastResult = {
        imported: 0,
        skipped: 0,
        conflicted: 0,
        errors: 0,
        exported: 0,
        export_skipped: 0,
        export_failed: 0,
      };
      for (const row of logs) {
        if (row.direction === "export") {
          if (row.status === "success") lastResult.exported += row.c;
          else if (row.status === "skipped") lastResult.export_skipped += row.c;
          else if (row.status === "error") lastResult.export_failed += row.c;
          else if (row.status === "conflict") lastResult.export_skipped += row.c;
        } else {
          if (row.status === "success") lastResult.imported += row.c;
          else if (row.status === "skipped") lastResult.skipped += row.c;
          else if (row.status === "conflict") lastResult.conflicted += row.c;
          else if (row.status === "error") lastResult.errors += row.c;
        }
      }
    }
  }

  res.json({
    code: 200,
    data: {
      running: syncEngine.isRunning(),
      last_sync_at: config?.last_sync_at || null,
      last_result: lastResult,
    },
  });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function testFilesystem(req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  const vaultPath = config?.vault_path || req.body?.vault_path;
  const now = nowIso();

  if (!vaultPath) {
    return res.status(400).json({ code: 400, message: "请先配置仓库路径" });
  }

  try {
    const resolved = path.resolve(vaultPath);
    if (!fs.existsSync(resolved)) {
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", vaultPath, "error", `路径不存在: ${resolved}`, now);
      return res.json({ code: 200, data: { ok: false, message: `路径不存在: ${resolved}`, path: resolved } });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", vaultPath, "error", "路径不是目录", now);
      return res.json({ code: 200, data: { ok: false, message: "路径不是目录", path: resolved } });
    }

    // Validate at least one content directory exists
    const foundDirs = CONTENT_DIRS.filter(d => fs.existsSync(path.join(resolved, d)));
    if (foundDirs.length === 0) {
      const detail = `路径下未找到 ${CONTENT_DIRS.join('/')} 子目录: ${resolved}`;
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", vaultPath, "error", detail, now);
      return res.json({ code: 200, data: { ok: false, message: detail, path: resolved } });
    }

    // Scan for .md files in all content directories
    let mdCount = 0;
    let totalSize = 0;
    function walk(dir, depth) {
      if (depth > 20) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full, depth + 1); }
        else if (e.isFile() && e.name.endsWith(".md")) {
          try {
            const st = fs.statSync(full);
            if (st.size <= MAX_FILE_SIZE) { mdCount++; totalSize += st.size; }
          } catch { /* skip */ }
        }
      }
    }
    for (const dir of foundDirs) walk(path.join(resolved, dir), 0);

    const detail = `连接成功: 找到 ${mdCount} 个 .md 文件 (${(totalSize / 1024 / 1024).toFixed(1)} MB)`;
    db.prepare(
      "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("import", vaultPath, "success", detail, now);

    auditLog(db, req, "test_filesystem", vaultPath, detail);

    res.json({
      code: 200,
      data: { ok: true, message: detail, path: resolved, mdCount, totalSize },
    });
  } catch (err) {
    db.prepare(
      "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("import", vaultPath, "error", err.message, now);
    res.json({ code: 200, data: { ok: false, message: err.message, path: vaultPath } });
  }
}

function getRemoteFiles(_req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();

  try {
    let files = [];

    if (config && config.vault_path) {
      const vaultPath = path.resolve(config.vault_path);
      // Use checksum scan so frontend can compare with synced files
      files = syncEngine.scanVaultChecksums(vaultPath);
    }

    const tree = syncEngine.buildFileTree(files);
    res.json({ code: 200, data: { source: "filesystem", tree, fileCount: files.length } });
  } catch (err) {
    res.json({ code: 200, data: { source: "filesystem", tree: [], fileCount: 0, error: err.message } });
  }
}

function getSyncedFiles(_req, res) {
  const db = openDb();

  const docs = db
    .prepare("SELECT id, title, original_path, checksum, status, word_count, updated_at FROM kb_documents WHERE source = 'obsidian' ORDER BY original_path")
    .all();

  // Cross-reference with latest sync log for per-file status
  const logMap = {};
  const logs = db.prepare(
    "SELECT file_path, status, detail FROM kb_sync_logs WHERE id IN (SELECT MAX(id) FROM kb_sync_logs WHERE direction = 'import' GROUP BY file_path)",
  ).all();
  for (const l of logs) {
    logMap[l.file_path] = { status: l.status, detail: l.detail };
  }

  const files = docs.map((d) => ({
    relativePath: d.original_path || `untitled-${d.id}.md`,
    size: 0,
    documentId: d.id,
    title: d.title,
    status: logMap[d.original_path]?.status === "success"
      ? "synced"
      : logMap[d.original_path]?.status === "skipped"
        ? "skipped"
        : logMap[d.original_path]?.status === "conflict"
          ? "conflict"
          : logMap[d.original_path]?.status === "error"
            ? "error"
            : "synced",
    syncedAt: d.updated_at,
    checksum: d.checksum,
    detail: logMap[d.original_path]?.detail || null,
  }));

  const tree = syncEngine.buildFileTree(files);
  res.json({
    code: 200,
    data: {
      source: "obsidian",
      tree,
      fileCount: docs.length,
      stats: {
        total: docs.length,
        active: docs.filter((d) => d.status === "active").length,
        archived: docs.filter((d) => d.status === "archived").length,
      },
    },
  });
}

function clearSyncedData(req, res) {
  const db = openDb();
  const docResult = db.prepare("DELETE FROM kb_documents WHERE source = 'obsidian'").run();
  const logResult = db.prepare("DELETE FROM kb_sync_logs").run();
  db.prepare("UPDATE kb_sync_config SET last_sync_at = NULL, updated_at = ? WHERE id = 1").run(nowIso());

  auditLog(db, req, "clear_synced", "obsidian", `清空同步数据: ${docResult.changes} 个文档, ${logResult.changes} 条日志`);

  res.json({ code: 200, message: "已清空", data: { documentsDeleted: docResult.changes, logsDeleted: logResult.changes } });
}

// Open WebUI 知识库同步状态
function getOpenWebUIStatus(_req, res) {
  const db = openDb();
  const settings = db.prepare("SELECT open_webui_api_key, open_webui_url FROM system_settings WHERE id = 1").get();

  res.json({
    code: 200,
    data: {
      configured: !!settings?.open_webui_api_key?.trim(),
      api_key_set: !!settings?.open_webui_api_key?.trim(),
      open_webui_url: settings?.open_webui_url || process.env.OPEN_WEBUI_URL || `http://${process.env.OPEN_WEBUI_HOST || "192.168.3.100"}:${process.env.OPEN_WEBUI_PORT || 8080}`,
    },
  });
}

// 触发全量同步到 Open WebUI
async function triggerOpenWebUISync(req, res) {
  const db = openDb();
  const kbName = req.body?.kbName || "blog-kb";

  if (!kbSync.isConfigured()) {
    return res.status(400).json({
      code: 400,
      message: "未配置 OPEN_WEBUI_API_KEY，请在环境变量中设置",
    });
  }

  auditLog(db, req, "trigger_openwebui_sync", null, `触发 Open WebUI 知识库全量同步 (目标: ${kbName})`);
  res.status(202).json({ code: 202, message: "同步已启动", data: { status: "started" } });

  try {
    const result = await kbSync.fullSync(kbName);
    console.log("[SyncHandler] Open WebUI full sync complete:", result);
  } catch (err) {
    console.error("[SyncHandler] Open WebUI full sync failed:", err.message);
  }
}

// 测试 Open WebUI 连接（逐步诊断）
async function testOpenWebUIConnection(req, res) {
  try {
    const result = await kbSync.testConnection();
    res.json({ code: 200, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

// 查询 Open WebUI 同步实时进度
function getOpenWebUISyncProgress(_req, res) {
  const progress = kbSync.getSyncProgress();
  res.json({
    code: 200,
    data: {
      running: progress.running,
      total: progress.total,
      synced: progress.synced,
      failed: progress.failed,
      currentDoc: progress.currentDoc,
      percentage: progress.total > 0 ? Math.round(((progress.synced + progress.failed) / progress.total) * 100) : 0,
    },
  });
}

// 获取知识库列表（供前端下拉选择）
async function getKnowledgeBases(_req, res) {
  if (!kbSync.isConfigured()) {
    return res.json({ code: 200, data: [] });
  }
  const token = kbSync.getApiKey();
  const kbs = await kbSync.listKnowledgeBases(token);
  res.json({ code: 200, data: kbs });
}



// Import from Open WebUI (reverse direction)
async function triggerOpenWebUIImport(req, res) {
  var db = openDb();
  if (!kbSync.isConfigured()) {
    return res.status(400).json({code:400,message:'OPEN_WEBUI_API_KEY not configured'});
  }
  auditLog(db, req, 'trigger_openwebui_import', null, 'Trigger Open WebUI import');
  res.status(202).json({code:202,message:'Import started',data:{status:'started'}});
  try {
    var result = await kbSync.importFromOpenWebUI();
    console.log('[SyncHandler] Open WebUI import complete:', result);
  } catch(err) {
    console.error('[SyncHandler] Open WebUI import failed:', err.message);
  }
}


// Open WebUI Notes sync (bidirectional: /api/v1/notes/ ↔ notes/ directory)
async function triggerNotesSync(req, res) {
  var db = openDb();
  if (!kbSync.isConfigured()) {
    return res.status(400).json({code:400,message:'OPEN_WEBUI_API_KEY not configured'});
  }
  auditLog(db, req, 'trigger_notes_sync', null, 'Trigger Open WebUI Notes sync');
  res.status(202).json({code:202,message:'Notes sync started',data:{status:'started'}});
  try {
    var result = await kbSync.fullSyncNotes();
    console.log('[SyncHandler] Open WebUI Notes sync complete:', JSON.stringify(result));
  } catch(err) {
    console.error('[SyncHandler] Open WebUI Notes sync failed:', err.message);
  }
}

// Test Open WebUI Notes connection
async function testNotesConnection(req, res) {
  try {
    var result = await kbSync.testNotesConnection();
    res.json({ code: 200, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
}


module.exports = {
  getSyncConfig, updateSyncConfig, triggerImport, triggerExport,
  listSyncLogs, getSyncStatus, testFilesystem, getRemoteFiles,
  getSyncedFiles, clearSyncedData, getOpenWebUIStatus, triggerOpenWebUISync, triggerOpenWebUIImport,
  testOpenWebUIConnection, getOpenWebUISyncProgress, getKnowledgeBases,
  triggerNotesSync, testNotesConnection,
};
