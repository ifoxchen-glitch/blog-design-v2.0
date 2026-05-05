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

module.exports = {
  createBackup,
  deleteBackupRecord,
  listBackups,
  getBackupById,
  getBackupPath,
  BACKUP_DIR,
};
