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
    data: settings || {
      open_webui_url: "",
      open_webui_api_key: "",
      iot_api_base_url: "",
      iot_app_id: "",
      iot_app_secret: "",
      iot_sync_enabled: 1,
      iot_sync_interval: 60,
      publish_api_key: "",
      publish_api_key_enabled: 1,
    },
  });
});

// Update system settings
router.put("/", (req, res) => {
  const {
    open_webui_url,
    open_webui_api_key,
    iot_api_base_url,
    iot_app_id,
    iot_app_secret,
    iot_sync_enabled,
    iot_sync_interval,
    publish_api_key,
    publish_api_key_enabled,
  } = req.body;
  const db = openDb();
  const now = nowIso();

  db.prepare(
    `INSERT INTO system_settings (id, open_webui_url, open_webui_api_key, iot_api_base_url, iot_app_id, iot_app_secret, iot_sync_enabled, iot_sync_interval, publish_api_key, publish_api_key_enabled, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       open_webui_url = excluded.open_webui_url,
       open_webui_api_key = excluded.open_webui_api_key,
       iot_api_base_url = excluded.iot_api_base_url,
       iot_app_id = excluded.iot_app_id,
       iot_app_secret = excluded.iot_app_secret,
       iot_sync_enabled = excluded.iot_sync_enabled,
       iot_sync_interval = excluded.iot_sync_interval,
       publish_api_key = excluded.publish_api_key,
       publish_api_key_enabled = excluded.publish_api_key_enabled,
       updated_at = excluded.updated_at`
  ).run(
    open_webui_url || "",
    open_webui_api_key || "",
    iot_api_base_url || "",
    iot_app_id || "",
    iot_app_secret || "",
    iot_sync_enabled !== undefined ? (iot_sync_enabled ? 1 : 0) : 1,
    iot_sync_interval !== undefined ? Math.max(5, Math.min(1440, parseInt(iot_sync_interval, 10) || 60)) : 60,
    publish_api_key !== undefined ? publish_api_key : "",
    publish_api_key_enabled !== undefined ? (publish_api_key_enabled ? 1 : 0) : 1,
    now,
    now
  );

  // Notify iotHourlySync to restart schedule with new config
  const { restartSchedule } = require("../../../jobs/iotHourlySync");
  try { restartSchedule(); } catch { /* ignore */ }

  res.json({
    code: 0,
    message: "Settings updated",
    data: {
      open_webui_url: open_webui_url || "",
      open_webui_api_key: open_webui_api_key || "",
      iot_api_base_url: iot_api_base_url || "",
      iot_app_id: iot_app_id || "",
      iot_app_secret: iot_app_secret || "",
      iot_sync_enabled: iot_sync_enabled !== undefined ? !!iot_sync_enabled : true,
      iot_sync_interval: iot_sync_interval !== undefined ? parseInt(iot_sync_interval, 10) || 60 : 60,
      publish_api_key: publish_api_key !== undefined ? publish_api_key : "",
      publish_api_key_enabled: publish_api_key_enabled !== undefined ? !!publish_api_key_enabled : true,
    },
  });
});

module.exports = router;
