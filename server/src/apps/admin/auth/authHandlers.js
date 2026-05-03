const { openDb } = require("../../../db");
const { verifyV2Login, signV2AccessToken, signV2RefreshToken } = require("../../../auth");
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

module.exports = { login };
