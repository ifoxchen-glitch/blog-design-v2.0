const { openDb } = require("../../../db");
const { nowIso, toInt, normalizeSlug } = require("../../../utils");

function pickTag(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    postCount: row.postCount != null ? row.postCount : 0,
  };
}

function listTags(req, res) {
  const db = openDb();
  const rows = db
    .prepare(`
      SELECT t.id, t.name, t.slug, t.createdAt, COUNT(pt.postId) AS postCount
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tagId = t.id
       GROUP BY t.id
       ORDER BY t.name ASC
    `)
    .all();
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items: rows.map(pickTag), total: rows.length },
  });
}

function createTag(req, res) {
  const db = openDb();
  const body = req.body || {};
  const name = String(body.name ?? "").trim();
  if (!name) return res.status(400).json({ code: 400, message: "name required" });
  const slug = normalizeSlug(body.slug || name);
  if (!slug) return res.status(400).json({ code: 400, message: "invalid slug" });
  const createdAt = nowIso();

  try {
    const info = db
      .prepare(`INSERT INTO tags (name, slug, createdAt) VALUES (?, ?, ?)`)
      .run(name, slug, createdAt);
    const row = db
      .prepare(`SELECT id, name, slug, createdAt FROM tags WHERE id = ?`)
      .get(info.lastInsertRowid);
    return res.status(201).json({ code: 201, message: "success", data: pickTag({ ...row, postCount: 0 }) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("tags.name")) {
      return res.status(409).json({ code: 409, message: "name_taken" });
    }
    if (msg.includes("UNIQUE") && msg.includes("tags.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function updateTag(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare(`SELECT id, name, slug FROM tags WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Tag not found" });

  const body = req.body || {};
  const name = body.name !== undefined ? (String(body.name).trim() || existing.name) : existing.name;
  const slug = body.slug !== undefined ? (normalizeSlug(body.slug) || existing.slug) : existing.slug;

  try {
    db.prepare(`UPDATE tags SET name=?, slug=? WHERE id=?`).run(name, slug, id);
    const row = db
      .prepare(`
        SELECT t.id, t.name, t.slug, t.createdAt, COUNT(pt.postId) AS postCount
          FROM tags t LEFT JOIN post_tags pt ON pt.tagId = t.id
         WHERE t.id = ? GROUP BY t.id
      `)
      .get(id);
    return res.status(200).json({ code: 200, message: "success", data: pickTag(row) });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("UNIQUE") && msg.includes("tags.name")) {
      return res.status(409).json({ code: 409, message: "name_taken" });
    }
    if (msg.includes("UNIQUE") && msg.includes("tags.slug")) {
      return res.status(409).json({ code: 409, message: "slug_taken" });
    }
    return res.status(500).json({ code: 500, message: "server_error" });
  }
}

function deleteTag(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare(`DELETE FROM tags WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Tag not found" });
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

// TODO(T2.10): tags 表与 post_tags 自动级联可能产生 0-tag 文章；前端列表会显示空标签数组，§5.1.3 标签筛选 UI 注意空数组兼容。
// TODO(T2.10): listTags 暂不分页（与 legacy 等价）；如博客标签数 > 数千考虑加 ?keyword= + LIMIT/OFFSET。

module.exports = {
  listTags,
  createTag,
  updateTag,
  deleteTag,
};
