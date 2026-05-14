const cron = require("node-cron");
const { snapshotCards } = require("../apps/admin/iot/cardHandlers");
const { openDb } = require("../db");

let _task = null;

function loadConfig() {
  const db = openDb();
  const settings = db.prepare("SELECT iot_sync_enabled, iot_sync_interval FROM system_settings WHERE id = 1").get();
  return {
    enabled: settings?.iot_sync_enabled === 1,
    interval: Math.max(5, Math.min(1440, settings?.iot_sync_interval || 60)),
  };
}

function startSchedule() {
  const { enabled, interval } = loadConfig();

  if (_task) _task.stop();

  if (!enabled) {
    console.log("[cron] iotHourlySync: disabled in settings");
    return;
  }

  // Convert interval minutes to cron expression
  let cronExpr;
  if (interval <= 60) {
    // Every N minutes
    cronExpr = `*/${interval} * * * *`;
  } else {
    // Every N hours (e.g. 120 min = every 2 hours)
    const hours = Math.floor(interval / 60);
    cronExpr = `0 */${hours} * * *`;
  }

  _task = cron.schedule(
    cronExpr,
    () => {
      try {
        console.log("[cron] iotHourlySync: starting snapshot...");
        const count = snapshotCards();
        console.log(`[cron] iotHourlySync: done — snapshotted ${count} cards`);
      } catch (err) {
        console.error("[cron] iotHourlySync failed:", err.message);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Shanghai",
    },
  );
  console.log(`[cron] iotHourlySync job registered (${cronExpr}, interval=${interval}min)`);
}

function restartSchedule() {
  if (_task) _task.stop();
  startSchedule();
}

function register() {
  startSchedule();
}

module.exports = { register, startSchedule, restartSchedule };
