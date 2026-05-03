// One-off helper: verify middleware/rbac.js requirePermission()
// Usage (from server/): node scripts/check-rbac.js
const { openDb } = require("../src/db");
const requirePermission = require("../src/middleware/rbac");

const db = openDb();

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

function run(userInfo, code) {
  const req = { user: userInfo };
  let statusCode = 0;
  let body = null;
  let nextCalled = false;
  const res = {
    status(c) { statusCode = c; return this; },
    json(p) { body = p; return this; },
  };
  requirePermission(code)(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
}

// Seeded super admin
const sa = db.prepare("SELECT id, username FROM users WHERE is_super_admin = 1").get();
if (!sa) {
  console.error("FAIL: No super admin found. Run the server once to trigger seeds.");
  process.exit(1);
}

// Set up two temporary users (content_admin role, viewer role) and clean up at end
const now = new Date().toISOString();
const TEST_CA = "__test_rbac_ca__";
const TEST_VIEWER = "__test_rbac_viewer__";

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password_hash, status, is_super_admin, created_at, updated_at)
  VALUES (?, ?, '__placeholder__', 'active', 0, ?, ?)
`);
insertUser.run(TEST_CA, TEST_CA + "@example.com", now, now);
insertUser.run(TEST_VIEWER, TEST_VIEWER + "@example.com", now, now);

const caUser = db.prepare("SELECT id FROM users WHERE username = ?").get(TEST_CA);
const viewerUser = db.prepare("SELECT id FROM users WHERE username = ?").get(TEST_VIEWER);
const caRole = db.prepare("SELECT id FROM roles WHERE code = 'content_admin'").get();
const viewerRole = db.prepare("SELECT id FROM roles WHERE code = 'viewer'").get();

if (!caRole || !viewerRole) {
  console.error("FAIL: content_admin or viewer role missing. Run RBAC seed first.");
  process.exit(1);
}

const linkRole = db.prepare(
  "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
);
linkRole.run(caUser.id, caRole.id);
linkRole.run(viewerUser.id, viewerRole.id);

try {
  // 1) super admin bypass: any permission code should pass
  {
    const r = run({ userId: sa.id, username: sa.username }, "post:delete");
    check("super admin -> post:delete -> next called", r.nextCalled, `userId=${sa.id}`);
  }
  {
    const r = run({ userId: sa.id, username: sa.username }, "this:does:not:exist");
    check("super admin -> nonexistent code -> next called (bypass)", r.nextCalled);
  }
  {
    const r = run({ userId: sa.id, username: sa.username }, "ops:logs");
    check("super admin -> ops:logs -> next called", r.nextCalled);
  }

  // 2) content_admin (per seed: 5 post:* + analytics:view)
  {
    const r = run({ userId: caUser.id, username: TEST_CA }, "post:list");
    check("content_admin -> post:list -> next called", r.nextCalled);
  }
  {
    const r = run({ userId: caUser.id, username: TEST_CA }, "post:publish");
    check("content_admin -> post:publish -> next called", r.nextCalled);
  }
  {
    const r = run({ userId: caUser.id, username: TEST_CA }, "ops:logs");
    check("content_admin -> ops:logs -> 403", r.statusCode === 403, `code=${r.body && r.body.code}`);
    check("content_admin -> ops:logs -> next NOT called", !r.nextCalled);
  }
  {
    const r = run({ userId: caUser.id, username: TEST_CA }, "user:create");
    check("content_admin -> user:create -> 403", r.statusCode === 403);
  }

  // 3) viewer (per seed: post:list + analytics:view + ops:logs + menu:manage subset)
  {
    const r = run({ userId: viewerUser.id, username: TEST_VIEWER }, "post:create");
    check("viewer -> post:create -> 403", r.statusCode === 403);
  }
  {
    const r = run({ userId: viewerUser.id, username: TEST_VIEWER }, "post:delete");
    check("viewer -> post:delete -> 403", r.statusCode === 403);
  }

  // 4) edge cases
  {
    const r = run(undefined, "post:list");
    check("no req.user -> 401", r.statusCode === 401);
    check("no req.user -> next NOT called", !r.nextCalled);
  }
  {
    const r = run({ username: "x" }, "post:list");
    check("req.user without userId -> 401", r.statusCode === 401);
  }
  {
    const r = run({ userId: 999999, username: "ghost" }, "post:list");
    check("nonexistent user -> 401", r.statusCode === 401);
  }

  // 5) disabled user (status='disabled') is rejected even with valid roles
  {
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(caUser.id);
    const r = run({ userId: caUser.id, username: TEST_CA }, "post:list");
    check("disabled user -> 401 (not 403)", r.statusCode === 401, `code=${r.body && r.body.code}`);
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(caUser.id);
  }
} finally {
  db.prepare("DELETE FROM user_roles WHERE user_id IN (?, ?)").run(caUser.id, viewerUser.id);
  db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(caUser.id, viewerUser.id);
}

console.log("");
console.log(pass ? "PASS: rbac requirePermission verified (super admin bypass + 403 for missing perm)." : "FAIL: see [FAIL] entries above.");
process.exit(pass ? 0 : 1);
