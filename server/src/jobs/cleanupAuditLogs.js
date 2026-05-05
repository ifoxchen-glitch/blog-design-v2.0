const cron = require("node-cron");
const { openDb } = require("../db");
const { nowIso } = require("../utils");

function register() {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 90;

  // 每天 03:00 执行
  cron.schedule("0 3 * * *", () => {
    try {
      console.log(`[cron] starting audit log cleanup (retention: ${retentionDays} days)...`);
      const db = openDb();
      const cutoff = `${new Date(Date.now() - retentionDays * 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`;

      const countBefore = db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE created_at < ?`).get(cutoff)?.c || 0;
      if (countBefore === 0) {
        console.log("[cron] no old audit logs to clean up.");
        return;
      }

      db.prepare(`DELETE FROM audit_logs WHERE created_at < ?`).run(cutoff);

      // 留痕
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, detail, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        null,
        "system",
        "delete",
        "audit_log",
        null,
        JSON.stringify({ deletedCount: countBefore, reason: `retention policy (${retentionDays} days)`, cutoff }),
        null,
        null,
        nowIso()
      );

      console.log(`[cron] audit log cleanup done. deleted ${countBefore} rows older than ${cutoff}`);
    } catch (err) {
      console.error("[cron] audit log cleanup failed:", err.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai",
  });
  console.log("[cron] cleanupAuditLogs job registered (0 3 * * *)");
}

module.exports = { register };
