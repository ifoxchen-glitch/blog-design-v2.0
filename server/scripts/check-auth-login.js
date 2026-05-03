// One-off helper: verify POST /api/v2/auth/login handler
// Usage (from server/): node scripts/check-auth-login.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-auth-login-check-do-not-use-in-prod";
}

const jwt = require("jsonwebtoken");
const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");

const db = openDb();
migrate(db);
ensureSeed(db);
ensureRbacSeed(db, {
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
});

const { login } = require("../src/apps/admin/auth/authHandlers");

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

async function call(body) {
  const req = { body };
  let statusCode = 0;
  let respBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { respBody = b; return this; },
  };
  await login(req, res);
  return { statusCode, body: respBody };
}

(async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";

  // 1) correct credentials
  let goodResp;
  {
    goodResp = await call({ email: adminEmail, password: adminPassword });
    check("correct credentials -> 200", goodResp.statusCode === 200, `code=${goodResp.body && goodResp.body.code}`);
    check("response.data.accessToken is string", goodResp.body && goodResp.body.data && typeof goodResp.body.data.accessToken === "string");
    check("response.data.refreshToken is string", goodResp.body && goodResp.body.data && typeof goodResp.body.data.refreshToken === "string");
    check("response.data.user.id > 0", goodResp.body && goodResp.body.data && goodResp.body.data.user && goodResp.body.data.user.id > 0);
    check("response.data.user.email matches", goodResp.body && goodResp.body.data && goodResp.body.data.user.email === adminEmail);
    check("response.data.user.isSuperAdmin === true", goodResp.body && goodResp.body.data && goodResp.body.data.user.isSuperAdmin === true);
    check("response.data.user.roles is array", goodResp.body && goodResp.body.data && Array.isArray(goodResp.body.data.user.roles));
    check("response.data.user has NO password_hash", goodResp.body && goodResp.body.data && !("password_hash" in goodResp.body.data.user));
  }

  // 2) wrong password
  {
    const r = await call({ email: adminEmail, password: "definitely-wrong-password" });
    check("wrong password -> 401", r.statusCode === 401, `code=${r.body && r.body.code}`);
  }

  // 3) nonexistent email
  {
    const r = await call({ email: "ghost@example.com", password: "any" });
    check("nonexistent email -> 401", r.statusCode === 401);
  }

  // 4) missing fields
  {
    const r = await call({ email: adminEmail });
    check("missing password -> 400", r.statusCode === 400, `code=${r.body && r.body.code}`);
  }
  {
    const r = await call({ password: adminPassword });
    check("missing email -> 400", r.statusCode === 400);
  }
  {
    const r = await call({});
    check("empty body -> 400", r.statusCode === 400);
  }
  {
    const r = await call(undefined);
    check("undefined body -> 400", r.statusCode === 400);
  }

  // 5) tokens roundtrip via jwt.verify
  if (goodResp && goodResp.statusCode === 200) {
    try {
      const decoded = jwt.verify(goodResp.body.data.accessToken, process.env.JWT_SECRET);
      check("accessToken decodes successfully", true);
      check("accessToken.type === 'admin'", decoded.type === "admin");
      check("accessToken.userId > 0", decoded.userId > 0);
      check("accessToken.username matches", decoded.username === goodResp.body.data.user.username);
      check("accessToken.roles is array", Array.isArray(decoded.roles));
      check("accessToken.exp present", typeof decoded.exp === "number");
    } catch (err) {
      check("accessToken decodes successfully", false, err.message);
    }

    try {
      const decoded = jwt.verify(goodResp.body.data.refreshToken, process.env.JWT_SECRET);
      check("refreshToken decodes successfully", true);
      check("refreshToken.type === 'refresh'", decoded.type === "refresh");
      check("refreshToken.userId > 0", decoded.userId > 0);
    } catch (err) {
      check("refreshToken decodes successfully", false, err.message);
    }
  }

  // 6) disabled user is rejected
  {
    db.prepare("UPDATE users SET status = 'disabled' WHERE email = ?").run(adminEmail);
    try {
      const r = await call({ email: adminEmail, password: adminPassword });
      check("disabled user -> 401", r.statusCode === 401);
    } finally {
      db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run(adminEmail);
    }
  }

  // 7) last_login_at updated after success
  {
    db.prepare("UPDATE users SET last_login_at = NULL WHERE email = ?").run(adminEmail);
    await call({ email: adminEmail, password: adminPassword });
    const u = db.prepare("SELECT last_login_at FROM users WHERE email = ?").get(adminEmail);
    check("last_login_at updated after login", u && typeof u.last_login_at === "string" && u.last_login_at.length > 0);
  }

  console.log("");
  console.log(pass ? "PASS: /api/v2/auth/login verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
