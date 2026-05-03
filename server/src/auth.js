const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function constantTimeEquals(a, b) {
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  if (sa.length !== sb.length) return false;
  let out = 0;
  for (let i = 0; i < sa.length; i++) out |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return out === 0;
}

async function verifyAdminLogin({ email, password }, { adminEmail, adminPassword, adminPasswordHash }) {
  if (!constantTimeEquals(email, adminEmail)) return false;
  if (adminPasswordHash) return await bcrypt.compare(String(password ?? ""), adminPasswordHash);
  return constantTimeEquals(password, adminPassword);
}

function requireAdmin(req, res, next) {
  if (req.session?.admin?.loggedIn) return next();
  return res.status(401).json({ error: "unauthorized" });
}

function requireAdminPage(req, res, next) {
  if (req.session?.admin?.loggedIn) return next();
  return res.redirect("/admin/login");
}

async function verifyV2Login(db, { email, password }) {
  if (!email || !password) return null;

  const user = db
    .prepare(
      `SELECT id, username, email, password_hash, display_name, avatar_url,
              status, is_super_admin
         FROM users
        WHERE email = ? AND status = 'active'`
    )
    .get(String(email));
  if (!user) return null;

  const ok = await bcrypt.compare(String(password), String(user.password_hash || ""));
  if (!ok) return null;

  const roles = db
    .prepare(
      `SELECT r.code FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
        WHERE ur.user_id = ?`
    )
    .all(user.id)
    .map((row) => row.code);

  return { ...user, roles };
}

function signV2AccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  const expiresIn = process.env.ADMIN_JWT_ACCESS_EXPIRES || "2h";
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      roles: Array.isArray(user.roles) ? user.roles : [],
      type: "admin",
    },
    secret,
    { expiresIn }
  );
}

function signV2RefreshToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  const expiresIn = process.env.ADMIN_JWT_REFRESH_EXPIRES || "7d";
  return jwt.sign({ userId: user.id, type: "refresh" }, secret, { expiresIn });
}

function verifyV2Refresh(db, refreshToken) {
  if (!refreshToken) return { ok: false, code: "missing" };
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");

  let payload;
  try {
    payload = jwt.verify(String(refreshToken), secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") return { ok: false, code: "expired" };
    return { ok: false, code: "invalid" };
  }
  if (payload.type !== "refresh") return { ok: false, code: "wrong_type" };
  if (!payload.userId) return { ok: false, code: "invalid" };

  const user = db
    .prepare(
      `SELECT id, username, email, display_name, avatar_url,
              status, is_super_admin
         FROM users
        WHERE id = ? AND status = 'active'`
    )
    .get(payload.userId);
  if (!user) return { ok: false, code: "user_disabled" };

  const roles = db
    .prepare(
      `SELECT r.code FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.status = 'active'
        WHERE ur.user_id = ?`
    )
    .all(user.id)
    .map((row) => row.code);

  return { ok: true, user: { ...user, roles } };
}

module.exports = {
  verifyAdminLogin,
  requireAdmin,
  requireAdminPage,
  verifyV2Login,
  signV2AccessToken,
  signV2RefreshToken,
  verifyV2Refresh,
};

