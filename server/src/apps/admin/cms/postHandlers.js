const { openDb, listTagsForPost, listTagsForPosts, listCategoriesForPost, listCategoriesForPosts, setPostTags, setPostCategories } = require("../../../db");
const { nowIso, toInt, normalizeSlug, splitTags } = require("../../../utils");

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

function pickPostListItem(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || null,
    coverImageUrl: row.coverImageUrl || null,
    status: row.status,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildListWhere({ keyword, status }) {
  const where = ["1=1"];
  const params = [];
  if (keyword) {
    where.push("(title LIKE ? OR slug LIKE ? OR excerpt LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  return { clause: where.join(" AND "), params };
}

function listPosts(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const keyword = String(req.query.keyword || "").trim() || null;
  const status = String(req.query.status || "").trim() || null;
  const orderField = String(req.query.orderBy || "updatedAt");
  const orderDir = String(req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const allowedOrders = new Set(["updatedAt", "createdAt", "publishedAt", "title", "id"]);
  const orderCol = allowedOrders.has(orderField) ? orderField : "updatedAt";

  const { clause, params } = buildListWhere({ keyword, status });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM posts WHERE ${clause}`).get(...params).c;

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(`
      SELECT id, title, slug, excerpt, coverImageUrl, status, publishedAt, createdAt, updatedAt
        FROM posts
       WHERE ${clause}
       ORDER BY ${orderCol} ${orderDir}, id DESC
       LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset);

  const ids = rows.map((r) => r.id);
  const tagsMap = listTagsForPosts(db, ids);
  const catsMap = listCategoriesForPosts(db, ids);

  const items = rows.map((r) => ({
    ...pickPostListItem(r),
    tags: tagsMap[r.id] || [],
    categories: catsMap[r.id] || [],
  }));

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total, page, pageSize },
  });
}

function getPost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare(`
      SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
        FROM posts WHERE id = ?
    `)
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Post not found" });

  const data = pickPostPublic(row);
  data.tags = listTagsForPost(db, id);
  data.categories = listCategoriesForPost(db, id);
  return res.status(200).json({ code: 200, message: "success", data });
}

function createPost(req, res) {
  const db = openDb();
  const body = req.body || {};
  const title = String(body.title ?? "").trim() || "未命名文章";
  const slug = normalizeSlug(body.slug || title || nowIso());
  const excerpt = String(body.excerpt ?? "").trim() || null;
  const coverImageUrl = String(body.coverImageUrl ?? "").trim() || null;
  const contentMarkdown = String(body.contentMarkdown ?? "").trim() || "";
  const status = String(body.status ?? "draft") === "published" ? "published" : "draft";
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const publishedAt = status === "published" ? createdAt : null;

  try {
    const info = db
      .prepare(`
        INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
        VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, @status, @publishedAt, @createdAt, @updatedAt)
      `)
      .run({ title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt });

    const tagNames = splitTags(body.tags);
    setPostTags(db, info.lastInsertRowid, tagNames);
    const categoryNames = splitTags(body.categories || "");
    setPostCategories(db, info.lastInsertRowid, categoryNames);

    const row = db
      .prepare(`
        SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
          FROM posts WHERE id = ?
      `)
      .get(info.lastInsertRowid);

    const data = pickPostPublic(row);
    data.tags = listTagsForPost(db, info.lastInsertRowid);
    data.categories = listCategoriesForPost(db, info.lastInsertRowid);
    return res.status(201).json({ code: 201, message: "success", data });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("posts.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function updatePost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db
    .prepare(`
      SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
        FROM posts WHERE id = ?
    `)
    .get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Post not found" });

  const body = req.body || {};
  const title = String(body.title ?? existing.title).trim() || existing.title;
  const slug = normalizeSlug(body.slug ?? existing.slug) || existing.slug;
  const excerpt = body.excerpt !== undefined ? (String(body.excerpt).trim() || null) : existing.excerpt;
  const coverImageUrl = body.coverImageUrl !== undefined ? (String(body.coverImageUrl).trim() || null) : existing.coverImageUrl;
  const contentMarkdown = body.contentMarkdown !== undefined ? String(body.contentMarkdown) : existing.contentMarkdown;
  const updatedAt = nowIso();

  try {
    db.prepare(`
      UPDATE posts
         SET title=@title, slug=@slug, excerpt=@excerpt, coverImageUrl=@coverImageUrl,
             contentMarkdown=@contentMarkdown, contentHtml=NULL, updatedAt=@updatedAt
       WHERE id=@id
    `).run({ id, title, slug, excerpt, coverImageUrl, contentMarkdown, updatedAt });

    if (body.tags !== undefined) {
      setPostTags(db, id, splitTags(body.tags));
    }
    if (body.categories !== undefined) {
      setPostCategories(db, id, splitTags(body.categories));
    }

    const row = db
      .prepare(`
        SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
          FROM posts WHERE id = ?
      `)
      .get(id);

    const data = pickPostPublic(row);
    data.tags = listTagsForPost(db, id);
    data.categories = listCategoriesForPost(db, id);
    return res.status(200).json({ code: 200, message: "success", data });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("posts.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function deletePost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Post not found" });
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function publishPost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const updatedAt = nowIso();
  const publishedAt = nowIso();
  const info = db
    .prepare(`UPDATE posts SET status='published', publishedAt=@publishedAt, updatedAt=@updatedAt WHERE id=@id`)
    .run({ id, publishedAt, updatedAt });
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Post not found" });
  return res.status(200).json({ code: 200, message: "success", data: { id, status: "published", publishedAt, updatedAt } });
}

function unpublishPost(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const updatedAt = nowIso();
  const info = db
    .prepare(`UPDATE posts SET status='draft', updatedAt=@updatedAt WHERE id=@id`)
    .run({ id, updatedAt });
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Post not found" });
  return res.status(200).json({ code: 200, message: "success", data: { id, status: "draft", updatedAt } });
}

// TODO(T2.8): contentHtml 仍然 lazy-render；前端编辑页若需要可加 ?withHtml=1 参数。
// TODO(T2.8): 暂未实现批量删除/发布；如需 bulk ops 后续追加 POST /bulk 路由。
// TODO(T2.9): unpublishPost 故意不清 publishedAt（与 legacy 等价），保留首次发布时间用于审计/排序。

module.exports = {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
};
