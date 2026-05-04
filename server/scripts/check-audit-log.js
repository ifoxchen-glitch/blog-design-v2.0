const Database = require("better-sqlite3");
const path = require("node:path");

const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
const db = new Database(dbPath, { readonly: true });

const rows = db.prepare(`
  SELECT id, user_id, username, action, resource_type, resource_id, detail, created_at
    FROM audit_logs
   ORDER BY id DESC
   LIMIT 10
`).all();

console.log(`Recent ${rows.length} audit log entries:\n`);
for (const r of rows) {
  let detail;
  try {
    detail = JSON.parse(r.detail || "{}");
  } catch {
    detail = r.detail;
  }
  const status = detail?.status ?? "?";
  const duration = detail?.durationMs ?? "?";
  console.log(
    `[${r.id}] ${r.created_at} | user=${r.user_id || "-"} (${r.username || "-"}) | ` +
      `action=${r.action} | resource=${r.resource_type}${r.resource_id ? "/" + r.resource_id : ""} | ` +
      `status=${status} | duration=${duration}ms`
  );
  if (detail?.body) {
    const bodyStr = JSON.stringify(detail.body);
    console.log(`         body=${bodyStr.substring(0, 200)}${bodyStr.length > 200 ? "..." : ""}`);
  }
}

db.close();
