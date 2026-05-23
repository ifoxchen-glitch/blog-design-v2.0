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
const CONTENT_DIRS = ['wiki', 'notes'];

// Phase 12: Multi-source directory mapping
const SOURCE_DIR_MAP = {
  obsidian: ['wiki', 'notes'],
  api: ['raw/api'],
  manual: ['raw/manual'],
};

function getAllContentDirs(syncSources, apiExportDir, manualExportDir) {
  const dirs = new Set();
  const sources = Array.isArray(syncSources) ? syncSources : ['obsidian'];

  if (sources.includes('obsidian')) {
    CONTENT_DIRS.forEach(d => dirs.add(d));
  }
  if (sources.includes('api')) {
    dirs.add(apiExportDir || 'raw/api');
  }
  if (sources.includes('manual')) {
    dirs.add(manualExportDir || 'raw/manual');
  }

  return Array.from(dirs);
}

function getSourceFromPath(relativePath, apiExportDir, manualExportDir) {
  const apiDir = (apiExportDir || 'raw/api').toLowerCase() + '/';
  const manualDir = (manualExportDir || 'raw/manual').toLowerCase() + '/';
  const lower = relativePath.toLowerCase();

  if (lower.startsWith(apiDir)) return 'api';
  if (lower.startsWith(manualDir)) return 'manual';
  return 'obsidian';
}

function getExportTargetPath(doc, vaultPath, apiExportDir, manualExportDir) {
  if (doc.source === 'obsidian') {
    return doc.original_path;
  }
  if (doc.source === 'api') {
    const dir = apiExportDir || 'raw/api';
    return path.join(dir, `${doc.slug}.md`).replace(/\\/g, '/');
  }
  if (doc.source === 'manual') {
    const dir = manualExportDir || 'raw/manual';
    return path.join(dir, `${doc.slug}.md`).replace(/\\/g, '/');
  }
  return null;
}

/**
 * Normalize an array of reference strings (connections, sources).
 * - Flattens nested arrays (js-yaml may parse [[Doc A]] as [["Doc A"]])
 * - Strips wiki-link [[ ]] brackets
 * - Trims whitespace
 * - Filters out empty values
 */
function normalizeRefs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .flat(Infinity)
    .filter(v => v !== null && v !== undefined)
    .map(v => String(v).trim().replace(/^\[\[|\]\]$/g, '').trim())
    .filter(Boolean);
}

/**
 * Walk a content directory recursively, calling callback for each .md file.
 * Skips hidden files (dot-prefixed), protects against symlink escapes.
 */
function walkContentDir(dirPath, callback) {
  const resolved = path.resolve(dirPath);
  const normalized = path.normalize(resolved).toLowerCase();
  function walk(dir) {
    if (dir.length > 4000) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const real = path.resolve(full).toLowerCase();
      if (!real.startsWith(normalized + path.sep) && real !== normalized) continue;
      if (e.isDirectory()) { walk(full); }
      else if (e.isFile() && e.name.endsWith(".md")) {
        callback(full, path.relative(dirPath, full).replace(/\\/g, "/"));
      }
    }
  }
  walk(dirPath);
}

/**
 * Recursively scan content directories (wiki/, notes/) for .md files, returning file info with checksums.
 */
function matchSelectedPaths(relPath, selectedPaths) {
  if (!selectedPaths || selectedPaths.length === 0) return true; // no filter = include all
  const lower = relPath.toLowerCase();
  const result = selectedPaths.some(sp => {
    const spLower = sp.toLowerCase();
    if (spLower.endsWith('/')) {
      return lower.startsWith(spLower);
    }
    return lower === spLower || lower.startsWith(spLower + '/');
  });
  return result;
}

function scanVault(vaultPath, selectedPaths, dirs) {
  const results = [];
  let scanned = 0, matched = 0;
  const contentDirs = Array.isArray(dirs) && dirs.length > 0 ? dirs : CONTENT_DIRS;

  for (const dir of contentDirs) {
    const dirPath = path.join(vaultPath, dir);
    if (!fs.existsSync(dirPath)) { console.log(`[kb-sync] scanVault: ${dir} not found: ${dirPath}`); continue; }
    walkContentDir(dirPath, (full, relPath) => {
      scanned++;
      const prefixed = dir + "/" + relPath;
      if (!matchSelectedPaths(prefixed, selectedPaths)) return;
      matched++;
      const content = fs.readFileSync(full, "utf8");
      if (!content && content !== "") return;
      results.push({ relativePath: prefixed, content, checksum: computeChecksum(content), size: fs.statSync(full).size });
    });
  }

  console.log(`[kb-sync] scanVault: scanned=${scanned} matched=${matched} results=${results.length} selected=${JSON.stringify(selectedPaths)} dirs=${JSON.stringify(contentDirs)}`);
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

  const connections = JSON.stringify(normalizeRefs(attributes.connections));
  const sources = JSON.stringify(normalizeRefs(attributes.sources));

  const docDate = (attributes.last_updated && typeof attributes.last_updated === "string")
    ? attributes.last_updated.trim() : null;

  const reviewStatus = ["seed", "developing", "mature"].includes(attributes.status)
    ? attributes.status : null;

  const excerpt = (attributes.excerpt && String(attributes.excerpt).trim())
    || (attributes.description && String(attributes.description).trim())
    || null;

  // Category priority: YAML attribute first, fall back to path segment
  // e.g., "wiki/project-a/file.md" → "project-a", "notes/daily/todo.md" → "daily"
  // Phase 12: For api/manual dirs, don't infer category from path (raw/api/file.md → null)
  let category = (attributes.category && String(attributes.category).trim()) || null;
  if (!category) {
    const parts = fileInfo.relativePath.split("/");
    const firstDir = parts[0]?.toLowerCase();
    const isRawDir = firstDir === 'raw' || !CONTENT_DIRS.includes(firstDir);
    if (!isRawDir) {
      const catStart = 1;
      category = parts.length > catStart + 1 ? parts[catStart] : null;
    }
  }

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
        `INSERT INTO kb_documents (title, slug, excerpt, content_markdown, source, original_path, checksum, tags, status, category, doc_type, connections, sources, doc_date, review_status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(title, slug, excerpt, body, src, fileInfo.relativePath, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, now);
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
        `INSERT INTO kb_documents (title, slug, excerpt, content_markdown, source, original_path, checksum, tags, status, category, doc_type, connections, sources, doc_date, review_status, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'obsidian', ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newTitle, newSlug, excerpt, body, fileInfo.relativePath, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, now);
    return { action: "conflict", id: info.lastInsertRowid, path: fileInfo.relativePath, detail: "created conflict copy" };
  }

  // last_write_wins
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  db.prepare(
    `UPDATE kb_documents SET title=?, slug=?, excerpt=?, content_markdown=?, checksum=?, content_html=NULL, tags=?, category=?, doc_type=?, connections=?, sources=?, doc_date=?, review_status=?, word_count=?, updated_at=? WHERE id=?`,
  ).run(title, existing.slug, excerpt, body, fileInfo.checksum, tags, category, docType, connections, sources, docDate, reviewStatus, wordCount, now, existing.id);
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
 * Phase 12: Supports multi-source directories (obsidian → wiki/notes, api → raw/api, manual → raw/manual)
 */
async function fullImport(vaultPath, conflictStrategy, selectedPaths, syncConfig) {
  if (!acquireLock()) throw new Error("同步正在进行中，请稍后重试");
  const db = openDb();
  const now = new Date().toISOString();

  const config = syncConfig || db.prepare("SELECT sync_sources, api_export_dir, manual_export_dir FROM kb_sync_config WHERE id = 1").get();
  const syncSources = config?.sync_sources ? parseJsonArray(config.sync_sources) : ['obsidian'];
  const apiExportDir = config?.api_export_dir || 'raw/api';
  const manualExportDir = config?.manual_export_dir || 'raw/manual';
  const contentDirs = getAllContentDirs(syncSources, apiExportDir, manualExportDir);

  try {
    console.log(`[kb-sync] fullImport starting: vault=${vaultPath} dirs=${JSON.stringify(contentDirs)} selected=${JSON.stringify(selectedPaths)} sources=${JSON.stringify(syncSources)}`);
    const files = scanVault(vaultPath, selectedPaths, contentDirs);
    console.log(`[kb-sync] scanVault found ${files.length} files, starting import...`);

    // Phase 12: Infer source from file path for each file
    for (const f of files) {
      f.inferredSource = getSourceFromPath(f.relativePath, apiExportDir, manualExportDir);
    }

    const summary = { imported: 0, updated: 0, skipped: 0, conflicted: 0, errors: 0 };
    const logStmt = db.prepare(
      `INSERT INTO kb_sync_logs (direction, file_path, document_id, status, checksum, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const f of files) {
      try {
        const result = importDocument(db, f, conflictStrategy, now, f.inferredSource);
        const statusMap = { imported: "success", updated: "success", skipped: "skipped", conflict: "conflict" };
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
    try { db.pragma("wal_checkpoint(PASSIVE)"); } catch { /* ignore */ }

    console.log(`[kb-sync] fullImport complete:`, JSON.stringify(summary));
    return summary;
  } catch (err) {
    console.error("[kb-sync] fullImport error:", err.message);
    try {
      db.prepare(
        "INSERT INTO kb_sync_logs (direction, file_path, status, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run("import", vaultPath, "error", `导入异常: ${err.message}`, now);
    } catch { /* ignore */ }
    return { imported: 0, updated: 0, skipped: 0, conflicted: 0, errors: 1 };
  } finally {
    releaseLock();
  }
}

/**
 * Lightweight scan: only return file paths (no content) from content directories, for building file trees.
 */
function scanVaultPaths(vaultPath) {
  const results = [];

  for (const dir of CONTENT_DIRS) {
    const dirPath = path.join(vaultPath, dir);
    if (!fs.existsSync(dirPath)) continue;
    walkContentDir(dirPath, (full, relPath) => {
      let size = 0;
      try { size = fs.statSync(full).size; } catch { return; }
      if (size > MAX_FILE_SIZE) return;
      results.push({ relativePath: dir + "/" + relPath, size, checksum: null });
    });
  }

  return results;
}

/**
 * Lightweight scan: return file paths with checksums (no content), for diff comparison.
 */
function scanVaultChecksums(vaultPath) {
  const results = [];

  for (const dir of CONTENT_DIRS) {
    const dirPath = path.join(vaultPath, dir);
    if (!fs.existsSync(dirPath)) continue;
    walkContentDir(dirPath, (full, relPath) => {
      let stat;
      try { stat = fs.statSync(full); } catch { return; }
      if (stat.size > MAX_FILE_SIZE) return;
      const content = fs.readFileSync(full, "utf8");
      if (!content && content !== "") return;
      results.push({ relativePath: dir + "/" + relPath, checksum: computeChecksum(content), size: stat.size });
    });
  }

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
 * Full export: write documents back to the vault as .md files.
 * Phase 12: Supports multi-source export (obsidian, api, manual).
 * Builds YAML front matter from DB fields + body from content_markdown.
 */
async function fullExport(vaultPath, selectedPaths, syncConfig) {
  if (!acquireLock()) throw new Error("同步正在进行中，请稍后重试");
  const db = openDb();
  const now = new Date().toISOString();

  const config = syncConfig || db.prepare("SELECT sync_sources, api_export_dir, manual_export_dir FROM kb_sync_config WHERE id = 1").get();
  const syncSources = config?.sync_sources ? parseJsonArray(config.sync_sources) : ['obsidian'];
  const apiExportDir = config?.api_export_dir || 'raw/api';
  const manualExportDir = config?.manual_export_dir || 'raw/manual';

  const logStmt = db.prepare(
    `INSERT INTO kb_sync_logs (direction, file_path, document_id, status, checksum, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const summary = { exported: 0, skipped: 0, errors: 0 };

  try {
    // Ensure base content directories exist
    for (const dir of CONTENT_DIRS) fs.mkdirSync(path.join(vaultPath, dir), { recursive: true });
    if (syncSources.includes('api')) fs.mkdirSync(path.join(vaultPath, apiExportDir), { recursive: true });
    if (syncSources.includes('manual')) fs.mkdirSync(path.join(vaultPath, manualExportDir), { recursive: true });

    // Build source IN clause
    const placeholders = syncSources.map(() => '?').join(',');
    const docs = db
      .prepare(`SELECT * FROM kb_documents WHERE source IN (${placeholders})`)
      .all(...syncSources);

    for (const doc of docs) {
      const targetPath = getExportTargetPath(doc, vaultPath, apiExportDir, manualExportDir);
      if (!targetPath) {
        summary.errors++;
        logStmt.run("export", `doc-${doc.id}`, doc.id, "error", null, "missing target_path", now);
        continue;
      }

      if (!matchSelectedPaths(targetPath, selectedPaths)) {
        summary.skipped++;
        logStmt.run("export", targetPath, doc.id, "skipped", null, "not in selected paths", now);
        continue;
      }

      try {
        // Build YAML front matter from DB fields
        const lastUpdated = doc.doc_date
          || (doc.updated_at ? doc.updated_at.slice(0, 10) : null);
        const yamlAttrs = {
          title: doc.title || undefined,
          type: doc.doc_type || undefined,
          tags: parseTags(doc.tags),
          connections: parseTags(doc.connections),
          sources: parseTags(doc.sources),
          excerpt: doc.excerpt || undefined,
          category: doc.category || undefined,
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
        const fullPath = path.join(vaultPath, targetPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, fullContent, "utf8");

        // Update original_path and checksum in DB for api/manual docs
        const needsPathUpdate = (doc.source === 'api' || doc.source === 'manual') && doc.original_path !== targetPath;
        if (needsPathUpdate) {
          db.prepare("UPDATE kb_documents SET checksum = ?, updated_at = ?, original_path = ? WHERE id = ?")
            .run(checksum, now, targetPath, doc.id);
        } else {
          db.prepare("UPDATE kb_documents SET checksum = ?, updated_at = ? WHERE id = ?")
            .run(checksum, now, doc.id);
        }

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

function parseJsonArray(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

module.exports = { scanVault, scanVaultPaths, scanVaultChecksums, buildFileTree, importDocument, fullImport, importFromFiles, fullExport, computeChecksum, acquireLock, releaseLock, isRunning, MAX_FILE_SIZE, CONTENT_DIRS, getAllContentDirs, getSourceFromPath, getExportTargetPath, parseJsonArray };
