const path = require("node:path");
const fs = require("node:fs");
const { openDb } = require("../db");
const { nowIso } = require("../utils");

const BACKUP_DIR = path.join(__dirname, "..", "..", "db", "backups");

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function generateFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `backup-${ts}.sqlite`;
}

function createBackup(type = "manual", note = "") {
  ensureBackupDir();
  const db = openDb();
  const filename = generateFilename();
  const destPath = path.join(BACKUP_DIR, filename);

  // Use VACUUM INTO for reliable online backup (SQLite 3.27+).
  // better-sqlite3's db.backup() step() API is flaky in Alpine containers.
  db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);

  const stats = fs.statSync(destPath);
  const size = stats.size;

  const row = db.prepare(`
    INSERT INTO backups (filename, size, type, status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(filename, size, type, "ok", note || null, nowIso());

  return { id: row.lastInsertRowid, filename, size, path: destPath };
}

function deleteBackupRecord(id) {
  const db = openDb();
  const record = db.prepare(`SELECT filename FROM backups WHERE id = ?`).get(id);
  if (!record) return false;

  const filePath = path.join(BACKUP_DIR, record.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  db.prepare(`DELETE FROM backups WHERE id = ?`).run(id);
  return true;
}

function listBackups({ page = 1, pageSize = 20, type, status }) {
  const db = openDb();
  const conditions = [];
  const params = [];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM backups ${where}`).get(...params);
  const total = countRow?.total || 0;

  const offset = (page - 1) * pageSize;
  const items = db.prepare(
    `SELECT id, filename, size, type, status, note, created_at FROM backups ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { items, total, page, pageSize };
}

function getBackupById(id) {
  const db = openDb();
  return db.prepare(`SELECT id, filename, size, type, status, note, created_at FROM backups WHERE id = ?`).get(id);
}

function getBackupPath(filename) {
  return path.join(BACKUP_DIR, filename);
}

function getDbPath() {
  return path.join(__dirname, "..", "..", "db", "blog.sqlite");
}

/**
 * 从备份文件还原数据库。
 * 1. 先对当前 DB 做安全快照（type='manual', note='restore-snapshot'）
 * 2. 关闭 better-sqlite3 句柄
 * 3. 复制备份文件覆盖 blog.sqlite，并删除 -wal/-shm
 * 4. 调用 reopen 让下次 openDb 重新打开
 * 注意：调用方必须在还原后重启进程或确保所有引用 _db 的模块重新拿句柄。
 */
function restoreFromBackup(id) {
  const db = openDb();
  const record = db.prepare(`SELECT * FROM backups WHERE id = ?`).get(id);
  if (!record) return { ok: false, message: "备份不存在" };

  const backupFile = getBackupPath(record.filename);
  if (!fs.existsSync(backupFile)) {
    return { ok: false, message: "备份文件已丢失" };
  }

  // 1. 还原前先做一次快照
  let snapshot;
  try {
    snapshot = createBackup("manual", `restore-snapshot before #${id}`);
  } catch (err) {
    return { ok: false, message: "还原前快照失败: " + err.message };
  }

  // 2. 关闭句柄
  try {
    db.close();
  } catch { /* ignore */ }
  // 让 db 模块在下次 openDb 重新打开
  require("../db").__resetForRestore?.();

  const dbPath = getDbPath();

  try {
    // 3. 删除 wal/shm 文件
    for (const ext of ["-wal", "-shm"]) {
      const f = dbPath + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    // 复制备份覆盖
    fs.copyFileSync(backupFile, dbPath);
  } catch (err) {
    return { ok: false, message: "还原失败: " + err.message, snapshotId: snapshot.id };
  }

  // 4. 标记原备份为已还原
  try {
    const ndb = openDb();
    ndb.prepare(`UPDATE backups SET status = 'restored' WHERE id = ?`).run(id);
  } catch { /* ignore */ }

  return { ok: true, snapshotId: snapshot.id, restoredFrom: record.filename };
}

/**
 * 从上传的 sqlite 文件创建一条备份记录（不还原，仅入库）
 */
function importBackup(srcFilePath, originalName, note) {
  ensureBackupDir();
  const db = openDb();
  // 重命名为标准格式
  const filename = generateFilename().replace(".sqlite", "-imported.sqlite");
  const destPath = path.join(BACKUP_DIR, filename);
  fs.copyFileSync(srcFilePath, destPath);
  const size = fs.statSync(destPath).size;
  const row = db.prepare(`
    INSERT INTO backups (filename, size, type, status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(filename, size, "manual", "ok", note || `imported from ${originalName}`, nowIso());
  return { id: row.lastInsertRowid, filename, size };
}

module.exports = {
  createBackup,
  deleteBackupRecord,
  listBackups,
  getBackupById,
  getBackupPath,
  restoreFromBackup,
  importBackup,
  BACKUP_DIR,
};
