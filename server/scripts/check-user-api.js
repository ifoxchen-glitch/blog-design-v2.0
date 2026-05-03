// One-off helper: verify user management API handlers
// Usage (from server/): node scripts/check-user-api.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-user-api-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/rbac/userHandlers");

const db = openDb();
migrate(db);
ensureSeed(db);
ensureRbacSeed(db, {
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
});

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

function makeReq(overrides = {}) {
  return {
    query: {},
    params: {},
    body: {},
    user: null,
    ...overrides,
    query: { ...overrides.query },
    params: { ...overrides.params },
    body: overrides.body !== undefined ? overrides.body : {},
  };
}

async function call(handler, req) {
  let statusCode = 0;
  let respBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { respBody = b; return this; },
  };
  await handler(req, res);
  return { statusCode, body: respBody };
}

function cleanupTestUsers() {
  const ids = db
    .prepare("SELECT id FROM users WHERE username LIKE 'testuser_%' OR email LIKE 'testuser_%'")
    .all()
    .map((r) => r.id);
  if (ids.length) {
    db.prepare(`DELETE FROM user_roles WHERE user_id IN (${ids.map(() => "?").join(",")})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
  }
}

(async () => {
  cleanupTestUsers();

  const sa = db.prepare("SELECT id, username, email FROM users WHERE is_super_admin = 1").get();
  check("seeded super admin exists", !!sa, `id=${sa && sa.id}`);

  const viewerRole = db.prepare("SELECT id FROM roles WHERE code = 'viewer'").get();
  check("viewer role exists", !!viewerRole);

  // ---------- createUser ----------
  let createdUserId = 0;
  {
    const r = await call(handlers.createUser, makeReq({ body: {
      username: "testuser_1",
      email: "testuser_1@example.com",
      password: "password123",
      display_name: "Tester One",
      status: "active",
      role_ids: viewerRole ? [viewerRole.id] : [],
    }}));
    check("createUser -> 201", r.statusCode === 201, `code=${r.body && r.body.code}`);
    const d = r.body && r.body.data;
    check("createUser returns public fields", d && d.username === "testuser_1" && d.email === "testuser_1@example.com");
    check("createUser has roles", d && Array.isArray(d.roles));
    check("createUser no password_hash", d && !("password_hash" in d));
    createdUserId = d ? d.id : 0;
  }

  // duplicate username/email
  {
    const r = await call(handlers.createUser, makeReq({ body: {
      username: "testuser_1",
      email: "testuser_1_dup@example.com",
      password: "password123",
    }}));
    check("createUser duplicate username -> 409", r.statusCode === 409);
  }
  {
    const r = await call(handlers.createUser, makeReq({ body: {
      username: "testuser_1_dup",
      email: "testuser_1@example.com",
      password: "password123",
    }}));
    check("createUser duplicate email -> 409", r.statusCode === 409);
  }

  // missing fields
  {
    const r = await call(handlers.createUser, makeReq({ body: { username: "x", email: "x@e.com" } }));
    check("createUser missing password -> 400", r.statusCode === 400);
  }

  // ---------- listUsers ----------
  {
    const r = await call(handlers.listUsers, makeReq({ query: { page: "1", pageSize: "20" } }));
    check("listUsers -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("listUsers has items array", d && Array.isArray(d.items));
    check("listUsers has total number", d && typeof d.total === "number");
    check("listUsers has page/pageSize", d && d.page === 1 && d.pageSize === 20);
    const found = d && d.items.find((u) => u.id === createdUserId);
    check("listUsers contains created user", !!found);
  }

  // keyword search
  {
    const r = await call(handlers.listUsers, makeReq({ query: { keyword: "testuser_1" } }));
    const d = r.body && r.body.data;
    check("listUsers keyword filter works", d && d.items.length >= 1 && d.items.some((u) => u.id === createdUserId));
  }

  // status filter
  {
    const r = await call(handlers.listUsers, makeReq({ query: { status: "disabled" } }));
    const d = r.body && r.body.data;
    check("listUsers status filter works", d && !d.items.some((u) => u.id === createdUserId));
  }

  // ---------- getUser ----------
  {
    const r = await call(handlers.getUser, makeReq({ params: { id: String(createdUserId) } }));
    check("getUser -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("getUser returns correct id", d && d.id === createdUserId);
    check("getUser has roles", d && Array.isArray(d.roles));
  }
  {
    const r = await call(handlers.getUser, makeReq({ params: { id: "999999" } }));
    check("getUser nonexistent -> 404", r.statusCode === 404);
  }
  {
    const r = await call(handlers.getUser, makeReq({ params: { id: "0" } }));
    check("getUser invalid id -> 400", r.statusCode === 400);
  }

  // ---------- updateUser ----------
  {
    const r = await call(handlers.updateUser, makeReq({
      params: { id: String(createdUserId) },
      body: { display_name: "Updated Name", status: "disabled" },
    }));
    check("updateUser -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("updateUser display_name changed", d && d.displayName === "Updated Name");
    check("updateUser status changed", d && d.status === "disabled");
  }

  // update super admin forbidden
  if (sa) {
    const r = await call(handlers.updateUser, makeReq({
      params: { id: String(sa.id) },
      body: { display_name: "Nope" },
    }));
    check("updateUser super admin -> 403", r.statusCode === 403);
  }

  // update nonexistent
  {
    const r = await call(handlers.updateUser, makeReq({ params: { id: "999999" }, body: { display_name: "Nope" } }));
    check("updateUser nonexistent -> 404", r.statusCode === 404);
  }

  // ---------- resetPassword ----------
  {
    const r = await call(handlers.resetPassword, makeReq({
      params: { id: String(createdUserId) },
      body: { new_password: "newpass456" },
    }));
    check("resetPassword -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("resetPassword returns reset=true", d && d.reset === true);
  }
  {
    const r = await call(handlers.resetPassword, makeReq({
      params: { id: String(createdUserId) },
      body: { new_password: "12" },
    }));
    check("resetPassword too short -> 400", r.statusCode === 400);
  }
  {
    const r = await call(handlers.resetPassword, makeReq({ params: { id: "999999" }, body: { new_password: "validpass" } }));
    check("resetPassword nonexistent -> 404", r.statusCode === 404);
  }

  // ---------- deleteUser ----------
  // create a second user to test delete-self guard
  let user2Id = 0;
  {
    const r = await call(handlers.createUser, makeReq({ body: {
      username: "testuser_2",
      email: "testuser_2@example.com",
      password: "password123",
    }}));
    user2Id = r.body && r.body.data ? r.body.data.id : 0;
  }

  // delete self forbidden
  {
    const r = await call(handlers.deleteUser, makeReq({
      params: { id: String(user2Id) },
      user: { userId: user2Id },
    }));
    check("deleteUser self -> 403", r.statusCode === 403);
  }

  // delete super admin forbidden
  if (sa) {
    const r = await call(handlers.deleteUser, makeReq({
      params: { id: String(sa.id) },
      user: { userId: user2Id },
    }));
    check("deleteUser super admin -> 403", r.statusCode === 403);
  }

  // delete nonexistent
  {
    const r = await call(handlers.deleteUser, makeReq({ params: { id: "999999" }, user: { userId: user2Id } }));
    check("deleteUser nonexistent -> 404", r.statusCode === 404);
  }

  // successful delete (caller is super admin)
  {
    const r = await call(handlers.deleteUser, makeReq({
      params: { id: String(user2Id) },
      user: { userId: sa.id },
    }));
    check("deleteUser -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("deleteUser returns deleted=true", d && d.deleted === true);
  }

  // cleanup
  cleanupTestUsers();

  console.log("");
  console.log(pass ? "PASS: user management API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
