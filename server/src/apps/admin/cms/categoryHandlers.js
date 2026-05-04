const { openDb } = require("../../../db");
const { nowIso, toInt, normalizeSlug } = require("../../../utils");

function pickCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    postCount: row.postCount != null ? row.postCount : 0,
  };
}

function listCategories(req, res) {
  const db = openDb();
  const rows = db
    .prepare(`
      SELECT c.id, c.name, c.slug, c.createdAt, COUNT(pc.postId) AS postCount
        FROM categories c
        LEFT JOIN post_categories pc ON pc.categoryId = c.id
       GROUP BY c.id
       ORDER BY c.name ASC
    `)
    .all();
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items: rows.map(pickCategory), total: rows.length },
  });
}

function createCategory(req, res) {
  const db = openDb();
  const body = req.body || {};
  const name = String(body.name ?? "").trim();
  if (!name) return res.status(400).json({ code: 400, message: "name required" });
  const slug = normalizeSlug(body.slug || name);
  if (!slug) return res.status(400).json({ code: 400, message: "invalid slug" });
  const createdAt = nowIso();

  try {
    const info = db
      .prepare(`INSERT INTO categories (name, slug, createdAt) VALUES (?, ?, ?)`)
      .run(name, slug, createdAt);
    const row = db
      .prepare(`SELECT id, name, slug, createdAt FROM categories WHERE id = ?`)
      .get(info.lastInsertRowid);
    return res.status(201).json({ code: 201, message: "success", data: pickCategory({ ...row, postCount: 0 }) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("categories.name")) {
      return res.status(409).json({ code: 409, message: "name_taken" });
    }
    if (msg.includes("UNIQUE") && msg.includes("categories.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function updateCategory(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare(`SELECT id, name, slug FROM categories WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Category not found" });

  const body = req.body || {};
  const name = body.name !== undefined ? (String(body.name).trim() || existing.name) : existing.name;
  const slug = body.slug !== undefined ? (normalizeSlug(body.slug) || existing.slug) : existing.slug;

  try {
    db.prepare(`UPDATE categories SET name=?, slug=? WHERE id=?`).run(name, slug, id);
    const row = db
      .prepare(`
        SELECT c.id, c.name, c.slug, c.createdAt, COUNT(pc.postId) AS postCount
          FROM categories c LEFT JOIN post_categories pc ON pc.categoryId = c.id
         WHERE c.id = ? GROUP BY c.id
      `)
      .get(id);
    return res.status(200).json({ code: 200, message: "success", data: pickCategory(row) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("categories.name")) {
      return res.status(409).json({ code: 409, message: "name_taken" });
    }
    if (msg.includes("UNIQUE") && msg.includes("categories.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function deleteCategory(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Category not found" });
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

// TODO(T2.11): listCategories 暂不分页（与 T2.10 tags 等价）；如分类数量增长再加 ?keyword= + LIMIT/OFFSET。
// TODO(T2.11): 暂不支持父子层级；若 §5.x 产品要求树形分类，需扩 categories 表 parentId 列。

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
