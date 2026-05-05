const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const { openDb } = require("../../../db");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");
const { createBackup, deleteBackupRecord, listBackups, getBackupById, getBackupPath } = require("../../../utils/backup");

const router = express.Router();

/**
 * GET /api/v2/admin/ops/audit-logs
 * Query params:
 *   - page (default 1)
 *   - pageSize (default 20, max 100)
 *   - action (filter: post|put|delete|patch)
 *   - resourceType (filter)
 *   - username (filter, partial match)
 *   - startDate (YYYY-MM-DD)
 *   - endDate (YYYY-MM-DD)
 */
router.get(
  "/audit-logs",
  jwtAuth,
  requirePermission("ops:logs"),
  (req, res) => {
    const db = openDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (req.query.action) {
      conditions.push("action = ?");
      params.push(req.query.action);
    }
    if (req.query.resourceType) {
      conditions.push("resource_type = ?");
      params.push(req.query.resourceType);
    }
    if (req.query.username) {
      conditions.push("username LIKE ?");
      params.push(`%${req.query.username}%`);
    }
    if (req.query.startDate) {
      conditions.push("created_at >= ?");
      params.push(`${req.query.startDate}T00:00:00.000Z`);
    }
    if (req.query.endDate) {
      conditions.push("created_at <= ?");
      params.push(`${req.query.endDate}T23:59:59.999Z`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${where}`).get(...params);
    const total = countRow?.total || 0;

    const logs = db.prepare(
      `SELECT
        id, user_id, username, action, resource_type, resource_id,
        detail, ip, user_agent, created_at
      FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    // Parse detail JSON for frontend convenience
    const items = logs.map((row) => ({
      ...row,
      detail: row.detail ? JSON.parse(row.detail) : null,
    }));

    res.json({
      code: 200,
      message: "success",
      data: { items, total, page, pageSize },
    });
  }
);

/**
 * GET /api/v2/admin/ops/audit-logs/stats
 */
router.get(
  "/audit-logs/stats",
  jwtAuth,
  requirePermission("ops:logs"),
  (req, res) => {
    const db = openDb();
    const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

    const todayCount = db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE created_at >= ?`).get(todayStart)?.c || 0;

    const actionDistribution = db.prepare(`
      SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC
    `).all();

    const topUsers = db.prepare(`
      SELECT username, COUNT(*) as count FROM audit_logs WHERE username IS NOT NULL GROUP BY username ORDER BY count DESC LIMIT 5
    `).all();

    res.json({
      code: 200,
      message: "success",
      data: { todayCount, actionDistribution, topUsers },
    });
  }
);

// ============================================================
// Backup
// ============================================================

/**
 * POST /api/v2/admin/ops/backup
 */
router.post(
  "/backup",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    try {
      const result = createBackup("manual", req.body.note);
      res.json({ code: 200, message: "success", data: result });
    } catch (err) {
      console.error("[backup] manual backup failed:", err.message);
      res.status(500).json({ code: 500, message: "备份失败: " + err.message });
    }
  }
);

/**
 * GET /api/v2/admin/ops/backups
 */
router.get(
  "/backups",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const type = req.query.type || undefined;
    const status = req.query.status || undefined;

    const data = listBackups({ page, pageSize, type, status });
    res.json({ code: 200, message: "success", data });
  }
);

/**
 * GET /api/v2/admin/ops/backups/:id/download
 */
router.get(
  "/backups/:id/download",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const record = getBackupById(id);
    if (!record) {
      return res.status(404).json({ code: 404, message: "备份不存在" });
    }
    const filePath = getBackupPath(record.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 404, message: "备份文件已丢失" });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${record.filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.sendFile(path.resolve(filePath));
  }
);

/**
 * DELETE /api/v2/admin/ops/backups/:id
 */
router.delete(
  "/backups/:id",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const ok = deleteBackupRecord(id);
    if (!ok) {
      return res.status(404).json({ code: 404, message: "备份不存在" });
    }
    res.json({ code: 200, message: "success" });
  }
);

// ============================================================
// Monitor
// ============================================================

const os = require("node:os");

function getDiskUsage() {
  try {
    const stats = fs.statfsSync(process.cwd());
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;
    const used = total - free;
    return { total, used, usage: total ? parseFloat(((used / total) * 100).toFixed(2)) : 0 };
  } catch {
    return { total: 0, used: 0, usage: 0 };
  }
}

/**
 * GET /api/v2/admin/ops/monitor
 */
router.get(
  "/monitor",
  jwtAuth,
  requirePermission("ops:monitor"),
  (req, res) => {
    const db = openDb();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const disk = getDiskUsage();

    const dbPath = path.join(__dirname, "..", "..", "..", "..", "db", "blog.sqlite");
    let dbSize = 0;
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch { /* ignore */ }

    const activeUsers = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= datetime('now', '-5 minutes')
    `).get()?.c || 0;

    const loadavg = os.loadavg();
    const cpus = os.cpus().length || 1;
    const cpuUsage = parseFloat(((loadavg[0] / cpus) * 100).toFixed(2));

    res.json({
      code: 200,
      message: "success",
      data: {
        cpu: { usage: cpuUsage },
        memory: { total: totalMem, used: usedMem, usage: totalMem ? parseFloat(((usedMem / totalMem) * 100).toFixed(2)) : 0 },
        disk,
        uptime: Math.floor(process.uptime()),
        dbSize,
        activeUsers,
      },
    });
  }
);

module.exports = router;
