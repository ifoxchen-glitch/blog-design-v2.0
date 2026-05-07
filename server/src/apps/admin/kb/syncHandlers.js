const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");
const syncEngine = require("./syncEngine");

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
        }
      : null,
  });
}

function updateSyncConfig(req, res) {
  const db = openDb();
  const now = nowIso();
  const { vault_path, auto_sync_enabled, sync_interval_minutes, conflict_strategy } = req.body || {};

  const existing = db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
  if (!existing) {
    return res.status(500).json({ code: 500, message: "同步配置行不存在" });
  }

  const updates = {
    vault_path: vault_path ?? existing.vault_path,
    auto_sync_enabled: auto_sync_enabled !== undefined ? (auto_sync_enabled ? 1 : 0) : existing.auto_sync_enabled,
    sync_interval_minutes: sync_interval_minutes ?? existing.sync_interval_minutes,
    conflict_strategy: conflict_strategy ?? existing.conflict_strategy,
    updated_at: now,
  };

  db.prepare(
    `UPDATE kb_sync_config SET vault_path=?, auto_sync_enabled=?, sync_interval_minutes=?, conflict_strategy=?, updated_at=? WHERE id=1`,
  ).run(
    updates.vault_path,
    updates.auto_sync_enabled,
    updates.sync_interval_minutes,
    updates.conflict_strategy,
    updates.updated_at,
  );

  // Reload cron schedule
  try {
    require("../../../jobs/kbSync").restartSchedule();
  } catch {
    // cron module may not have been loaded yet — ignore
  }

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
  res.status(202).json({ code: 202, message: "同步已启动" });

  try {
    await syncEngine.fullImport(config.vault_path, config.conflict_strategy || "last_write_wins");
  } catch (err) {
    console.error("[kb-sync] import failed:", err.message);
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

module.exports = { getSyncConfig, updateSyncConfig, triggerImport, triggerExport, listSyncLogs, getSyncStatus };
