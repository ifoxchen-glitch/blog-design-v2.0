const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { optional } = require("./env");
const { openDb, migrate, ensureSeed } = require("./db");
const { ensureRbacSeed } = require("./seeds/rbacSeed");

// ---- Startup validation (Phase 5) ----
// Unraid Docker UI 在某些版本有环境变量丢失的 bug。
// 如果 JWT_SECRET 未设置，尝试从持久化文件读取，否则自动生成并保存。
// 这样即使 UI 没传变量，容器也能启动（但会打印安全警告）。
function ensureJwtSecret() {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  const persistPath = path.join(__dirname, "..", "db", ".jwt_secret");
  if (fs.existsSync(persistPath)) {
    const persisted = fs.readFileSync(persistPath, "utf8").trim();
    if (persisted.length >= 32) {
      console.warn("[WARN] JWT_SECRET not set in environment. Using persisted secret from", persistPath);
      console.warn("[WARN] It is strongly recommended to set JWT_SECRET explicitly for production.");
      return persisted;
    }
  }

  // Auto-generate fallback
  const fallback = crypto.randomBytes(48).toString("hex");
  try {
    fs.writeFileSync(persistPath, fallback, { mode: 0o600 });
    console.warn("[WARN] JWT_SECRET not set. Auto-generated a fallback secret and saved to", persistPath);
    console.warn("[WARN] Please set JWT_SECRET environment variable explicitly for production use.");
  } catch (err) {
    console.warn("[WARN] JWT_SECRET not set and failed to persist fallback:", err.message);
    console.warn("[WARN] Container restart will invalidate all active sessions.");
  }
  return fallback;
}

const jwtSecret = ensureJwtSecret();
process.env.JWT_SECRET = jwtSecret; // ensure downstream modules see it

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
