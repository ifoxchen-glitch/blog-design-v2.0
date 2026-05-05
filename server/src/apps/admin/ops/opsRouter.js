const express = require("express");
const { openDb } = require("../../../db");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

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

module.exports = router;
