const fs = require("fs");
const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");
const syncEngine = require("./syncEngine");

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
          couchdb_enabled: !!config.couchdb_enabled,
          couchdb_url: config.couchdb_url || "",
          couchdb_db_name: config.couchdb_db_name || "",
          couchdb_username: config.couchdb_username || "",
          couchdb_password: config.couchdb_password || "",
        }
      : null,
  });
}

function updateSyncConfig(req, res) {
  const db = openDb();
  const now = nowIso();
  const {
    vault_path, auto_sync_enabled, sync_interval_minutes, conflict_strategy,
    couchdb_enabled, couchdb_url, couchdb_db_name, couchdb_username, couchdb_password,
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
    couchdb_enabled: couchdb_enabled !== undefined ? (couchdb_enabled ? 1 : 0) : (existing.couchdb_enabled ?? 0),
    couchdb_url: couchdb_url ?? existing.couchdb_url ?? "",
    couchdb_db_name: couchdb_db_name ?? existing.couchdb_db_name ?? "",
    couchdb_username: couchdb_username ?? existing.couchdb_username ?? "",
    couchdb_password: couchdb_password ?? existing.couchdb_password ?? "",
    updated_at: now,
  };

  db.prepare(
    `UPDATE kb_sync_config SET vault_path=?, auto_sync_enabled=?, sync_interval_minutes=?, conflict_strategy=?, couchdb_enabled=?, couchdb_url=?, couchdb_db_name=?, couchdb_username=?, couchdb_password=?, updated_at=? WHERE id=1`,
  ).run(
    updates.vault_path,
    updates.auto_sync_enabled,
    updates.sync_interval_minutes,
    updates.conflict_strategy,
    updates.couchdb_enabled,
    updates.couchdb_url,
    updates.couchdb_db_name,
    updates.couchdb_username,
    updates.couchdb_password,
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
  if (!config || (!config.vault_path && !config.couchdb_enabled)) {
    return res.status(400).json({ code: 400, message: "请先配置仓库路径 (vault_path) 或启用 CouchDB 同步" });
  }

  if (syncEngine.isRunning()) {
    return res.status(409).json({ code: 409, message: "同步正在进行中" });
  }

  // Respond immediately, run sync async
  const usingCouchDB = !!(config.couchdb_enabled && config.couchdb_url && config.couchdb_db_name);
  auditLog(db, req, "trigger_import", config.vault_path || "couchdb", `触发${usingCouchDB ? "CouchDB" : "文件系统"}同步`);
  res.status(202).json({ code: 202, message: `同步已启动 (${usingCouchDB ? "CouchDB" : "文件系统"})` });

  try {
    if (usingCouchDB) {
      await syncEngine.fullImportFromCouchDB(
        {
          url: config.couchdb_url,
          dbName: config.couchdb_db_name,
          username: config.couchdb_username || undefined,
          password: config.couchdb_password || undefined,
        },
        config.conflict_strategy || "last_write_wins",
      );
    } else {
      await syncEngine.fullImport(config.vault_path, config.conflict_strategy || "last_write_wins");
    }
  } catch (err) {
    console.error("[kb-sync] import failed:", err.message);
    // Write the error to sync logs so it's visible in the UI
    try {
      const db2 = openDb();
      const now2 = nowIso();
      db2.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", usingCouchDB ? `couchdb://` : config.vault_path, "error", `导入失败: ${err.message}`, now2);
    } catch { /* ignore */ }
  }
}

async function triggerCouchDBImport(req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  if (!config || !config.couchdb_url || !config.couchdb_db_name) {
    return res.status(400).json({ code: 400, message: "请先配置 CouchDB 连接信息" });
  }

  if (syncEngine.isRunning()) {
    return res.status(409).json({ code: 409, message: "同步正在进行中" });
  }

  auditLog(db, req, "trigger_couchdb_import", config.couchdb_db_name, `触发 CouchDB 同步: ${config.couchdb_db_name}`);
  res.status(202).json({ code: 202, message: "CouchDB 同步已启动" });

  try {
    await syncEngine.fullImportFromCouchDB(
      {
        url: config.couchdb_url,
        dbName: config.couchdb_db_name,
        username: config.couchdb_username || undefined,
        password: config.couchdb_password || undefined,
      },
      config.conflict_strategy || "last_write_wins",
    );
  } catch (err) {
    console.error("[kb-sync] CouchDB import failed:", err.message);
    try {
      const db2 = openDb();
      const now2 = nowIso();
      db2.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", `couchdb://${config.couchdb_db_name}`, "error", `CouchDB 导入失败: ${err.message}`, now2);
    } catch { /* ignore */ }
  }
}

function triggerExport(req, res) {
  // Export is a placeholder for now
  res.status(501).json({ code: 501, message: "导出功能尚未实现" });
}

function listSyncLogs(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const offset = (page - 1) * pageSize;
  const since = req.query.since; // ISO timestamp filter: created_at > since

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

  // Count results from the most recent sync batch
  let lastResult = null;
  if (config && config.last_sync_at) {
    const logs = db
      .prepare("SELECT status, COUNT(*) AS c FROM kb_sync_logs WHERE direction = 'import' AND created_at = ? GROUP BY status")
      .all(config.last_sync_at);
    if (logs.length > 0) {
      lastResult = { imported: 0, skipped: 0, conflicted: 0, errors: 0 };
      for (const row of logs) {
        if (row.status === "success") lastResult.imported += row.c;
        else if (row.status === "skipped") lastResult.skipped += row.c;
        else if (row.status === "conflict") lastResult.conflicted += row.c;
        else if (row.status === "error") lastResult.errors += row.c;
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
    const resolved = require("path").resolve(vaultPath);
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

    // Scan for .md files (same logic as scanVault but lightweight)
    let mdCount = 0;
    let totalSize = 0;
    function walk(dir, depth) {
      if (depth > 20) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = require("path").join(dir, e.name);
        if (e.isDirectory()) { walk(full, depth + 1); }
        else if (e.isFile() && e.name.endsWith(".md")) {
          try {
            const st = fs.statSync(full);
            if (st.size <= MAX_FILE_SIZE) { mdCount++; totalSize += st.size; }
          } catch { /* skip */ }
        }
      }
    }
    walk(resolved, 0);

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

async function testCouchDB(req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  const now = nowIso();

  const url = config?.couchdb_url || req.body?.couchdb_url;
  const dbName = config?.couchdb_db_name || req.body?.couchdb_db_name;
  const username = config?.couchdb_username || req.body?.couchdb_username;
  const password = config?.couchdb_password || req.body?.couchdb_password;

  if (!url || !dbName) {
    return res.status(400).json({ code: 400, message: "请先配置 CouchDB URL 和数据库名称" });
  }

  try {
    const headers = { Accept: "application/json" };
    if (username && password) {
      headers.Authorization = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const dbUrl = `${url.replace(/\/+$/, "")}/${encodeURIComponent(dbName)}`;
    const resp = await fetch(dbUrl, { headers });

    if (!resp.ok) {
      const detail = `CouchDB 连接失败: HTTP ${resp.status} ${resp.statusText}`;
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", `couchdb://${dbName}`, "error", detail, now);
      return res.json({ code: 200, data: { ok: false, message: detail } });
    }

    const info = await resp.json();
    const docCount = info.doc_count ?? info.doc_count ?? 0;
    const detail = `CouchDB 连接成功: 数据库 "${info.db_name || dbName}" 包含 ${docCount} 个文档`;
    db.prepare(
      "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("import", `couchdb://${dbName}`, "success", detail, now);

    auditLog(db, req, "test_couchdb", dbName, detail);

    res.json({
      code: 200,
      data: { ok: true, message: detail, dbName: info.db_name || dbName, docCount },
    });
  } catch (err) {
    const detail = `CouchDB 连接失败: ${err.message}`;
    db.prepare(
      "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("import", `couchdb://${dbName}`, "error", detail, now);
    res.json({ code: 200, data: { ok: false, message: err.message } });
  }
}

async function getRemoteFiles(_req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();

  try {
    let files = [];
    let source = "filesystem";

    if (config && config.couchdb_enabled && config.couchdb_url && config.couchdb_db_name) {
      // CouchDB source
      source = "couchdb";
      const { fetchAllDocs, extractPath } = require("./couchdbAdapter");
      let auth = null;
      if (config.couchdb_username && config.couchdb_password) {
        auth = "Basic " + Buffer.from(`${config.couchdb_username}:${config.couchdb_password}`).toString("base64");
      }
      const docs = await fetchAllDocs(config.couchdb_url, config.couchdb_db_name, auth);
      for (const doc of docs) {
        if (doc.type && doc.type !== "note") continue;
        const fp = extractPath(doc);
        if (!fp.endsWith(".md") && !fp.endsWith(".mdx")) continue;
        files.push({ relativePath: fp, size: doc.size || 0 });
      }
    } else if (config && config.vault_path) {
      // Filesystem source
      const vaultPath = require("path").resolve(config.vault_path);
      files = syncEngine.scanVaultPaths(vaultPath);
    }

    const tree = syncEngine.buildFileTree(files);
    res.json({ code: 200, data: { source, tree, fileCount: files.length } });
  } catch (err) {
    res.json({ code: 200, data: { source: "unknown", tree: [], fileCount: 0, error: err.message } });
  }
}

function getSyncedFiles(_req, res) {
  const db = openDb();
  const config = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();

  let matchSource = "obsidian";
  if (config && config.couchdb_enabled && config.couchdb_url && config.couchdb_db_name) {
    matchSource = "couchdb";
  }

  const docs = db
    .prepare("SELECT id, title, original_path, checksum, status, word_count, updated_at FROM kb_documents WHERE source = ? ORDER BY original_path")
    .all(matchSource);

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
      source: matchSource,
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

module.exports = { getSyncConfig, updateSyncConfig, triggerImport, triggerCouchDBImport, triggerExport, listSyncLogs, getSyncStatus, testFilesystem, testCouchDB, getRemoteFiles, getSyncedFiles };
