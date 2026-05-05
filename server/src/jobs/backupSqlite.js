const cron = require("node-cron");
const { createBackup } = require("../utils/backup");
const { runCleanup } = require("./backupCleanup");

function register() {
  // 每天 02:00 执行自动备份
  cron.schedule("0 2 * * *", () => {
    try {
      console.log("[cron] starting scheduled SQLite backup...");
      const result = createBackup("scheduled", "每日自动备份");
      console.log(`[cron] backup done: ${result.filename} (${result.size} bytes)`);
      // 备份成功后执行清理
      runCleanup();
    } catch (err) {
      console.error("[cron] scheduled backup failed:", err.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai",
  });
  console.log("[cron] backupSqlite job registered (0 2 * * *)");
}

module.exports = { register };
