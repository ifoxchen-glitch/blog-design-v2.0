const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { openDb } = require("../../../db");
const { normalizeSlug } = require("../../../utils");
const { parseFrontMatter, buildFrontMatter } = require("./frontmatter");

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
 * Recursively scan the wiki/ subdirectory for .md files, returning file info with checksums.
 */
function scanVault(vaultPath) {
  const results = [];
  const wikiPath = path.join(vaultPath, "wiki");
  if (!fs.existsSync(wikiPath)) return results;

  const resolved = path.resolve(wikiPath);
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
        const relPath = path.relative(wikiPath, full).replace(/\\/g, "/");
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
  walk(wikiPath);
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
 * Parses YAML front matter to extract title, type, tags, connections, sources, dates, status.
 * Returns { action, id, path, detail? }
 */
function importDocument(db, fileInfo, conflictStrategy, now, source) {
  const src = source || "obsidian";

  // Parse YAML front matter
  const { attributes, body } = parseFrontMatter(fileInfo.content);

  // Extract fields from YAML with sensible defaults
  const title = (attributes.title && String(attributes.title).trim())
    || fileInfo.relativePath.replace(/\.md$/, "").split("/").pop();

  const docType = ["entity", "concept", "source", "synthesis"].includes(attributes.type)
    ? attributes.type : null;

  const tags = Array.isArray(attributes.tags)
    ? JSON.stringify(attributes.tags.filter(Boolean))
    : JSON.stringify([]);

  const connections = Array.isArray(attributes.connections)
    ? JSON.stringify(attributes.connections.filter(Boolean))
    : JSON.stringify([]);

  const sources = Array.isArray(attributes.sources)
    ? JSON.stringify(attributes.sources.filter(Boolean))
    : JSON.stringify([]);

  const docDate = (attributes.last_updated && typeof attributes.last_updated === "string")
    ? attributes.last_updated.trim() : null;

  const reviewStatus = ["seed", "developing", "mature"].includes(attributes.status)
    ? attributes.status : null;

  // Extract category from the first path segment (subdirectory under wiki/)
  const parts = fileInfo.relativePath.split("/");
  const category = parts.length > 1 ? parts[0] : null;

  const existing = db
    .prepare("SELECT * FROM kb_documents WHERE original_path = ? AND source = ?")
    .get(fileInfo.relativePath, src);

  if (!existing) {
    let slug = normalizeSlug(slugFromPath(fileInfo.relativePath)) || slugFromPath(fileInfo.relativePath);
    if (!slug) {
      slug = "doc-" + crypto.createHash("sha256").update(fileInfo.relativePath, "utf8").digest("hex").slice(0, 10);
    }
    // Ensure slug uniqueness: if another document already has this slug, append hash
    const slugCollision = db.prepare("SELECT id FROM kb_documents WHERE slug = ? AND id != ?").get(slug, 0);
    if (slugCollision) {
      const hash = crypto.createHash("sha256").update(fileInfo.relativePath, "utf8").digest("hex").slice(0, 8);
      slug = slug + "-" + hash;
    }
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const info = db
      .prepare(
        `INSERT INTO kb_documents (title, slug, content_markdown, source, original_path, checksum, tags, status, category, doc_type, connections, sources, doc_date, review_status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(title, slug, body, src, fileInfo.relativePath, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, now);
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
    const newTitle = existing.title + " (冲突副本)";
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const info = db
      .prepare(
        `INSERT INTO kb_documents (title, slug, content_markdown, source, original_path, checksum, tags, status, category, doc_type, connections, sources, doc_date, review_status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, 'obsidian', ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newTitle, newSlug, body, fileInfo.relativePath, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, now);
    return { action: "conflict", id: info.lastInsertRowid, path: fileInfo.relativePath, detail: "created conflict copy" };
  }

  // last_write_wins
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  db.prepare(
    `UPDATE kb_documents SET title=?, slug=?, content_markdown=?, checksum=?, content_html=NULL, tags=?, category=?, doc_type=?, connections=?, sources=?, doc_date=?, review_status=?, word_count=?, updated_at=? WHERE id=?`,
  ).run(title, existing.slug, body, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, existing.id);
  return { action: "updated", id: existing.id, path: fileInfo.relativePath };
}

/**
 * Import a batch of files into kb_documents.
 * @param {Array<{relativePath: string, content: string, checksum: string, size: number}>} files
 * @param {string} conflictStrategy
 * @param {string} source - "obsidian"
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
  const db = openDb();
  const now = new Date().toISOString();
  try {
    const files = scanVault(vaultPath);
    return await importFromFiles(files, conflictStrategy, "obsidian");
  } catch (err) {
    console.error("[kb-sync] fullImport error:", err.message);
    // Write the error to sync logs so the UI can display it
    try {
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", vaultPath, "error", `导入异常: ${err.message}`, now);
    } catch { /* ignore */ }
    const summary = { imported: 0, updated: 0, skipped: 0, conflicted: 0, errors: 1 };
    return summary;
  } finally {
    releaseLock();
  }
}

/**
 * Lightweight scan: only return file paths (no content) from wiki/ subdirectory, for building file trees.
 */
function scanVaultPaths(vaultPath) {
  const results = [];
  const wikiPath = path.join(vaultPath, "wiki");
  if (!fs.existsSync(wikiPath)) return results;

  const resolved = path.resolve(wikiPath);
  const normalized = path.normalize(resolved);

  function walk(dir) {
    if (dir.length > 4000) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const real = path.normalize(full);
      if (!real.startsWith(normalized + path.sep) && real !== normalized) continue;
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        let size = 0;
        try { size = fs.statSync(full).size; } catch { /* skip */ }
        if (size > MAX_FILE_SIZE) continue;
        results.push({
          relativePath: path.relative(wikiPath, full).replace(/\\/g, "/"),
          size,
          checksum: null, // not computed for tree view
        });
      }
    }
  }
  walk(wikiPath);
  return results;
}

/**
 * Lightweight scan: return file paths with checksums (no content), for diff comparison.
 */
function scanVaultChecksums(vaultPath) {
  const results = [];
  const wikiPath = path.join(vaultPath, "wiki");
  if (!fs.existsSync(wikiPath)) return results;
  const resolved = path.resolve(wikiPath);
  const normalized = path.normalize(resolved);
  function walk(dir) {
    if (dir.length > 4000) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const real = path.normalize(full);
      if (!real.startsWith(normalized + path.sep) && real !== normalized) continue;
      if (e.isDirectory()) { walk(full); }
      else if (e.isFile() && e.name.endsWith(".md")) {
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.size > MAX_FILE_SIZE) continue;
        const relPath = path.relative(wikiPath, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full, "utf8");
        results.push({ relativePath: relPath, checksum: computeChecksum(content), size: stat.size });
      }
    }
  }
  walk(wikiPath);
  return results;
}

/**
 * Build a nested tree from flat file paths.
 * e.g. ["a/b/note.md"] → [{ name:"a", type:"folder", children: [{ name:"b", type:"folder", children: [{ name:"note.md", type:"file" }] }] }]
 */
function buildFileTree(files) {
  const root = [];

  for (const f of files) {
    const parts = f.relativePath.split("/");
    let level = root;

    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const name = parts[i];
      const nodePath = parts.slice(0, i + 1).join("/");

      if (isFile) {
        level.push({
          name,
          path: f.relativePath,
          type: "file",
          size: f.size || 0,
          checksum: f.checksum || null,
          documentId: f.documentId || null,
          status: f.status || null,
          syncedAt: f.syncedAt || null,
        });
      } else {
        let folder = level.find((n) => n.type === "folder" && n.name === name);
        if (!folder) {
          folder = { name, path: nodePath, type: "folder", children: [] };
          level.push(folder);
        }
        level = folder.children;
      }
    }
  }

  // Sort: folders first, then alphabetically
  function sortTree(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortTree(n.children);
    }
  }
  sortTree(root);
  return root;
}

function parseTags(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Full export: write all obsidian-sourced documents back to the vault as .md files.
 * Builds YAML front matter from DB fields + body from content_markdown.
 */
async function fullExport(vaultPath) {
  if (!acquireLock()) throw new Error("同步正在进行中，请稍后重试");
  const db = openDb();
  const now = new Date().toISOString();
  const wikiPath = path.join(vaultPath, "wiki");

  const logStmt = db.prepare(
    `INSERT INTO kb_sync_logs (direction, file_path, document_id, status, checksum, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const summary = { exported: 0, skipped: 0, errors: 0 };

  try {
    // Ensure wiki/ directory exists
    fs.mkdirSync(wikiPath, { recursive: true });

    const docs = db
      .prepare("SELECT * FROM kb_documents WHERE source = 'obsidian'")
      .all();

    for (const doc of docs) {
      const targetPath = doc.original_path;
      if (!targetPath) {
        summary.errors++;
        logStmt.run("export", `doc-${doc.id}`, doc.id, "error", null, "missing original_path", now);
        continue;
      }

      try {
        // Build YAML front matter from DB fields
        const lastUpdated = doc.doc_date || doc.updated_at ? doc.updated_at.slice(0, 10) : null;
        const yamlAttrs = {
          title: doc.title || undefined,
          type: doc.doc_type || undefined,
          tags: parseTags(doc.tags),
          connections: parseTags(doc.connections),
          sources: parseTags(doc.sources),
          last_updated: lastUpdated,
          status: doc.review_status || undefined,
        };

        const body = doc.content_markdown || "";
        const fullContent = buildFrontMatter(yamlAttrs, body);
        const checksum = computeChecksum(fullContent);

        // Skip if content hasn't changed since last export/import
        if (doc.checksum === checksum) {
          summary.skipped++;
          logStmt.run("export", targetPath, doc.id, "skipped", checksum, "no changes", now);
          continue;
        }

        // Write file
        const fullPath = path.join(wikiPath, targetPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, fullContent, "utf8");

        // Update checksum in DB
        db.prepare("UPDATE kb_documents SET checksum = ?, updated_at = ? WHERE id = ?")
          .run(checksum, now, doc.id);

        summary.exported++;
        logStmt.run("export", targetPath, doc.id, "success", checksum, null, now);
      } catch (err) {
        summary.errors++;
        logStmt.run("export", targetPath, doc.id, "error", null, err.message, now);
      }
    }

    db.prepare("UPDATE kb_sync_config SET last_sync_at = ?, updated_at = ? WHERE id = 1").run(now, now);
    try { db.pragma("wal_checkpoint(PASSIVE)"); } catch { /* ignore */ }

    return summary;
  } catch (err) {
    console.error("[kb-sync] fullExport error:", err.message);
    try {
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("export", vaultPath, "error", `导出异常: ${err.message}`, now);
    } catch { /* ignore */ }
    return { exported: 0, skipped: 0, errors: 1 };
  } finally {
    releaseLock();
  }
}

module.exports = { scanVault, scanVaultPaths, scanVaultChecksums, buildFileTree, importDocument, fullImport, importFromFiles, fullExport, computeChecksum, acquireLock, releaseLock, isRunning, MAX_FILE_SIZE };
