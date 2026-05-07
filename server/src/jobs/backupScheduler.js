const cron = require("node-cron");
const { openDb } = require("../db");
const { createBackup } = require("../utils/backup");
const { runCleanup } = require("./backupCleanup");

let _task = null;

function loadSchedule() {
  const db = openDb();
  const row = db.prepare(`SELECT * FROM backup_schedules ORDER BY id DESC LIMIT 1`).get();
  return row || null;
}

function startSchedule(row) {
  stopSchedule();
  if (!row || !row.enabled) return;

  const valid = cron.validate(row.cron);
  if (!valid) {
    console.error("[backupScheduler] invalid cron expression:", row.cron);
    return;
  }

  _task = cron.schedule(row.cron, () => {
    try {
      console.log("[cron] starting scheduled SQLite backup...");
      const result = createBackup("scheduled", "定时备份");
      console.log(`[cron] backup done: ${result.filename} (${result.size} bytes)`);
      runCleanup();
    } catch (err) {
      console.error("[cron] scheduled backup failed:", err.message);
    }
  }, {
    scheduled: true,
    timezone: row.timezone || "Asia/Shanghai",
  });
  console.log(`[backupScheduler] schedule started: ${row.cron} (${row.timezone || "Asia/Shanghai"})`);
}

function stopSchedule() {
  if (_task) {
    _task.stop();
    _task = null;
    console.log("[backupScheduler] schedule stopped");
  }
}

function restartSchedule() {
  const row = loadSchedule();
  if (row) {
    startSchedule(row);
  } else {
    stopSchedule();
  }
}

function register() {
  restartSchedule();
}

module.exports = {
  register,
  loadSchedule,
  startSchedule,
  stopSchedule,
  restartSchedule,
};
