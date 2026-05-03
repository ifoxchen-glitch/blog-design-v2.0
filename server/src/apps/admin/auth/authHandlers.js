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

module.exports = { login, refresh };
