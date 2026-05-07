const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const multer = require("multer");
const cron = require("node-cron");
const { openDb } = require("../../../db");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");
const { createBackup, deleteBackupRecord, listBackups, getBackupById, getBackupPath, restoreFromBackup, importBackup } = require("../../../utils/backup");
const backupScheduler = require("../../../jobs/backupScheduler");
const { nowIso } = require("../../../utils");

const router = express.Router();

const TMP_DIR = path.join(os.tmpdir(), "blog-backup-uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

const uploadBackup = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
      const ts = Date.now();
      cb(null, `${ts}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ext === ".sqlite" || ext === ".db");
  },
});

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

    // Normalize snake_case → camelCase for frontend convenience
    const items = logs.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      detail: row.detail ? JSON.parse(row.detail) : null,
      ip: row.ip,
      userAgent: row.user_agent,
      createdAt: row.created_at,
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

/**
 * POST /api/v2/admin/ops/backups/:id/restore
 * 从已有备份还原数据库
 */
router.post(
  "/backups/:id/restore",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = restoreFromBackup(id);
    if (!result.ok) {
      return res.status(400).json({ code: 400, message: result.message });
    }
    res.json({
      code: 200,
      message: "还原完成。建议尽快重启服务以确保所有连接使用新数据库。",
      data: result,
    });
  }
);

/**
 * POST /api/v2/admin/ops/backups/import
 * 上传外部 sqlite 文件，作为备份记录入库（不还原）
 */
router.post(
  "/backups/import",
  jwtAuth,
  requirePermission("ops:backup"),
  uploadBackup.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: "请选择 .sqlite 或 .db 文件" });
    }
    try {
      const data = importBackup(req.file.path, req.file.originalname, req.body.note);
      // 临时文件清理
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      res.json({ code: 200, message: "success", data });
    } catch (err) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      console.error("[backup] import failed:", err.message);
      res.status(500).json({ code: 500, message: "导入失败: " + err.message });
    }
  }
);

// ============================================================
// Backup Schedule
// ============================================================

/**
 * GET /api/v2/admin/ops/backup-schedule
 */
router.get(
  "/backup-schedule",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const row = backupScheduler.loadSchedule();
    res.json({ code: 200, message: "success", data: row || null });
  }
);

/**
 * PUT /api/v2/admin/ops/backup-schedule
 * 更新或创建定时备份配置
 */
router.put(
  "/backup-schedule",
  jwtAuth,
  requirePermission("ops:backup"),
  (req, res) => {
    const { name, cron: cronExpr, enabled, timezone, keepCount } = req.body || {};

    if (!cronExpr || typeof cronExpr !== "string") {
      return res.status(400).json({ code: 400, message: "cron 表达式不能为空" });
    }
    if (!cron.validate(cronExpr)) {
      return res.status(400).json({ code: 400, message: "cron 表达式格式无效" });
    }

    const db = openDb();
    const now = nowIso();
    const existing = db.prepare(`SELECT id FROM backup_schedules ORDER BY id DESC LIMIT 1`).get();

    if (existing) {
      db.prepare(`
        UPDATE backup_schedules
        SET name = ?, cron = ?, enabled = ?, timezone = ?, keep_count = ?, updated_at = ?
        WHERE id = ?
      `).run(
        name || "默认定时备份",
        cronExpr,
        enabled ? 1 : 0,
        timezone || "Asia/Shanghai",
        parseInt(keepCount, 10) || 30,
        now,
        existing.id,
      );
    } else {
      db.prepare(`
        INSERT INTO backup_schedules (name, cron, enabled, timezone, keep_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        name || "默认定时备份",
        cronExpr,
        enabled ? 1 : 0,
        timezone || "Asia/Shanghai",
        parseInt(keepCount, 10) || 30,
        now,
        now,
      );
    }

    backupScheduler.restartSchedule();
    const row = backupScheduler.loadSchedule();
    res.json({ code: 200, message: "success", data: row });
  }
);

// ============================================================
// Monitor
// ============================================================

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
