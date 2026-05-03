// One-off helper: verify POST /api/v2/auth/refresh handler
// Usage (from server/): node scripts/check-auth-refresh.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-auth-refresh-check-do-not-use-in-prod";
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

const { login, refresh } = require("../src/apps/admin/auth/authHandlers");

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

async function call(handler, body) {
  const req = { body };
  let statusCode = 0;
  let respBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { respBody = b; return this; },
  };
  await handler(req, res);
  return { statusCode, body: respBody };
}

(async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";

  // 0) login to obtain a real refreshToken
  const loginResp = await call(login, { email: adminEmail, password: adminPassword });
  check("login returned 200", loginResp.statusCode === 200);
  const refreshToken = loginResp.body && loginResp.body.data && loginResp.body.data.refreshToken;
  const oldAccessToken = loginResp.body && loginResp.body.data && loginResp.body.data.accessToken;
  check("login provided refreshToken", typeof refreshToken === "string" && refreshToken.length > 0);
  // 1) refresh with valid refreshToken
  let refreshResp;
  {
    refreshResp = await call(refresh, { refreshToken });
    check("valid refresh -> 200", refreshResp.statusCode === 200, `code=${refreshResp.body && refreshResp.body.code}`);
    check("response.data.accessToken is string", refreshResp.body && refreshResp.body.data && typeof refreshResp.body.data.accessToken === "string");
    check("response.data has NO refreshToken", refreshResp.body && refreshResp.body.data && !("refreshToken" in refreshResp.body.data));
  }

  // 2) verify new accessToken payload
  if (refreshResp && refreshResp.statusCode === 200) {
    try {
      const decoded = jwt.verify(refreshResp.body.data.accessToken, process.env.JWT_SECRET);
      check("new accessToken.type === 'admin'", decoded.type === "admin");
      check("new accessToken.userId > 0", decoded.userId > 0);
      check("new accessToken.username present", typeof decoded.username === "string");
      check("new accessToken.roles is array", Array.isArray(decoded.roles));
      check("new accessToken.exp present", typeof decoded.exp === "number");
    } catch (err) {
      check("new accessToken decodes successfully", false, err.message);
    }
  }

  // 3) missing refreshToken / empty body / undefined body -> 400
  {
    const r = await call(refresh, {});
    check("empty body -> 400", r.statusCode === 400, `code=${r.body && r.body.code}`);
  }
  {
    const r = await call(refresh, undefined);
    check("undefined body -> 400", r.statusCode === 400);
  }
  {
    const r = await call(refresh, { refreshToken: "" });
    check("empty refreshToken string -> 400", r.statusCode === 400);
  }

  // 4) malformed token -> 401
  {
    const r = await call(refresh, { refreshToken: "not.a.valid.jwt" });
    check("malformed token -> 401", r.statusCode === 401, `code=${r.body && r.body.code}`);
  }

  // 5) access token (wrong type='admin') -> 401
  {
    const r = await call(refresh, { refreshToken: oldAccessToken });
    check("access token used as refresh -> 401", r.statusCode === 401);
  }

  // 6) token signed with wrong secret -> 401
  {
    const fake = jwt.sign({ userId: 1, type: "refresh" }, "wrong-secret-not-the-real-one", { expiresIn: "1h" });
    const r = await call(refresh, { refreshToken: fake });
    check("token signed with wrong secret -> 401", r.statusCode === 401);
  }

  // 7) expired refresh token -> 401 with "expired" message
  {
    const expired = jwt.sign({ userId: 1, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: "-1s" });
    const r = await call(refresh, { refreshToken: expired });
    check("expired refresh -> 401", r.statusCode === 401, `code=${r.body && r.body.code}`);
    check("expired refresh message mentions 'expired'", r.body && /expired/i.test(r.body.message));
  }

  // 8) disabled user -> 401
  {
    db.prepare("UPDATE users SET status = 'disabled' WHERE email = ?").run(adminEmail);
    try {
      const r = await call(refresh, { refreshToken });
      check("disabled user refresh -> 401", r.statusCode === 401);
    } finally {
      db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run(adminEmail);
    }
  }

  // 9) after re-enabling, refresh works again
  {
    const r = await call(refresh, { refreshToken });
    check("re-enabled user refresh -> 200", r.statusCode === 200);
  }

  console.log("");
  console.log(pass ? "PASS: /api/v2/auth/refresh verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
