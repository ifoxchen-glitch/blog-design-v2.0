const crypto = require("crypto");
const { openDb } = require("../../../db");
const { nowIso, toInt, normalizeSlug, splitTags } = require("../../../utils");

function computeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function parseTags(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function pickDocumentListItem(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || null,
    source: row.source,
    tags: parseTags(row.tags),
    status: row.status,
    category: row.category || null,
    doc_type: row.doc_type || null,
    doc_date: row.doc_date || null,
    review_status: row.review_status || null,
    word_count: row.word_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function auditLog(db, req, action, resourceId, detail) {
  try {
    db.prepare(
      "INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, detail, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      req.user?.userId ?? null,
      req.user?.username ?? "system",
      action,
      "kb_document",
      String(resourceId ?? ""),
      detail ?? null,
      req.ip || null,
      req.headers?.["user-agent"] || null,
      nowIso(),
    );
  } catch {
    // audit log failure should not break the main operation
  }
}

function pickDocumentPublic(row) {
  return {
    ...pickDocumentListItem(row),
    content_markdown: row.content_markdown,
    content_html: row.content_html || null,
    original_path: row.original_path || null,
    checksum: row.checksum || null,
    connections: parseTags(row.connections),
    sources: parseTags(row.sources),
  };
}

function listDocuments(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const search = String(req.query.search || "").trim() || null;
  const contentSearch = req.query.contentSearch === "true" || req.query.contentSearch === "1";
  const source = String(req.query.source || "").trim() || null;
  const status = String(req.query.status || "").trim() || null;
  const tag = String(req.query.tag || "").trim() || null;
  const category = String(req.query.category || "").trim() || null;
  const sortBy = String(req.query.sortBy || "updated_at");
  const sortDir = String(req.query.sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const allowedSorts = new Set(["updated_at", "created_at", "title", "word_count"]);
  const orderCol = allowedSorts.has(sortBy) ? sortBy : "updated_at";

  const where = ["1=1"];
  const params = [];

  if (search) {
    if (contentSearch) {
      where.push("(title LIKE ? OR slug LIKE ? OR content_markdown LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    } else {
      where.push("(title LIKE ? OR slug LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }
  }
  if (source) {
    where.push("source = ?");
    params.push(source);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (tag) {
    // tags is a JSON array string, do a simple LIKE match
    where.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  const clause = where.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS c FROM kb_documents WHERE ${clause}`).get(...params).c;

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(`
      SELECT id, title, slug, excerpt, source, tags, status, category, doc_type, doc_date, review_status, word_count, created_at, updated_at
        FROM kb_documents
       WHERE ${clause}
       ORDER BY ${orderCol} ${sortDir}, id DESC
       LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset);

  const items = rows.map(pickDocumentListItem);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total, page, pageSize },
  });
}

function getDocument(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare("SELECT * FROM kb_documents WHERE id = ?")
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Document not found" });

  return res.status(200).json({ code: 200, message: "success", data: pickDocumentPublic(row) });
}

function createDocument(req, res) {
  const db = openDb();
  const body = req.body || {};
  const title = String(body.title ?? "").trim() || "未命名文档";
  const slug = normalizeSlug(body.slug || title || nowIso());
  const excerpt = String(body.excerpt ?? "").trim() || null;
  const content_markdown = String(body.content_markdown ?? "").trim() || "";
  const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
  const tagsJson = JSON.stringify(tags);
  const checksum = computeChecksum(content_markdown);
  const word_count = content_markdown.split(/\s+/).filter(Boolean).length;
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const category = String(body.category ?? "").trim() || null;
  const docType = ["entity", "concept", "source", "synthesis"].includes(body.doc_type) ? body.doc_type : null;
  const connections = JSON.stringify(Array.isArray(body.connections) ? body.connections.filter(Boolean) : []);
  const sources = JSON.stringify(Array.isArray(body.sources) ? body.sources.filter(Boolean) : []);
  const docDate = String(body.doc_date ?? "").trim() || null;
  const reviewStatus = ["seed", "developing", "mature"].includes(body.review_status) ? body.review_status : null;

  try {
    const info = db
      .prepare(`
        INSERT INTO kb_documents (title, slug, excerpt, content_markdown, content_html, source, tags, checksum, category, doc_type, connections, sources, doc_date, review_status, word_count, created_at, updated_at)
        VALUES (@title, @slug, @excerpt, @content_markdown, NULL, 'manual', @tags, @checksum, @category, @docType, @connections, @sources, @docDate, @reviewStatus, @word_count, @createdAt, @updatedAt)
      `)
      .run({ title, slug, excerpt, content_markdown, tags: tagsJson, checksum, category, docType, connections, sources, docDate, reviewStatus, word_count, created_at: createdAt, updated_at: updatedAt });

    const row = db.prepare("SELECT * FROM kb_documents WHERE id = ?").get(info.lastInsertRowid);
    auditLog(db, req, "create", info.lastInsertRowid, `创建文档: ${title}`);
    return res.status(201).json({ code: 201, message: "success", data: pickDocumentPublic(row) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("kb_documents.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function updateDocument(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT * FROM kb_documents WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Document not found" });

  const body = req.body || {};
  const title = body.title !== undefined ? (String(body.title).trim() || existing.title) : existing.title;
  const slug = body.slug !== undefined ? (normalizeSlug(body.slug) || existing.slug) : existing.slug;
  const excerpt = body.excerpt !== undefined ? (String(body.excerpt).trim() || null) : existing.excerpt;
  const content_markdown = body.content_markdown !== undefined ? String(body.content_markdown) : existing.content_markdown;
  const source = body.source !== undefined ? String(body.source) : existing.source;
  const status = body.status !== undefined ? String(body.status) : existing.status;
  const tags = body.tags !== undefined
    ? JSON.stringify(Array.isArray(body.tags) ? body.tags.filter(Boolean) : [])
    : existing.tags;
  const checksum = content_markdown !== existing.content_markdown
    ? computeChecksum(content_markdown)
    : existing.checksum;
  const word_count = content_markdown !== existing.content_markdown
    ? content_markdown.split(/\s+/).filter(Boolean).length
    : existing.word_count;
  const updatedAt = nowIso();

  const category = body.category !== undefined
    ? (String(body.category).trim() || null)
    : (existing.category || null);
  const docType = body.doc_type !== undefined
    ? (["entity", "concept", "source", "synthesis"].includes(body.doc_type) ? body.doc_type : null)
    : (existing.doc_type || null);
  const connections = body.connections !== undefined
    ? JSON.stringify(Array.isArray(body.connections) ? body.connections.filter(Boolean) : [])
    : existing.connections;
  const sources = body.sources !== undefined
    ? JSON.stringify(Array.isArray(body.sources) ? body.sources.filter(Boolean) : [])
    : existing.sources;
  const docDate = body.doc_date !== undefined
    ? (String(body.doc_date).trim() || null)
    : (existing.doc_date || null);
  const reviewStatus = body.review_status !== undefined
    ? (["seed", "developing", "mature"].includes(body.review_status) ? body.review_status : null)
    : (existing.review_status || null);

  try {
    db.prepare(`
      UPDATE kb_documents
         SET title=@title, slug=@slug, excerpt=@excerpt, content_markdown=@content_markdown,
             content_html=NULL, source=@source, tags=@tags, checksum=@checksum,
             category=@category, doc_type=@docType, connections=@connections, sources=@sources,
             doc_date=@docDate, review_status=@reviewStatus,
             word_count=@word_count, status=@status, updated_at=@updatedAt
       WHERE id=@id
    `).run({ id, title, slug, excerpt, content_markdown, source, tags, checksum, word_count, status, updatedAt, category, docType, connections, sources, docDate, reviewStatus });

    // If this document is mapped to a post with sync_enabled=1, update the post too
    const mapping = db.prepare(`
      SELECT dp.id, dp.post_id, dp.sync_enabled
        FROM kb_document_posts dp
       WHERE dp.document_id = ? AND dp.sync_enabled = 1
    `).get(id);
    if (mapping) {
      const syncNow = nowIso();
      db.prepare(`
        UPDATE posts
           SET contentMarkdown=@content_markdown, contentHtml=NULL, updatedAt=@updatedAt
         WHERE id=@post_id
      `).run({ content_markdown, updatedAt: syncNow, post_id: mapping.post_id });
      db.prepare(`
        UPDATE kb_document_posts SET last_synced_at=?, updated_at=? WHERE id=?
      `).run(syncNow, syncNow, mapping.id);
    }

    const row = db.prepare("SELECT * FROM kb_documents WHERE id = ?").get(id);
    auditLog(db, req, "update", id, `更新文档: ${title}`);
    return res.status(200).json({ code: 200, message: "success", data: pickDocumentPublic(row) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("kb_documents.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function deleteDocument(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT title FROM kb_documents WHERE id = ?").get(id);
  const info = db.prepare("DELETE FROM kb_documents WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Document not found" });

  auditLog(db, req, "delete", id, `删除文档: ${existing.title}`);
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function listCategories(req, res) {
  const db = openDb();
  const rows = db
    .prepare("SELECT DISTINCT category FROM kb_documents WHERE category IS NOT NULL ORDER BY category")
    .all();
  const categories = rows.map(r => r.category).filter(Boolean);
  return res.status(200).json({ code: 200, message: "success", data: categories });
}

module.exports = {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  listCategories,
};
