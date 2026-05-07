const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { openDb } = require("../../../db");
const { normalizeSlug } = require("../../../utils");

let _syncing = false;

function acquireLock() {
  if (_syncing) return false;
  _syncing = true;
  return true;
}
function releaseLock() {
  _syncing = false;
}
function isRunning() {
  return _syncing;
}

function computeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Recursively scan a directory for .md files, returning file info with checksums.
 */
function scanVault(vaultPath) {
  const results = [];
  if (!fs.existsSync(vaultPath)) return results;

  const resolved = path.resolve(vaultPath);
  const normalized = path.normalize(resolved);

  function walk(dir) {
    if (dir.length > 4000) return; // guard against too-deep recursion
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable dirs
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      // Prevent escaping the vault via symlinks
      const real = path.normalize(full);
      if (!real.startsWith(normalized + path.sep) && real !== normalized) continue;
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.size > MAX_FILE_SIZE) continue;
        const relPath = path.relative(vaultPath, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full, "utf8");
        results.push({
          relativePath: relPath,
          content,
          checksum: computeChecksum(content),
          size: stat.size,
        });
      }
    }
  }
  walk(vaultPath);
  return results;
}

function slugFromPath(relativePath) {
  return relativePath
    .replace(/\.md$/, "")
    .replace(/[\\/]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Import a single file into kb_documents.
 * Returns { action, id, path, detail? }
 */
function importDocument(db, fileInfo, conflictStrategy, now, source) {
  const src = source || "obsidian";
  const existing = db
    .prepare("SELECT * FROM kb_documents WHERE original_path = ? AND source = ?")
    .get(fileInfo.relativePath, src);

  if (!existing) {
    const slug = normalizeSlug(slugFromPath(fileInfo.relativePath)) || slugFromPath(fileInfo.relativePath);
    const tags = JSON.stringify([]);
    const title = fileInfo.relativePath.replace(/\.md$/, "").split("/").pop();
    const wordCount = fileInfo.content.split(/\s+/).filter(Boolean).length;
    const info = db
      .prepare(
        `INSERT INTO kb_documents (title, slug, content_markdown, source, original_path, checksum, tags, status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .run(title, slug, fileInfo.content, src, fileInfo.relativePath, fileInfo.checksum, tags, wordCount, now, now);
    return { action: "imported", id: info.lastInsertRowid, path: fileInfo.relativePath };
  }

  if (existing.checksum === fileInfo.checksum) {
    return { action: "skipped", id: existing.id, path: fileInfo.relativePath };
  }

  if (conflictStrategy === "skip") {
    return {
      action: "conflict",
      id: existing.id,
      path: fileInfo.relativePath,
      detail: "checksum differs, skipped per conflict strategy",
    };
  }

  if (conflictStrategy === "keep_both") {
    const newSlug = existing.slug + "-" + Date.now();
    const title = existing.title + " (冲突副本)";
    const wordCount = fileInfo.content.split(/\s+/).filter(Boolean).length;
    const tags = JSON.stringify([]);
    const info = db
      .prepare(
        `INSERT INTO kb_documents (title, slug, content_markdown, source, original_path, checksum, tags, status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, 'obsidian', ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .run(title, newSlug, fileInfo.content, fileInfo.relativePath, fileInfo.checksum, tags, wordCount, now, now);
    return { action: "conflict", id: info.lastInsertRowid, path: fileInfo.relativePath, detail: "created conflict copy" };
  }

  // last_write_wins
  const wordCount = fileInfo.content.split(/\s+/).filter(Boolean).length;
  db.prepare(
    "UPDATE kb_documents SET content_markdown = ?, checksum = ?, content_html = NULL, word_count = ?, updated_at = ? WHERE id = ?",
  ).run(fileInfo.content, fileInfo.checksum, wordCount, now, existing.id);
  return { action: "updated", id: existing.id, path: fileInfo.relativePath };
}

/**
 * Import a batch of files into kb_documents. Shared by both file-system and CouchDB sources.
 * @param {Array<{relativePath: string, content: string, checksum: string, size: number}>} files
 * @param {string} conflictStrategy
 * @param {string} source - "obsidian" or "couchdb"
 * @returns {Promise<{imported: number, updated: number, skipped: number, conflicted: number, errors: number}>}
 */
async function importFromFiles(files, conflictStrategy, source) {
  const db = openDb();
  const now = new Date().toISOString();
  const summary = { imported: 0, updated: 0, skipped: 0, conflicted: 0, errors: 0 };
  const logStmt = db.prepare(
    `INSERT INTO kb_sync_logs (direction, file_path, document_id, status, checksum, detail, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const f of files) {
    try {
      // Temporarily patch the importDocument to use the given source
      const result = importDocument(db, f, conflictStrategy, now, source);
      const statusMap = {
        imported: "success",
        updated: "success",
        skipped: "skipped",
        conflict: "conflict",
      };
      if (summary[result.action] !== undefined) summary[result.action]++;
      logStmt.run(
        "import",
        f.relativePath,
        result.id || null,
        statusMap[result.action] || "error",
        f.checksum,
        result.detail || null,
        now,
      );
    } catch (err) {
      summary.errors++;
      logStmt.run("import", f.relativePath, null, "error", f.checksum, err.message, now);
    }
  }

  db.prepare("UPDATE kb_sync_config SET last_sync_at = ?, updated_at = ? WHERE id = 1").run(now, now);

  // Flush WAL to disk
  try { db.pragma("wal_checkpoint(PASSIVE)"); } catch { /* ignore */ }

  return summary;
}

/**
 * Full import from filesystem: scan vault, import each file, log results.
 */
async function fullImport(vaultPath, conflictStrategy) {
  if (!acquireLock()) throw new Error("同步正在进行中，请稍后重试");
  try {
    const files = scanVault(vaultPath);
    return await importFromFiles(files, conflictStrategy, "obsidian");
  } catch (err) {
    const summary = { imported: 0, updated: 0, skipped: 0, conflicted: 0, errors: 1 };
    return summary;
  } finally {
    releaseLock();
  }
}

/**
 * Full import from CouchDB (LiveSync): fetch docs, import each, log results.
 */
async function fullImportFromCouchDB(couchConfig, conflictStrategy) {
  if (!acquireLock()) throw new Error("同步正在进行中，请稍后重试");
  try {
    const { fetchFromCouchDB } = require("./couchdbAdapter");
    const files = await fetchFromCouchDB(couchConfig);
    return await importFromFiles(files, conflictStrategy, "couchdb");
  } catch (err) {
    // Re-throw to let the handler respond with error details
    throw err;
  } finally {
    releaseLock();
  }
}

module.exports = { scanVault, importDocument, fullImport, fullImportFromCouchDB, importFromFiles, computeChecksum, acquireLock, releaseLock, isRunning, MAX_FILE_SIZE };
