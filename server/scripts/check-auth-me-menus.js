// One-off helper: verify GET /api/v2/auth/me + /menus + POST /logout
// Usage (from server/): node scripts/check-auth-me-menus.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-auth-me-menus-check-do-not-use-in-prod";
}

const bcrypt = require("bcryptjs");
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

const jwtAuth = require("../src/middleware/jwtAuth");
const { login, logout, me, menus } = require("../src/apps/admin/auth/authHandlers");
const { nowIso } = require("../src/utils");

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

async function callPublic(handler, body) {
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

async function callPrivate(handler, { token, body }) {
  const req = {
    headers: { authorization: token ? `Bearer ${token}` : "" },
    body: body || {},
  };
  let statusCode = 0;
  let respBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { respBody = b; return this; },
  };
  let nextCalled = false;
  jwtAuth(req, res, () => { nextCalled = true; });
  if (!nextCalled) return { statusCode, body: respBody };
  await handler(req, res);
  return { statusCode, body: respBody };
}

const VIEWER_EMAIL = "__test_t113_viewer__@example.com";
const VIEWER_USERNAME = "__test_t113_viewer__";
const VIEWER_PASSWORD = "viewer-test-pass-123";

function setupViewerUser() {
  // Idempotent: remove first, then create
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(VIEWER_EMAIL);
  if (existing) {
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(existing.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
  }

  const hash = bcrypt.hashSync(VIEWER_PASSWORD, 10);
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, status, is_super_admin, created_at, updated_at)
       VALUES (?, ?, ?, 'active', 0, ?, ?)`
    )
    .run(VIEWER_USERNAME, VIEWER_EMAIL, hash, now, now);
  const userId = info.lastInsertRowid;

  const viewer = db.prepare(`SELECT id FROM roles WHERE code = 'viewer'`).get();
  if (!viewer) throw new Error("viewer role missing in seed");
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(userId, viewer.id);

  return userId;
}

function cleanupViewerUser() {
  const u = db.prepare("SELECT id FROM users WHERE email = ?").get(VIEWER_EMAIL);
  if (!u) return;
  db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(u.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
}

(async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";

  let viewerUserId;
  try {
    viewerUserId = setupViewerUser();
  } catch (err) {
    check("setup viewer user", false, err.message);
    process.exit(1);
  }

  try {
    // -------- super admin path --------
    const adminLogin = await callPublic(login, { email: adminEmail, password: adminPassword });
    check("admin login -> 200", adminLogin.statusCode === 200);
    const adminToken = adminLogin.body && adminLogin.body.data && adminLogin.body.data.accessToken;
    check("admin token present", typeof adminToken === "string");

    // /me as super admin
    {
      const r = await callPrivate(me, { token: adminToken });
      check("admin /me -> 200", r.statusCode === 200, `code=${r.body && r.body.code}`);
      check("/me data.isSuperAdmin === true", r.body && r.body.data && r.body.data.isSuperAdmin === true);
      check("/me data.email matches", r.body && r.body.data && r.body.data.email === adminEmail);
      check("/me data.roles is array", r.body && r.body.data && Array.isArray(r.body.data.roles));
      check("/me data.permissions is array", r.body && r.body.data && Array.isArray(r.body.data.permissions));
      check("/me admin permissions.length >= 12", r.body && r.body.data && r.body.data.permissions.length >= 12);
      check("/me data has NO password_hash", r.body && r.body.data && !("password_hash" in r.body.data));
    }

    // /menus as super admin
    {
      const r = await callPrivate(menus, { token: adminToken });
      check("admin /menus -> 200", r.statusCode === 200);
      const tree = r.body && r.body.data;
      check("/menus data is array", Array.isArray(tree));
      check("/menus admin sees >= 4 root nodes", Array.isArray(tree) && tree.length >= 4);
      const dashboard = Array.isArray(tree) && tree.find((n) => n.path === "/cms/dashboard");
      check("/menus admin sees 仪表盘", !!dashboard);
      const blog = Array.isArray(tree) && tree.find((n) => n.name === "博客管理");
      check("/menus admin sees 博客管理 with children", !!(blog && Array.isArray(blog.children) && blog.children.length >= 1));
      const rbac = Array.isArray(tree) && tree.find((n) => n.name === "权限管理");
      check("/menus admin sees 权限管理 with all 4 children", !!(rbac && rbac.children.length === 4));
    }

    // /logout as super admin
    {
      const r = await callPrivate(logout, { token: adminToken });
      check("/logout -> 200", r.statusCode === 200);
      check("/logout data.loggedOut === true", r.body && r.body.data && r.body.data.loggedOut === true);
    }

    // unauthenticated paths
    {
      const r = await callPrivate(me, { token: null });
      check("/me without token -> 401", r.statusCode === 401);
    }
    {
      const r = await callPrivate(menus, { token: null });
      check("/menus without token -> 401", r.statusCode === 401);
    }
    {
      const r = await callPrivate(logout, { token: null });
      check("/logout without token -> 401", r.statusCode === 401);
    }

    // refresh token rejected on private endpoints (jwtAuth checks type==='admin')
    {
      const refreshTok = adminLogin.body && adminLogin.body.data && adminLogin.body.data.refreshToken;
      const r = await callPrivate(me, { token: refreshTok });
      check("/me with refresh token -> 401", r.statusCode === 401);
    }

    // -------- viewer (non-super-admin) path --------
    const viewerLogin = await callPublic(login, { email: VIEWER_EMAIL, password: VIEWER_PASSWORD });
    check("viewer login -> 200", viewerLogin.statusCode === 200);
    const viewerToken = viewerLogin.body && viewerLogin.body.data && viewerLogin.body.data.accessToken;

    // /me as viewer
    {
      const r = await callPrivate(me, { token: viewerToken });
      check("viewer /me -> 200", r.statusCode === 200);
      check("/me viewer.isSuperAdmin === false", r.body && r.body.data && r.body.data.isSuperAdmin === false);
      check("/me viewer roles[0].code === 'viewer'", r.body && r.body.data && r.body.data.roles[0] && r.body.data.roles[0].code === "viewer");
      const perms = (r.body && r.body.data && r.body.data.permissions) || [];
      check("/me viewer has post:list", perms.includes("post:list"));
      check("/me viewer has user:list", perms.includes("user:list"));
      check("/me viewer has analytics:view", perms.includes("analytics:view"));
      check("/me viewer has ops:logs", perms.includes("ops:logs"));
      check("/me viewer does NOT have post:create", !perms.includes("post:create"));
      check("/me viewer does NOT have role:assign", !perms.includes("role:assign"));
    }

    // /menus as viewer (filtered)
    {
      const r = await callPrivate(menus, { token: viewerToken });
      check("viewer /menus -> 200", r.statusCode === 200);
      const tree = r.body && r.body.data;
      const blog = Array.isArray(tree) && tree.find((n) => n.name === "博客管理");
      check("/menus viewer sees 博客管理", !!blog);
      const rbac = Array.isArray(tree) && tree.find((n) => n.name === "权限管理");
      check("/menus viewer sees 权限管理 with only 用户 child", !!(rbac && rbac.children.length === 1 && rbac.children[0].name === "用户"));
      const ops = Array.isArray(tree) && tree.find((n) => n.name === "运维");
      const opsBackup = ops && ops.children && ops.children.find((c) => c.name === "备份");
      check("/menus viewer does NOT see 备份 (ops:backup)", !opsBackup);
    }
  } finally {
    cleanupViewerUser();
  }

  console.log("");
  console.log(pass ? "PASS: /me + /menus + /logout verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
