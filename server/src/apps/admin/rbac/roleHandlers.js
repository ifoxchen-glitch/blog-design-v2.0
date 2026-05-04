const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");

function pickRolePublic(row, { userCount = 0, permissionCount = 0 } = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    status: row.status,
    userCount,
    permissionCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidRoleCode(code) {
  return /^[a-z][a-z0-9_]{1,31}$/.test(String(code));
}

function isValidRoleName(name) {
  const s = String(name).trim();
  return s.length >= 1 && s.length <= 32;
}

const BUILTIN_ROLES = new Set(["super_admin", "content_admin", "viewer"]);

function listRoles(req, res) {
  const db = openDb();

  const rows = db.prepare(`
    SELECT r.id, r.code, r.name, r.description, r.status, r.created_at, r.updated_at,
           (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
           (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
      FROM roles r
     ORDER BY r.id
  `).all();

  const items = rows.map((r) =>
    pickRolePublic(r, { userCount: r.user_count, permissionCount: r.permission_count })
  );

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total: items.length },
  });
}

function getRole(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare(`SELECT id, code, name, description, status, created_at, updated_at FROM roles WHERE id = ?`)
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Role not found" });

  const permissions = db
    .prepare(`
      SELECT p.id, p.code, p.resource, p.action, p.name
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.id
    `)
    .all(id);

  const userCount = db
    .prepare(`SELECT COUNT(*) AS c FROM user_roles WHERE role_id = ?`)
    .get(id).c;

  const role = pickRolePublic(row, { userCount, permissionCount: permissions.length });
  role.permissions = permissions;
  return res.status(200).json({ code: 200, message: "success", data: role });
}

function createRole(req, res) {
  const db = openDb();
  const { code, name, description, status } = req.body || {};

  if (!isValidRoleCode(code)) {
    return res.status(400).json({ code: 400, message: "Invalid role code" });
  }
  if (!isValidRoleName(name)) {
    return res.status(400).json({ code: 400, message: "Invalid role name" });
  }

  const dup = db.prepare("SELECT 1 FROM roles WHERE code = ? LIMIT 1").get(code);
  if (dup) {
    return res.status(409).json({ code: 409, message: "Role code already exists" });
  }

  const createdAt = nowIso();
  const info = db.prepare(`
    INSERT INTO roles (code, name, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    code,
    name.trim(),
    description || null,
    status === "disabled" ? "disabled" : "active",
    createdAt,
    createdAt
  );

  const row = db
    .prepare(`SELECT id, code, name, description, status, created_at, updated_at FROM roles WHERE id = ?`)
    .get(info.lastInsertRowid);

  const role = pickRolePublic(row);
  return res.status(201).json({ code: 201, message: "success", data: role });
}

function updateRole(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db
    .prepare("SELECT code FROM roles WHERE id = ?")
    .get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Role not found" });

  const { name, description, status } = req.body || {};

  const sets = [];
  const params = [];

  if (name !== undefined) {
    if (!isValidRoleName(name)) {
      return res.status(400).json({ code: 400, message: "Invalid role name" });
    }
    sets.push("name = ?");
    params.push(name.trim());
  }
  if (description !== undefined) {
    sets.push("description = ?");
    params.push(description || null);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status === "disabled" ? "disabled" : "active");
  }

  if (sets.length === 0) {
    return res.status(400).json({ code: 400, message: "No fields to update" });
  }

  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);

  db.prepare(`UPDATE roles SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  const row = db
    .prepare(`SELECT id, code, name, description, status, created_at, updated_at FROM roles WHERE id = ?`)
    .get(id);

  const userCount = db
    .prepare(`SELECT COUNT(*) AS c FROM user_roles WHERE role_id = ?`)
    .get(id).c;
  const permissionCount = db
    .prepare(`SELECT COUNT(*) AS c FROM role_permissions WHERE role_id = ?`)
    .get(id).c;

  const role = pickRolePublic(row, { userCount, permissionCount });
  return res.status(200).json({ code: 200, message: "success", data: role });
}

function deleteRole(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db.prepare("SELECT code FROM roles WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Role not found" });

  if (BUILTIN_ROLES.has(row.code)) {
    return res.status(403).json({ code: 403, message: "Cannot delete built-in role" });
  }

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM user_roles WHERE role_id = ?").get(id).c;
  if (userCount > 0) {
    return res.status(409).json({
      code: 409,
      message: `Role is still assigned to ${userCount} user(s)`,
    });
  }

  db.prepare("DELETE FROM roles WHERE id = ?").run(id);
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function assignPermissions(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const target = db.prepare("SELECT id, code FROM roles WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ code: 404, message: "Role not found" });
  if (target.code === "super_admin") {
    return res.status(403).json({ code: 403, message: "Cannot modify super_admin permissions" });
  }

  const { permission_ids } = req.body || {};
  if (
    !Array.isArray(permission_ids) ||
    !permission_ids.every((x) => Number.isFinite(Number(x)))
  ) {
    return res.status(400).json({
      code: 400,
      message: "permission_ids must be an array of integers",
    });
  }

  const validIds = new Set(
    db.prepare("SELECT id FROM permissions").all().map((r) => r.id)
  );

  const del = db.prepare("DELETE FROM role_permissions WHERE role_id = ?");
  const ins = db.prepare(
    "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)"
  );
  const tx = db.transaction(() => {
    del.run(id);
    for (const pid of permission_ids) {
      const n = Number(pid);
      if (Number.isFinite(n) && validIds.has(n)) ins.run(id, n);
    }
  });
  tx();

  const permissions = db
    .prepare(`
      SELECT p.id, p.code, p.resource, p.action, p.name
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.id
    `)
    .all(id);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { roleId: id, permissions },
  });
}

module.exports = {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
};
