const bcrypt = require("bcryptjs");

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

module.exports = {
  verifyAdminLogin,
  requireAdmin,
  requireAdminPage,
};

