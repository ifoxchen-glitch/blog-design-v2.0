const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("node:path");

const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD) {
  console.error("Usage: node scripts/reset-admin-password.js <new-password>");
  process.exit(1);
}

const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
const db = new Database(dbPath);
const hash = bcrypt.hashSync(NEW_PASSWORD, 10);
const now = new Date().toISOString();

const info = db.prepare(`
  UPDATE users SET password_hash = ?, updated_at = ?
  WHERE is_super_admin = 1
`).run(hash, now);

if (info.changes === 0) {
  console.log("No super admin found. Did seed run?");
  process.exit(1);
}
console.log(`OK: reset password for ${info.changes} super admin user(s).`);
