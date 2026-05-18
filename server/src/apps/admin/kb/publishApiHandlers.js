const { openDb } = require("../../../db");
const { nowIso, normalizeSlug, splitTags } = require("../../../utils");

function ensureUniqueSlug(db, baseSlug, table, column = "slug") {
  let slug = baseSlug;
  let counter = 0;
  while (true) {
    const existing = db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(slug);
    if (!existing) break;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
  return slug;
}

function publishBlogPost(req, res) {
  const { title, slug: inputSlug, excerpt, coverImageUrl, contentMarkdown, tags, categories, status } = req.body;

  if (!title || !contentMarkdown) {
    return res.status(400).json({ error: "title and contentMarkdown are required" });
  }

  const db = openDb();
  const now = nowIso();

  const baseSlug = inputSlug ? normalizeSlug(inputSlug) : normalizeSlug(title);
  const slug = ensureUniqueSlug(db, baseSlug, "posts");

  const wordCount = contentMarkdown.split(/\s+/).filter(Boolean).length;
  const contentHtml = contentMarkdown;

  const post = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    slug,
    excerpt || "",
    coverImageUrl || "",
    contentMarkdown,
    contentHtml,
    status === "published" ? "published" : "draft",
    status === "published" ? now : null,
    now,
    now
  );

  const postId = post.lastInsertRowid;

  if (tags && Array.isArray(tags) && tags.length > 0) {
    const tagIds = [];
    for (const tagName of tags) {
      let tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName);
      if (!tag) {
        const tagSlug = normalizeSlug(tagName);
        const result = db.prepare("INSERT INTO tags (name, slug, createdAt) VALUES (?, ?, ?)").run(tagName, tagSlug, now);
        tag = { id: result.lastInsertRowid };
      }
      tagIds.push(tag.id);
    }
    for (const tagId of tagIds) {
      db.prepare("INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)").run(postId, tagId);
    }
  }

  if (categories && Array.isArray(categories) && categories.length > 0) {
    const catIds = [];
    for (const catName of categories) {
      let cat = db.prepare("SELECT id FROM categories WHERE name = ?").get(catName);
      if (!cat) {
        const catSlug = normalizeSlug(catName);
        const result = db.prepare("INSERT INTO categories (name, slug, createdAt) VALUES (?, ?, ?)").run(catName, catSlug, now);
        cat = { id: result.lastInsertRowid };
      }
      catIds.push(cat.id);
    }
    for (const catId of catIds) {
      db.prepare("INSERT OR IGNORE INTO post_categories (postId, categoryId) VALUES (?, ?)").run(postId, catId);
    }
  }

  res.status(201).json({
    code: 201,
    message: "success",
    data: { postId, slug, wordCount },
  });
}

function publishKbDocument(req, res) {
  const { title, slug: inputSlug, excerpt, contentMarkdown, contentHtml, category, doc_type, tags, status } = req.body;

  if (!title || !contentMarkdown) {
    return res.status(400).json({ error: "title and contentMarkdown are required" });
  }

  const db = openDb();
  const now = nowIso();

  const baseSlug = inputSlug ? normalizeSlug(inputSlug) : normalizeSlug(title);
  const slug = ensureUniqueSlug(db, baseSlug, "kb_documents");

  const wordCount = contentMarkdown.split(/\s+/).filter(Boolean).length;

  const doc = db.prepare(`
    INSERT INTO kb_documents (title, slug, excerpt, content_markdown, content_html, source, category, doc_type, status, word_count, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'api', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    slug,
    excerpt || "",
    contentMarkdown,
    contentHtml || contentMarkdown,
    category || "",
    doc_type || "concept",
    status === "archived" ? "archived" : "active",
    wordCount,
    JSON.stringify(tags || []),
    now,
    now
  );

  const documentId = doc.lastInsertRowid;

  res.status(201).json({
    code: 201,
    message: "success",
    data: { documentId, slug, wordCount },
  });
}

module.exports = { publishBlogPost, publishKbDocument };