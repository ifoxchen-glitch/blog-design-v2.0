const { openDb } = require("../db");
const { nowIso } = require("../utils");

const SENSITIVE_FIELDS = [
  "password",
  "new_password",
  "old_password",
  "password_hash",
  "token",
  "refresh_token",
  "access_token",
  "secret",
];

const SKIP_PATHS = [
  /^\/health/,
  /^\/api\/v2\/auth\/refresh$/,
];

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.includes(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function singularize(word) {
  if (!word) return "";
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function inferResourceType(path) {
  // Match /api/v2/admin/<group>/<resource> or /api/v2/admin/<resource>
  const m = path.match(/\/api\/v2(?:\/admin)?\/(?:[^/]+\/)?(?<resource>[^/]+)/);
  if (m && m.groups && m.groups.resource) {
    return singularize(m.groups.resource);
  }
  return path;
}

function auditLogger() {
  return function (req, res, next) {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "OPTIONS" || method === "HEAD") {
      return next();
    }

    const fullPath = (req.baseUrl || "") + (req.path || "");
    if (SKIP_PATHS.some((re) => re.test(fullPath))) {
      return next();
    }

    const startedAt = Date.now();
    const captureBody = req.body
      ? JSON.parse(JSON.stringify(req.body))
      : null;

    res.on("finish", () => {
      try {
        const db = openDb();
        const username =
          req.user?.username ||
          (fullPath.endsWith("/auth/login")
            ? captureBody?.email || captureBody?.username || null
            : null) ||
          null;

        db.prepare(`
          INSERT INTO audit_logs
            (user_id, username, action, resource_type, resource_id, detail, ip, user_agent, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user?.userId || null,
          username,
          method.toLowerCase(),
          inferResourceType(fullPath),
          req.params?.id || null,
          JSON.stringify({
            status: res.statusCode,
            body: sanitizeBody(captureBody),
            query: req.query || {},
            durationMs: Date.now() - startedAt,
          }),
          req.ip || null,
          req.headers["user-agent"] || null,
          nowIso()
        );
      } catch (err) {
        // Audit failure must never break the main request flow
        console.error("[auditLogger] write failed:", err.message);
      }
    });

    next();
  };
}

module.exports = auditLogger;
