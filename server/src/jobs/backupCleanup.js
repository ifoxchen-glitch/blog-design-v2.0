const fs = require("node:fs");
const path = require("node:path");
const { openDb } = require("../db");
const { BACKUP_DIR, deleteBackupRecord } = require("../utils/backup");

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function runCleanup() {
  const db = openDb();
  const rows = db.prepare(`
    SELECT id, filename, created_at FROM backups WHERE status = 'ok' ORDER BY created_at DESC
  `).all();

  if (rows.length === 0) return;

  const now = new Date();
  const keepIds = new Set();

  // 保留最近 7 天的每日备份
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const match = rows.find((r) => r.created_at.slice(0, 10) === dayStr);
    if (match) keepIds.add(match.id);
  }

  // 保留最近 4 周的每周一备份（取每周最早的）
  const weekMap = new Map(); // weekStartStr -> earliest row
  for (const row of rows) {
    const d = new Date(row.created_at);
    const monday = getMonday(d);
    const key = monday.toISOString().slice(0, 10);
    const existing = weekMap.get(key);
    if (!existing || new Date(row.created_at) < new Date(existing.created_at)) {
      weekMap.set(key, row);
    }
  }

  const weekKeys = Array.from(weekMap.keys()).sort().reverse().slice(0, 4);
  for (const k of weekKeys) {
    keepIds.add(weekMap.get(k).id);
  }

  let deleted = 0;
  for (const row of rows) {
    if (!keepIds.has(row.id)) {
      try {
        deleteBackupRecord(row.id);
        deleted++;
      } catch (err) {
        console.error(`[backupCleanup] failed to delete backup ${row.id}:`, err.message);
      }
    }
  }

  console.log(`[backupCleanup] cleanup complete. kept ${keepIds.size}, deleted ${deleted}`);
}

module.exports = { runCleanup };
