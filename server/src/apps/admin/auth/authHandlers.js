const { openDb } = require("../../../db");
const {
  verifyV2Login,
  signV2AccessToken,
  signV2RefreshToken,
  verifyV2Refresh,
} = require("../../../auth");
const { nowIso } = require("../../../utils");

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ code: 400, message: "Missing email or password" });
  }

  const db = openDb();

  let user;
  try {
    user = await verifyV2Login(db, { email, password });
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message });
  }

  if (!user) {
    return res.status(401).json({ code: 401, message: "Invalid email or password" });
  }

  let accessToken;
  let refreshToken;
  try {
    accessToken = signV2AccessToken(user);
    refreshToken = signV2RefreshToken(user);
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message });
  }

  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), user.id);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || null,
        avatarUrl: user.avatar_url || null,
        isSuperAdmin: user.is_super_admin === 1,
        roles: user.roles || [],
      },
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ code: 400, message: "Missing refreshToken" });
  }

  const db = openDb();

  let result;
  try {
    result = verifyV2Refresh(db, refreshToken);
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message });
  }

  if (!result.ok) {
    const message =
      result.code === "expired"
        ? "Refresh token expired"
        : result.code === "user_disabled"
        ? "User not found or disabled"
        : "Invalid refresh token";
    return res.status(401).json({ code: 401, message });
  }

  let accessToken;
  try {
    accessToken = signV2AccessToken(result.user);
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message });
  }

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { accessToken },
  });
}

async function logout(req, res) {
  // Stateless JWT — server has nothing to invalidate. The client is
  // responsible for clearing access/refresh tokens. A blacklist /
  // refresh-rotation table can be added later without changing this
  // contract: returning 200 means "you are logged out as far as we
  // care".
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { loggedOut: true },
  });
}

function loadUserPermissions(db, userId, isSuperAdmin) {
  if (isSuperAdmin) {
    return db.prepare(`SELECT code FROM permissions ORDER BY id`).all().map((r) => r.code);
  }
  return db
    .prepare(
      `SELECT DISTINCT p.code FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
        WHERE ur.user_id = ?
        ORDER BY p.code`
    )
    .all(userId)
    .map((r) => r.code);
}

async function me(req, res) {
  const db = openDb();
  const userId = req.user && req.user.userId;
  const user = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url,
              status, is_super_admin, last_login_at, created_at
         FROM users
        WHERE id = ? AND status = 'active'`
    )
    .get(userId);
  if (!user) {
    return res.status(401).json({ code: 401, message: "User not found or disabled" });
  }

  const roles = db
    .prepare(
      `SELECT r.id, r.code, r.name FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
        WHERE ur.user_id = ?
        ORDER BY r.id`
    )
    .all(userId);

  const permissions = loadUserPermissions(db, userId, user.is_super_admin === 1);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name || null,
      avatarUrl: user.avatar_url || null,
      isSuperAdmin: user.is_super_admin === 1,
      lastLoginAt: user.last_login_at || null,
      createdAt: user.created_at,
      roles,
      permissions,
    },
  });
}

async function menus(req, res) {
  const db = openDb();
  const userId = req.user && req.user.userId;
  const user = db
    .prepare(`SELECT is_super_admin FROM users WHERE id = ? AND status = 'active'`)
    .get(userId);
  if (!user) {
    return res.status(401).json({ code: 401, message: "User not found or disabled" });
  }

  const allRows = db
    .prepare(
      `SELECT id, parent_id, name, path, icon, permission_code, sort_order
         FROM menus
        WHERE status = 'active'
        ORDER BY sort_order, id`
    )
    .all();

  let visibleRows;
  if (user.is_super_admin === 1) {
    visibleRows = allRows;
  } else {
    const allowed = new Set(loadUserPermissions(db, userId, false));
    visibleRows = allRows.filter((m) => !m.permission_code || allowed.has(m.permission_code));
  }

  const byId = new Map();
  for (const row of visibleRows) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots = [];
  for (const row of visibleRows) {
    const node = byId.get(row.id);
    if (row.parent_id == null) {
      roots.push(node);
    } else {
      const parent = byId.get(row.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return res.status(200).json({
    code: 200,
    message: "success",
    data: roots,
  });
}

module.exports = { login, refresh, logout, me, menus };
