const { openDb } = require("../db");

function requirePermission(code) {
  const db = openDb();
  const findUser = db.prepare(
    "SELECT is_super_admin FROM users WHERE id = ? AND status = 'active'"
  );
  const findPerm = db.prepare(`
    SELECT 1 AS hit
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
    WHERE ur.user_id = ? AND p.code = ?
    LIMIT 1
  `);

  return function rbac(req, res, next) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ code: 401, message: "Unauthenticated" });
    }

    const u = findUser.get(req.user.userId);
    if (!u) {
      return res.status(401).json({ code: 401, message: "User not found or disabled" });
    }
    if (u.is_super_admin === 1) {
      return next();
    }

    const hit = findPerm.get(req.user.userId, code);
    if (hit) return next();

    return res.status(403).json({
      code: 403,
      message: `Permission denied: ${code}`,
    });
  };
}

module.exports = requirePermission;
