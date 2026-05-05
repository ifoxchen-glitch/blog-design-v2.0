const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { optional } = require("./env");
const { openDb, migrate, ensureSeed } = require("./db");
const { ensureRbacSeed } = require("./seeds/rbacSeed");

// ---- Startup validation (Phase 5) ----
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET not configured. Set it in server/.env");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long");

const db = openDb();
migrate(db);
ensureSeed(db);
ensureRbacSeed(db, {
  adminEmail: optional("ADMIN_EMAIL", "admin@example.com"),
  adminPassword: optional("ADMIN_PASSWORD", "admin"),
  adminPasswordHash: optional("ADMIN_PASSWORD_HASH", ""),
});

const frontApp = require("./apps/frontApp");
const adminApp = require("./apps/adminApp");

const FRONT_PORT = parseInt(process.env.PORT, 10) || 8787;
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT, 10) || 3000;

frontApp.listen(FRONT_PORT, () => {
  console.log(`Front : http://localhost:${FRONT_PORT}`);
  console.log(`Legacy admin (EJS) : http://localhost:${FRONT_PORT}/admin/login`);
});

adminApp.listen(ADMIN_PORT, () => {
  console.log(`Admin v2 API : http://localhost:${ADMIN_PORT}/api/v2`);
});

// Register cron jobs
require('./jobs/backupSqlite').register();
require('./jobs/cleanupAuditLogs').register();
