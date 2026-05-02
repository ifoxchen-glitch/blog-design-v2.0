// One-off helper: list all tables in db/blog.sqlite
// Usage (from server/): node scripts/check-tables.js
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
const db = new Database(dbPath, { readonly: true });

const rows = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();

const names = rows.map((row) => row["name"]);
console.log(names.join("\n"));
console.log("");
console.log("Total tables:", names.length);

const expected = [
  // legacy (camelCase)
  "posts",
  "tags",
  "post_tags",
  "categories",
  "post_categories",
  "external_links",
  // v2 (snake_case)
  "users",
  "roles",
  "user_roles",
  "permissions",
  "role_permissions",
  "menus",
  "audit_logs",
  "sites",
  "front_users",
  "page_views",
];
const missing = expected.filter((t) => !names.includes(t));
if (missing.length === 0) {
  console.log("OK: all 16 expected tables exist.");
} else {
  console.log("MISSING:", missing.join(", "));
  process.exit(1);
}
