const cron = require("node-cron");
const { openDb } = require("../db");
const { fullImport } = require("../apps/admin/kb/syncEngine");

let _task = null;

function loadConfig() {
  const db = openDb();
  return db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
}

function startSchedule() {
  const config = loadConfig();
  if (!config || !config.auto_sync_enabled) return;

  if (!config.vault_path) return;

  const minutes = Math.max(1, Math.min(config.sync_interval_minutes || 30, 1440));
  const cronExpr = `*/${minutes} * * * *`;

  if (_task) _task.stop();
  _task = cron.schedule(
    cronExpr,
    () => {
      const strategy = config.conflict_strategy || "last_write_wins";

      console.log(`[cron] kbSync: starting — vault_path=${config.vault_path}`);

      fullImport(config.vault_path, strategy)
        .then((summary) => {
          console.log(
            `[cron] kbSync: done — imported=${summary.imported} updated=${summary.updated} skipped=${summary.skipped} conflicted=${summary.conflicted} errors=${summary.errors}`,
          );
        })
        .catch((err) => {
          console.error("[cron] kbSync failed:", err.message);
        });
    },
    {
      scheduled: true,
      timezone: "Asia/Shanghai",
    },
  );
  console.log(`[cron] kbSync job registered (${cronExpr})`);
}

function restartSchedule() {
  if (_task) _task.stop();
  startSchedule();
}

function register() {
  startSchedule();
}

module.exports = { register, startSchedule, restartSchedule };
