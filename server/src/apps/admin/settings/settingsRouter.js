const express = require("express");
const { openDb } = require("../../../db");
const { nowIso } = require("../../../utils");

const router = express.Router();

// Get system settings
router.get("/", (req, res) => {
  const db = openDb();
  const settings = db.prepare("SELECT * FROM system_settings WHERE id = 1").get();
  res.json({
    code: 0,
    message: "ok",
    data: settings || { open_webui_url: "", open_webui_api_key: "" },
  });
});

// Update system settings
router.put("/", (req, res) => {
  const { open_webui_url, open_webui_api_key } = req.body;
  const db = openDb();
  const now = nowIso();

  db.prepare(
    `INSERT INTO system_settings (id, open_webui_url, open_webui_api_key, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       open_webui_url = excluded.open_webui_url,
       open_webui_api_key = excluded.open_webui_api_key,
       updated_at = excluded.updated_at`
  ).run(open_webui_url || "", open_webui_api_key || "", now, now);

  res.json({
    code: 0,
    message: "Settings updated",
    data: { open_webui_url: open_webui_url || "", open_webui_api_key: open_webui_api_key || "" },
  });
});

module.exports = router;