const jwt = require("jsonwebtoken");

function jwtAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({
      code: 401,
      message: "Missing or malformed Authorization header",
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      code: 500,
      message: "Server JWT_SECRET not configured",
    });
  }

  let payload;
  try {
    payload = jwt.verify(m[1], secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ code: 401, message: "Token expired" });
    }
    return res.status(401).json({ code: 401, message: "Invalid token" });
  }

  if (payload.type !== "admin") {
    return res.status(401).json({ code: 401, message: "Invalid token type" });
  }

  req.user = {
    userId: payload.userId,
    username: payload.username,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    type: payload.type,
  };
  next();
}

module.exports = jwtAuth;
