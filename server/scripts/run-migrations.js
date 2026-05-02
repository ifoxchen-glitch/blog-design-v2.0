// One-off helper: run migration + all seeds without starting the HTTP server.
// Usage (from server/): node scripts/run-migrations.js
//
// 用途：T1.4 验证、CI 校验、首次部署时不想启 server 也能初始化 DB。

const path = require("node:path");

// 加载 .env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { optional } = require("../src/env");
const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");

const ADMIN_EMAIL = optional("ADMIN_EMAIL", "admin@example.com");
const ADMIN_PASSWORD = optional("ADMIN_PASSWORD", "admin");
const ADMIN_PASSWORD_HASH = optional("ADMIN_PASSWORD_HASH", "");

const db = openDb();
migrate(db);
ensureSeed(db);
ensureRbacSeed(db, {
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  adminPasswordHash: ADMIN_PASSWORD_HASH,
});

console.log("Migration + seed done.");
console.log("  admin email :", ADMIN_EMAIL);
console.log("  admin source:", ADMIN_PASSWORD_HASH ? "ADMIN_PASSWORD_HASH" : "ADMIN_PASSWORD (auto bcrypt)");
db.close();
