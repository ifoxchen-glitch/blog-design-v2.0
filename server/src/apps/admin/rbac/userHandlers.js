const bcrypt = require("bcryptjs");
const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");

function hashPassword(pw) {
  return bcrypt.hashSync(String(pw), 10);
}

function pickUserPublic(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name || null,
    avatarUrl: row.avatar_url || null,
    status: row.status,
    isSuperAdmin: row.is_super_admin === 1,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listUserRoles(db, userId) {
  return db
    .prepare(
      `SELECT r.id, r.code, r.name FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
        WHERE ur.user_id = ?
        ORDER BY r.id`
    )
    .all(userId);
}

function setUserRoles(db, userId, roleIds) {
  const del = db.prepare("DELETE FROM user_roles WHERE user_id = ?");
  const ins = db.prepare(
    "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)"
  );
  // Filter against active roles so unknown / disabled IDs are silently ignored
  // (matches docs/06-phase2-rbac-backend-plan.md §2.2 edge case).
  const validIds = new Set(
    db.prepare("SELECT id FROM roles WHERE status = 'active'").all().map((r) => r.id)
  );
  const tx = db.transaction(() => {
    del.run(userId);
    for (const rid of roleIds) {
      const n = Number(rid);
      if (Number.isFinite(n) && validIds.has(n)) ins.run(userId, n);
    }
  });
  tx();
}

function buildListQuery({ keyword, status }) {
  const where = ["1=1"];
  const params = [];
  if (keyword) {
    where.push("(username LIKE ? OR email LIKE ? OR display_name LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  return { clause: where.join(" AND "), params };
}

function listUsers(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const keyword = String(req.query.keyword || "").trim() || null;
  const status = String(req.query.status || "").trim() || null;

  const { clause, params } = buildListQuery({ keyword, status });

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE ${clause}`)
    .get(...params).c;

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url, status,
              is_super_admin, last_login_at, created_at, updated_at
         FROM users
        WHERE ${clause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);

  const items = rows.map((r) => pickUserPublic(r));

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total, page, pageSize },
  });
}

function getUser(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url, status,
              is_super_admin, last_login_at, created_at, updated_at
         FROM users WHERE id = ?`
    )
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "User not found" });

  const user = pickUserPublic(row);
  user.roles = listUserRoles(db, id);
  return res.status(200).json({ code: 200, message: "success", data: user });
}

function createUser(req, res) {
  const db = openDb();
  const { username, email, password, display_name, avatar_url, status, role_ids } =
    req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({
      code: 400,
      message: "Missing required fields: username, email, password",
    });
  }

  const exists = db
    .prepare("SELECT 1 FROM users WHERE username = ? OR email = ? LIMIT 1")
    .get(username, email);
  if (exists) {
    return res.status(409).json({
      code: 409,
      message: "Username or email already exists",
    });
  }

  const createdAt = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users
         (username, email, password_hash, display_name, avatar_url, status, is_super_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      username,
      email,
      hashPassword(password),
      display_name || null,
      avatar_url || null,
      status === "disabled" ? "disabled" : "active",
      createdAt,
      createdAt
    );

  const userId = info.lastInsertRowid;

  if (Array.isArray(role_ids) && role_ids.length > 0) {
    setUserRoles(db, userId, role_ids);
  }

  const row = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url, status,
              is_super_admin, last_login_at, created_at, updated_at
         FROM users WHERE id = ?`
    )
    .get(userId);

  const user = pickUserPublic(row);
  user.roles = listUserRoles(db, userId);
  return res.status(201).json({ code: 201, message: "success", data: user });
}

function updateUser(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db
    .prepare("SELECT is_super_admin FROM users WHERE id = ?")
    .get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "User not found" });

  // Do not allow mutating super_admin users via normal update.
  if (existing.is_super_admin === 1) {
    return res.status(403).json({ code: 403, message: "Cannot modify super admin" });
  }

  const { username, email, display_name, avatar_url, status, role_ids } =
    req.body || {};

  const sets = [];
  const params = [];

  if (username !== undefined) {
    sets.push("username = ?");
    params.push(username);
  }
  if (email !== undefined) {
    sets.push("email = ?");
    params.push(email);
  }
  if (display_name !== undefined) {
    sets.push("display_name = ?");
    params.push(display_name || null);
  }
  if (avatar_url !== undefined) {
    sets.push("avatar_url = ?");
    params.push(avatar_url || null);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status === "disabled" ? "disabled" : "active");
  }

  if (sets.length > 0) {
    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  if (Array.isArray(role_ids)) {
    setUserRoles(db, id, role_ids);
  }

  const row = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url, status,
              is_super_admin, last_login_at, created_at, updated_at
         FROM users WHERE id = ?`
    )
    .get(id);

  const user = pickUserPublic(row);
  user.roles = listUserRoles(db, id);
  return res.status(200).json({ code: 200, message: "success", data: user });
}

function deleteUser(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare("SELECT is_super_admin FROM users WHERE id = ?")
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "User not found" });

  if (row.is_super_admin === 1) {
    return res.status(403).json({ code: 403, message: "Cannot delete super admin" });
  }

  const callerId = req.user && req.user.userId;
  if (callerId === id) {
    return res.status(403).json({ code: 403, message: "Cannot delete yourself" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function resetPassword(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const { new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({
      code: 400,
      message: "new_password is required and must be at least 6 characters",
    });
  }

  const row = db.prepare("SELECT 1 FROM users WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ code: 404, message: "User not found" });

  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
    hashPassword(new_password),
    nowIso(),
    id
  );

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { reset: true },
  });
}

function assignRoles(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const target = db
    .prepare("SELECT id, is_super_admin FROM users WHERE id = ?")
    .get(id);
  if (!target) return res.status(404).json({ code: 404, message: "User not found" });
  if (target.is_super_admin === 1) {
    return res.status(403).json({
      code: 403,
      message: "Cannot modify super admin roles",
    });
  }

  const { role_ids } = req.body || {};
  if (
    !Array.isArray(role_ids) ||
    !role_ids.every((x) => Number.isFinite(Number(x)))
  ) {
    return res.status(400).json({
      code: 400,
      message: "role_ids must be an array of integers",
    });
  }

  setUserRoles(db, id, role_ids);
  const roles = listUserRoles(db, id);
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { userId: id, roles },
  });
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  assignRoles,
};
