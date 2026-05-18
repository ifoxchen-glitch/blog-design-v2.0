const crypto = require("node:crypto");
const { openDb } = require("../db");

function getPublishApiKey() {
  const db = openDb();
  const settings = db.prepare("SELECT publish_api_key, publish_api_key_enabled FROM system_settings WHERE id = 1").get();
  return {
    key: settings?.publish_api_key || "",
    enabled: settings?.publish_api_key_enabled === 1,
  };
}

function requirePublishApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query["api_key"];
  const { key: storedKey, enabled } = getPublishApiKey();

  if (!storedKey) {
    return res.status(503).json({ error: "api_key_not_configured" });
  }

  if (!enabled) {
    return res.status(503).json({ error: "api_key_disabled" });
  }

  if (!apiKey) {
    return res.status(401).json({ error: "invalid_api_key" });
  }

  try {
    const a = Buffer.from(apiKey, "utf8");
    const b = Buffer.from(storedKey, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "invalid_api_key" });
    }
  } catch {
    return res.status(401).json({ error: "invalid_api_key" });
  }

  next();
}

module.exports = requirePublishApiKey;