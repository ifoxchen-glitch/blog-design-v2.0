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
const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";

frontApp.listen(FRONT_PORT, BIND_HOST, () => {
  console.log(`Front blog : http://${BIND_HOST}:${FRONT_PORT}`);
});

adminApp.listen(ADMIN_PORT, BIND_HOST, () => {
  console.log(`Admin v2 SPA/API : http://${BIND_HOST}:${ADMIN_PORT}`);
});

// Register cron jobs
require('./jobs/backupSqlite').register();
require('./jobs/cleanupAuditLogs').register();
