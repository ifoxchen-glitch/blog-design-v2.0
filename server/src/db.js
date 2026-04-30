const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { nowIso, normalizeSlug } = require("./utils");

function openDb() {
  const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      coverImageUrl TEXT,
      contentMarkdown TEXT NOT NULL,
      contentHtml TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
      publishedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_tags (
      postId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (postId, tagId),
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_categories (
      postId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      PRIMARY KEY (postId, categoryId),
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS external_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      iconSize TEXT NOT NULL DEFAULT '1x1' CHECK (iconSize IN ('1x1', '2x1', '1x2', '2x2')),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_status_publishedAt ON posts(status, publishedAt);
    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    CREATE INDEX IF NOT EXISTS idx_post_tags_tagId ON post_tags(tagId);
    CREATE INDEX IF NOT EXISTS idx_post_categories_categoryId ON post_categories(categoryId);
    CREATE INDEX IF NOT EXISTS idx_external_links_sortOrder ON external_links(sortOrder);
  `);
}

function ensureSeed(db) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM posts").get().c;
  if (count > 0) return;

  const createdAt = nowIso();
  const updatedAt = createdAt;
  const publishedAt = createdAt;
  const title = "用真实长文压版式：单篇文章模板";
  const slug = normalizeSlug("post-template");
  const excerpt = "代码块、列表、引用与多级标题在同一条阅读流里是否舒服，只有放进真内容才知道。";
  const coverImageUrl = "https://picsum.photos/seed/posthero/960/480";
  const contentMarkdown = `# 用真实长文压版式：单篇文章模板

这是一篇用于压版的示例文章。你可以在后台编辑它，发布后前台会通过 API 动态渲染。

## 设计令牌与 CSS

原型将 Variables 映射为 \`css/tokens.css\` 中的自定义属性：颜色、字号阶梯、间距、圆角与正文最大宽度。

## 代码块示例

\`\`\`ts
type Post = { title: string; slug: string; publishedAt: string };
\`\`\`
`;

  const insertPost = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
    VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, 'published', @publishedAt, @createdAt, @updatedAt)
  `);
  const info = insertPost.run({
    title,
    slug,
    excerpt,
    coverImageUrl,
    contentMarkdown,
    publishedAt,
    createdAt,
    updatedAt,
  });

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getTagId = db.prepare(`SELECT id FROM tags WHERE slug = ?`);
  const attach = db.prepare(`INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`);

  const tagNames = ["前端", "排版"];
  for (const name of tagNames) {
    const tSlug = normalizeSlug(name);
    insertTag.run({ name, slug: tSlug, createdAt });
    const tagId = getTagId.get(tSlug).id;
    attach.run(info.lastInsertRowid, tagId);
  }
}

function listTagsForPost(db, postId) {
  return db
    .prepare(
      `
      SELECT t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tagId = t.id
      WHERE pt.postId = ?
      ORDER BY t.name ASC
    `
    )
    .all(postId);
}

function upsertTags(db, tagNames) {
  const createdAt = nowIso();
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getTag = db.prepare(`SELECT id, name, slug FROM tags WHERE slug = ?`);

  const tags = [];
  for (const name of tagNames) {
    const slug = normalizeSlug(name);
    if (!slug) continue;
    insertTag.run({ name, slug, createdAt });
    tags.push(getTag.get(slug));
  }
  return tags;
}

function setPostTags(db, postId, tagNames) {
  const tags = upsertTags(db, tagNames);
  const del = db.prepare(`DELETE FROM post_tags WHERE postId = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`);

  const tx = db.transaction(() => {
    del.run(postId);
    for (const t of tags) ins.run(postId, t.id);
  });
  tx();

  return tags.map(({ name, slug }) => ({ name, slug }));
}

function upsertCategories(db, categoryNames) {
  const createdAt = nowIso();
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getCategory = db.prepare(`SELECT id, name, slug FROM categories WHERE slug = ?`);

  const categories = [];
  for (const name of categoryNames) {
    const slug = normalizeSlug(name);
    if (!slug) continue;
    insertCategory.run({ name, slug, createdAt });
    const existing = getCategory.get(slug);
    if (existing) categories.push(existing);
  }
  return categories;
}

function listCategoriesForPost(db, postId) {
  return db
    .prepare(
      `
      SELECT c.name, c.slug
      FROM categories c
      JOIN post_categories pc ON pc.categoryId = c.id
      WHERE pc.postId = ?
      ORDER BY c.name ASC
    `
    )
    .all(postId);
}

function setPostCategories(db, postId, categoryNames) {
  const categories = upsertCategories(db, categoryNames);
  const del = db.prepare(`DELETE FROM post_categories WHERE postId = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO post_categories (postId, categoryId) VALUES (?, ?)`);

  const tx = db.transaction(() => {
    del.run(postId);
    for (const c of categories) ins.run(postId, c.id);
  });
  tx();

  return categories.map(({ name, slug }) => ({ name, slug }));
}

module.exports = {
  openDb,
  migrate,
  ensureSeed,
  listTagsForPost,
  setPostTags,
  listCategoriesForPost,
  setPostCategories,
};

