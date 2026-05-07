const cron = require("node-cron");
const { openDb } = require("../db");
const { fullImport, fullImportFromCouchDB } = require("../apps/admin/kb/syncEngine");

let _task = null;

function loadConfig() {
  const db = openDb();
  return db.prepare("SELECT * FROM kb_sync_config WHERE id = 1").get();
}

function startSchedule() {
  const config = loadConfig();
  if (!config || !config.auto_sync_enabled) return;

  // Must have either vault_path or couchdb configured
  const hasFilesystem = !!(config.vault_path);
  const hasCouchDB = !!(config.couchdb_enabled && config.couchdb_url && config.couchdb_db_name);
  if (!hasFilesystem && !hasCouchDB) return;

  const minutes = Math.max(1, Math.min(config.sync_interval_minutes || 30, 1440));
  const cronExpr = `*/${minutes} * * * *`;

  if (_task) _task.stop();
  _task = cron.schedule(
    cronExpr,
    () => {
      const strategy = config.conflict_strategy || "last_write_wins";

      console.log(`[cron] kbSync: starting — filesystem=${hasFilesystem} couchdb=${hasCouchDB}`);

      if (hasCouchDB) {
        fullImportFromCouchDB(
          {
            url: config.couchdb_url,
            dbName: config.couchdb_db_name,
            username: config.couchdb_username || undefined,
            password: config.couchdb_password || undefined,
          },
          strategy,
        )
          .then((summary) => {
            console.log(
              `[cron] kbSync (couchdb): done — imported=${summary.imported} updated=${summary.updated} skipped=${summary.skipped} conflicted=${summary.conflicted} errors=${summary.errors}`,
            );
          })
          .catch((err) => {
            console.error("[cron] kbSync (couchdb) failed:", err.message);
          });
      } else {
        fullImport(config.vault_path, strategy)
          .then((summary) => {
            console.log(
              `[cron] kbSync: done — imported=${summary.imported} updated=${summary.updated} skipped=${summary.skipped} conflicted=${summary.conflicted} errors=${summary.errors}`,
            );
          })
          .catch((err) => {
            console.error("[cron] kbSync failed:", err.message);
          });
      }
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
