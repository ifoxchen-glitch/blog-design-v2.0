const { openDb, listTagsForPost, listCategoriesForPost, setPostTags, setPostCategories } = require("../../../db");
const { nowIso, toInt, normalizeSlug, splitTags } = require("../../../utils");
const { renderMarkdownToSafeHtml } = require("../../../markdown");

// ---- helpers ----

function pickPostPublic(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || null,
    coverImageUrl: row.coverImageUrl || null,
    contentMarkdown: row.contentMarkdown,
    status: row.status,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    // ignore
  }
}

function pickMapping(row) {
  return {
    id: row.id,
    document_id: row.document_id,
    post_id: row.post_id,
    sync_enabled: row.sync_enabled === 1,
    last_synced_at: row.last_synced_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---- preview ----

function previewDocument(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const doc = db.prepare("SELECT id, title, slug, content_markdown, word_count FROM kb_documents WHERE id = ?").get(id);
  if (!doc) return res.status(404).json({ code: 404, message: "Document not found" });

  const html = renderMarkdownToSafeHtml(doc.content_markdown);
  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      html,
      word_count: doc.word_count,
      document: { id: doc.id, title: doc.title, slug: doc.slug },
    },
  });
}

// ---- publish ----

function publishDocument(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const doc = db.prepare("SELECT * FROM kb_documents WHERE id = ?").get(id);
  if (!doc) return res.status(404).json({ code: 404, message: "Document not found" });

  const body = req.body || {};
  const title = String(body.title ?? doc.title).trim() || doc.title;
  const slug = normalizeSlug(body.slug || "kb-" + doc.slug) || "kb-" + doc.slug;
  const excerpt = body.excerpt !== undefined ? (String(body.excerpt).trim() || null) : (doc.excerpt || null);
  const coverImageUrl = String(body.coverImageUrl ?? "").trim() || null;
  const publishNow = body.publishNow !== false;
  const syncEnabled = body.syncEnabled === true;
  const now = nowIso();

  const existingMapping = db.prepare("SELECT * FROM kb_document_posts WHERE document_id = ?").get(id);

  let postId;

  try {
    if (existingMapping) {
      // Update existing post
      postId = existingMapping.post_id;
      db.prepare(`
        UPDATE posts
           SET title=@title, slug=@slug, excerpt=@excerpt, coverImageUrl=@coverImageUrl,
               contentMarkdown=@contentMarkdown, contentHtml=NULL, updatedAt=@updatedAt
         WHERE id=@id
      `).run({
        id: postId, title, slug, excerpt, coverImageUrl,
        contentMarkdown: doc.content_markdown,
        updatedAt: now,
      });

      if (body.tags !== undefined) {
        setPostTags(db, postId, splitTags(body.tags));
      }
      if (body.categories !== undefined) {
        setPostCategories(db, postId, splitTags(body.categories));
      }

      // Update mapping
      db.prepare(`
        UPDATE kb_document_posts
           SET sync_enabled=@sync_enabled, last_synced_at=@now, updated_at=@now
         WHERE id=@id
      `).run({ sync_enabled: syncEnabled ? 1 : 0, now, id: existingMapping.id });

      if (publishNow) {
        const publishedAt = nowIso();
        db.prepare(`UPDATE posts SET status='published', publishedAt=@publishedAt, updatedAt=@updatedAt WHERE id=@id`)
          .run({ publishedAt, updatedAt: now, id: postId });
      }
    } else {
      // Create new post
      const status = publishNow ? "published" : "draft";
      const publishedAt = publishNow ? now : null;
      const createdAt = now;

      const info = db.prepare(`
        INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
        VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, @status, @publishedAt, @createdAt, @updatedAt)
      `).run({
        title, slug, excerpt, coverImageUrl,
        contentMarkdown: doc.content_markdown,
        status, publishedAt, createdAt, updatedAt: now,
      });
      postId = info.lastInsertRowid;

      // Set tags and categories
      const tagNames = splitTags(body.tags);
      setPostTags(db, postId, tagNames);
      const categoryNames = splitTags(body.categories || "");
      setPostCategories(db, postId, categoryNames);

      // Create mapping
      db.prepare(`
        INSERT INTO kb_document_posts (document_id, post_id, sync_enabled, last_synced_at, created_at, updated_at)
        VALUES (@document_id, @post_id, @sync_enabled, @last_synced_at, @created_at, @updated_at)
      `).run({
        document_id: id,
        post_id: postId,
        sync_enabled: syncEnabled ? 1 : 0,
        last_synced_at: now,
        created_at: now,
        updated_at: now,
      });
    }

    // Fetch the post to return
    const post = db.prepare(`
      SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
        FROM posts WHERE id = ?
    `).get(postId);

    const mapping = db.prepare("SELECT * FROM kb_document_posts WHERE document_id = ?").get(id);

    const postData = pickPostPublic(post);
    postData.tags = listTagsForPost(db, postId);
    postData.categories = listCategoriesForPost(db, postId);

    auditLog(db, req, existingMapping ? "update" : "publish", id, `发布文档到博客: ${title}`);
    return res.status(existingMapping ? 200 : 201).json({
      code: existingMapping ? 200 : 201,
      message: "success",
      data: { post: postData, mapping: mapping ? pickMapping(mapping) : null },
    });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("posts.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

// ---- document-posts (mappings) ----

function listDocumentPosts(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));

  const total = db.prepare("SELECT COUNT(*) AS c FROM kb_document_posts").get().c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT * FROM kb_document_posts ORDER BY updated_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset);

  const items = rows.map(pickMapping);
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total, page, pageSize },
  });
}

function updateDocumentPost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const mapping = db.prepare("SELECT * FROM kb_document_posts WHERE id = ?").get(id);
  if (!mapping) return res.status(404).json({ code: 404, message: "Mapping not found" });

  const body = req.body || {};
  const syncEnabled = body.syncEnabled !== undefined ? (body.syncEnabled ? 1 : 0) : mapping.sync_enabled;
  const now = nowIso();

  db.prepare("UPDATE kb_document_posts SET sync_enabled=?, updated_at=? WHERE id=?")
    .run(syncEnabled, now, id);

  const updated = db.prepare("SELECT * FROM kb_document_posts WHERE id = ?").get(id);
  return res.status(200).json({ code: 200, message: "success", data: pickMapping(updated) });
}

function deleteDocumentPost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT * FROM kb_document_posts WHERE id = ?").get(id);
  const info = db.prepare("DELETE FROM kb_document_posts WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Mapping not found" });

  auditLog(db, req, "unpublish", existing.document_id, `解除文档与文章的映射 (post_id=${existing.post_id})`);
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

module.exports = {
  previewDocument,
  publishDocument,
  listDocumentPosts,
  updateDocumentPost,
  deleteDocumentPost,
};
