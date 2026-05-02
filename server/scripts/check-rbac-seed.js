// One-off helper: verify RBAC seed data
// Usage (from server/): node scripts/check-rbac-seed.js
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
const db = new Database(dbPath, { readonly: true });

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

// 1) permissions
const permCount = db.prepare("SELECT COUNT(*) AS c FROM permissions").get().c;
check("permissions = 12", permCount === 12, `actual=${permCount}`);

const expectedPerms = [
  "post:list","post:create","post:update","post:delete","post:publish",
  "user:list","user:create","role:assign",
  "analytics:view","ops:backup","ops:logs","menu:manage",
];
const actualPerms = db.prepare("SELECT code FROM permissions ORDER BY code").all().map(r => r.code);
const missingPerms = expectedPerms.filter(c => !actualPerms.includes(c));
check("all 12 permission codes present", missingPerms.length === 0, missingPerms.length ? "missing: " + missingPerms.join(",") : "");

// 2) roles
const roleCount = db.prepare("SELECT COUNT(*) AS c FROM roles").get().c;
check("roles = 3", roleCount === 3, `actual=${roleCount}`);

for (const code of ["super_admin","content_admin","viewer"]) {
  const r = db.prepare("SELECT name FROM roles WHERE code = ?").get(code);
  check(`role exists: ${code}`, !!r, r ? `name=${r.name}` : "");
}

// 3) super_admin role bound to all 12 permissions
const saPerms = db.prepare(`
  SELECT COUNT(*) AS c
  FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.code = 'super_admin'
`).get().c;
check("super_admin bound to all 12 permissions", saPerms === 12, `actual=${saPerms}`);

// content_admin: 6 permissions (5 post:* + analytics:view)
const caPerms = db.prepare(`
  SELECT COUNT(*) AS c
  FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.code = 'content_admin'
`).get().c;
check("content_admin bound to 6 permissions", caPerms === 6, `actual=${caPerms}`);

// viewer: 4 permissions
const vPerms = db.prepare(`
  SELECT COUNT(*) AS c
  FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.code = 'viewer'
`).get().c;
check("viewer bound to 4 permissions", vPerms === 4, `actual=${vPerms}`);

// 4) super admin user
const su = db.prepare(`
  SELECT id, username, email, is_super_admin, status
  FROM users WHERE is_super_admin = 1
`).all();
check("super admin user count = 1", su.length === 1, su.length ? `email=${su[0].email}, username=${su[0].username}` : "");

// 5) super admin bound to super_admin role
if (su.length === 1) {
  const bound = db.prepare(`
    SELECT COUNT(*) AS c
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.code = 'super_admin'
  `).get(su[0].id).c;
  check("super admin user bound to super_admin role", bound === 1);
}

// 6) menus
const menuTotal = db.prepare("SELECT COUNT(*) AS c FROM menus").get().c;
check("menus total >= 15 (5 top + children)", menuTotal >= 15, `actual=${menuTotal}`);

const topMenus = db.prepare("SELECT name FROM menus WHERE parent_id IS NULL ORDER BY sort_order").all().map(r => r.name);
check("5 top-level menus", topMenus.length === 5, `actual=[${topMenus.join(", ")}]`);

console.log("");
console.log(pass ? "PASS: RBAC seed verified." : "FAIL: see [FAIL] entries above.");
process.exit(pass ? 0 : 1);
