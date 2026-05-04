const { openDb } = require("../../../db");
const { nowIso } = require("../../../utils");

// 与 legacy frontApp /api/admin/export 完全一致的 shape：
//   { version: 2, exportedAt, links, posts, tags, postTags, categories, postCategories }
// 旧备份文件可以直接通过 v2 import 还原。
function exportData(req, res) {
  const db = openDb();
  const links = db.prepare(`SELECT * FROM external_links`).all();
  const posts = db.prepare(`SELECT * FROM posts`).all();
  const tags = db.prepare(`SELECT * FROM tags`).all();
  const postTags = db.prepare(`SELECT * FROM post_tags`).all();
  const categories = db.prepare(`SELECT * FROM categories`).all();
  const postCategories = db.prepare(`SELECT * FROM post_categories`).all();

  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      version: 2,
      exportedAt: nowIso(),
      links,
      posts,
      tags,
      postTags,
      categories,
      postCategories,
    },
  });
}

// importData
// 输入：完整的 export shape（在 req.body 或 req.body.data，兼容两种）。
// 行为：transaction 内 DELETE 后 INSERT，FK 暂时关掉避免删 posts 时报子表外键错。
// 失败：rollback + 500 + err.message。
function importData(req, res) {
  const db = openDb();
  // 同时兼容直接发 export shape 和 envelope 包裹（{ data: {...} }）。
  const root = req.body || {};
  const data = root.data && typeof root.data === "object" ? root.data : root;

  if (!data || data.version !== 2) {
    return res.status(400).json({ code: 400, message: "invalid_format" });
  }

  // 数据基本类型校验：每个字段如出现，必须是数组
  const arrayFields = ["links", "posts", "tags", "postTags", "categories", "postCategories"];
  for (const f of arrayFields) {
    if (data[f] !== undefined && !Array.isArray(data[f])) {
      return res.status(400).json({ code: 400, message: `invalid_format: ${f} must be array` });
    }
  }

  const counts = { posts: 0, tags: 0, postTags: 0, categories: 0, postCategories: 0, links: 0 };
  const now = nowIso();

  const tx = db.transaction(() => {
    if (Array.isArray(data.posts)) {
      db.prepare(`DELETE FROM posts`).run();
      const insertPost = db.prepare(
        `INSERT INTO posts (id, title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
         VALUES (@id, @title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, @contentHtml, @status, @publishedAt, @createdAt, @updatedAt)`,
      );
      for (const post of data.posts) {
        insertPost.run(post);
        counts.posts += 1;
      }
    }
    if (Array.isArray(data.tags)) {
      db.prepare(`DELETE FROM tags`).run();
      const insertTag = db.prepare(
        `INSERT INTO tags (id, name, slug, createdAt) VALUES (@id, @name, @slug, @createdAt)`,
      );
      for (const tag of data.tags) {
        insertTag.run({ ...tag, createdAt: tag.createdAt || now });
        counts.tags += 1;
      }
    }
    if (Array.isArray(data.postTags)) {
      db.prepare(`DELETE FROM post_tags`).run();
      const insertPT = db.prepare(
        `INSERT INTO post_tags (postId, tagId) VALUES (@postId, @tagId)`,
      );
      for (const pt of data.postTags) {
        insertPT.run(pt);
        counts.postTags += 1;
      }
    }
    if (Array.isArray(data.categories)) {
      db.prepare(`DELETE FROM post_categories`).run();
      db.prepare(`DELETE FROM categories`).run();
      const insertCategory = db.prepare(
        `INSERT INTO categories (id, name, slug, createdAt) VALUES (@id, @name, @slug, @createdAt)`,
      );
      for (const cat of data.categories) {
        insertCategory.run({ ...cat, createdAt: cat.createdAt || now });
        counts.categories += 1;
      }
    }
    if (Array.isArray(data.postCategories)) {
      const insertPC = db.prepare(
        `INSERT INTO post_categories (postId, categoryId) VALUES (@postId, @categoryId)`,
      );
      for (const pc of data.postCategories) {
        insertPC.run(pc);
        counts.postCategories += 1;
      }
    }
    if (Array.isArray(data.links)) {
      db.prepare(`DELETE FROM external_links`).run();
      const insertLink = db.prepare(
        `INSERT INTO external_links (title, url, icon, iconSize, sortOrder, createdAt, updatedAt)
         VALUES (@title, @url, @icon, @iconSize, @sortOrder, @createdAt, @updatedAt)`,
      );
      for (const link of data.links) {
        insertLink.run(link);
        counts.links += 1;
      }
    }
  });

  // 关 FK 是为了让 DELETE FROM posts 不报子表 (post_tags/post_categories) 外键错；
  // 上面 tx 顺序已经保证子表先删,但保险起见与 legacy 保持等价。
  db.pragma("foreign_keys = OFF");
  try {
    tx();
    return res.status(200).json({
      code: 200,
      message: "success",
      data: { imported: counts },
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: "import_failed",
      detail: err && err.message ? err.message : String(err),
    });
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

// TODO(T2.14): export 走 GET → 不入审计（auditLogger 全局规则）。敏感的全库导出建议 ops:logs 增加专项追溯，Phase 4 ops 模块解决。
// TODO(T2.15): version 字段当前只校验 ===2，旧 v1 备份会被拒。如果有 v1 文件，后续可加迁移分支。
// TODO(T2.15): import 失败时 audit 记录的 status=500 但 detail 里没保留报错 message，后续可加 error 字段。
// TODO(T2.15): import body 当前完整进 audit_logs.detail（可达 10 mb），未来应改成只记 itemCounts 摘要，避免审计表膨胀。

module.exports = {
  exportData,
  importData,
};
