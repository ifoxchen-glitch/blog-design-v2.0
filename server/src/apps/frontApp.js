const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { required, optional } = require("../env");
const { openDb, listTagsForPost, listTagsForPosts, listCategoriesForPosts, setPostTags, listCategoriesForPost, setPostCategories } = require("../db");
const { renderMarkdownToSafeHtml } = require("../markdown");
const { nowIso, normalizeSlug, splitTags, toInt } = require("../utils");

const app = express();

const SESSION_SECRET = required("SESSION_SECRET", crypto.randomBytes(32).toString("hex"));
const AGENT_API_KEY = optional("AGENT_API_KEY", "");
const SITE_URL = optional("SITE_URL", "https://ifoxchen.com").replace(/\/+$/, "");

const BLOG_ROOT = path.join(__dirname, "..", "..", ".."); // blog-design/
const SERVER_PUBLIC = path.join(__dirname, "..", "..", "public");

function requireAgentApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query["api_key"];
  if (!AGENT_API_KEY) {
    console.warn("AGENT_API_KEY not configured; rejecting agent request");
    return res.status(401).json({ error: "invalid_api_key" });
  }
  if (!apiKey) return res.status(401).json({ error: "invalid_api_key" });
  try {
    const a = Buffer.from(apiKey, "utf8");
    const b = Buffer.from(AGENT_API_KEY, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "invalid_api_key" });
    }
  } catch {
    return res.status(401).json({ error: "invalid_api_key" });
  }
  next();
}

const db = openDb();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Custom CSP without upgrade-insecure-requests (breaks LAN HTTP)
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://cdn.jsdelivr.net"
  );
  next();
});

// Serve the existing prototype as the front-end (with caching).
app.use(express.static(BLOG_ROOT, { maxAge: "7d", etag: true }));
// Admin-only assets (no caching).
app.use("/admin-static", express.static(SERVER_PUBLIC));

app.get("/health", (req, res) => res.json({ ok: true }));

// -----------------------
// Page View Tracking
// -----------------------
const TRANSPARENT_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

app.get("/api/pv", (req, res) => {
  try {
    const db = openDb();
    const path = String(req.query.path ?? "").slice(0, 512);
    const referrer = String(req.query.ref ?? "").slice(0, 1024);
    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers["user-agent"] || null;
    const sessionId = req.sessionID || null;

    db.prepare(
      `INSERT INTO page_views (path, referrer, ip, user_agent, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(path, referrer || null, ip, userAgent, sessionId, nowIso());
  } catch (err) {
    // PV tracking must never break the page
    console.error("[pv] insert failed:", err.message);
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(TRANSPARENT_GIF);
});

// -----------------------
// External Links API (public)
// -----------------------
app.get("/api/links", (req, res) => {
  const links = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder FROM external_links ORDER BY sortOrder ASC`)
    .all();
  res.json({ links });
});

// -----------------------
// Agent API (External Agent Publishing)
// -----------------------

app.post("/api/agent/publish", requireAgentApiKey, (req, res) => {
  const { title, slug, excerpt, coverImageUrl, contentMarkdown, tags, categories, status } = req.body;

  const now = nowIso();
  const postSlug = normalizeSlug(slug || title || now);
  const postStatus = status === "published" ? "published" : "draft";
  const publishedAt = postStatus === "published" ? now : null;

  try {
    const info = db
      .prepare(`
        INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
        VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, @status, @publishedAt, @createdAt, @updatedAt)
      `)
      .run({
        title: title || "未命名",
        slug: postSlug,
        excerpt: excerpt || null,
        coverImageUrl: coverImageUrl || null,
        contentMarkdown: contentMarkdown || "",
        status: postStatus,
        publishedAt,
        createdAt: now,
        updatedAt: now
      });

    const postId = info.lastInsertRowid;

    const tagList = splitTags(tags);
    if (tagList.length) setPostTags(db, postId, tagList);

    const categoryList = splitTags(categories);
    if (categoryList.length) setPostCategories(db, postId, categoryList);

    res.status(201).json({ ok: true, postId, slug: postSlug });
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "slug_exists" });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/agent/sync-categories", requireAgentApiKey, (req, res) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: "categories_must_be_array" });
  }

  const now = nowIso();
  const inserted = [];

  for (const name of categories) {
    const slug = normalizeSlug(name);
    if (!slug) continue;

    try {
      db.prepare(`INSERT OR IGNORE INTO categories (name, slug, createdAt) VALUES (@name, @slug, @createdAt)`)
        .run({ name, slug, createdAt: now });
      inserted.push(name);
    } catch (e) {}
  }

  res.json({ ok: true, synced: inserted });
});

app.post("/api/agent/sync-tags", requireAgentApiKey, (req, res) => {
  const { tags } = req.body;
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: "tags_must_be_array" });
  }

  const now = nowIso();
  const inserted = [];

  for (const name of tags) {
    const slug = normalizeSlug(name);
    if (!slug) continue;

    try {
      db.prepare(`INSERT OR IGNORE INTO tags (name, slug, createdAt) VALUES (@name, @slug, @createdAt)`)
        .run({ name, slug, createdAt: now });
      inserted.push(name);
    } catch (e) {}
  }

  res.json({ ok: true, synced: inserted });
});

// sync-obsidian endpoint removed: accepted user-supplied vaultPath and could read arbitrary .md files on disk.

// -----------------------
// Public API
// -----------------------

app.get("/api/tags", (req, res) => {
  const tags = db
    .prepare(
      `
      SELECT t.name, t.slug, COUNT(pt.postId) AS postCount
      FROM tags t
      LEFT JOIN post_tags pt ON pt.tagId = t.id
      LEFT JOIN posts p ON p.id = pt.postId AND p.status = 'published'
      GROUP BY t.id
      ORDER BY postCount DESC, t.name ASC
    `
    )
    .all();
  res.json({ tags });
});

app.get("/api/categories", (req, res) => {
  const categories = db
    .prepare(
      `
      SELECT c.name, c.slug, COUNT(pc.postId) AS postCount
      FROM categories c
      LEFT JOIN post_categories pc ON pc.categoryId = c.id
      LEFT JOIN posts p ON p.id = pc.postId AND p.status = 'published'
      GROUP BY c.id
      ORDER BY postCount DESC, c.name ASC
    `
    )
    .all();
  res.json({ categories });
});

app.get("/api/posts", (req, res) => {
  const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 12)));
  const offset = Math.max(0, toInt(req.query.offset, 0));
  const tag = String(req.query.tag ?? "").trim();
  const category = String(req.query.category ?? "").trim();
  const q = String(req.query.q ?? "").trim();

  const where = ["p.status = 'published'"];
  const params = { limit, offset };

  let joinTags = "";
  let joinCategories = "";
  if (tag) {
    joinTags = "JOIN post_tags pt ON pt.postId = p.id JOIN tags t ON t.id = pt.tagId";
    where.push("t.slug = @tag");
    params.tag = tag;
  }
  if (category) {
    joinCategories = "JOIN post_categories pc ON pc.postId = p.id JOIN categories c ON c.id = pc.categoryId";
    where.push("c.slug = @category");
    params.category = category;
  }
  if (q) {
    where.push("(p.title LIKE @q OR p.excerpt LIKE @q OR p.contentMarkdown LIKE @q)");
    params.q = `%${q}%`;
  }

  const joins = [joinTags, joinCategories].filter(Boolean).join(" ");
  const rows = db
    .prepare(
      `
      SELECT p.id, p.title, p.slug, p.excerpt, p.coverImageUrl, p.publishedAt, p.createdAt, p.updatedAt,
             COUNT(*) OVER() AS _total
      FROM posts p
      ${joins}
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(p.publishedAt, p.createdAt) DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);

  let total = rows.length ? rows[0]._total : 0;
  if (!rows.length && offset > 0) {
    const countSql = `SELECT COUNT(*) as total FROM posts p${joins ? ' ' + joins : ''} WHERE ${where.join(" AND ")}`;
    total = db.prepare(countSql).get(params)?.total || 0;
  }

  const postIds = rows.map((p) => p.id);
  const tagsMap = listTagsForPosts(db, postIds);
  const catsMap = listCategoriesForPosts(db, postIds);

  const posts = rows.map((p) => {
    const { _total, ...rest } = p;
    return {
      ...rest,
      tags: tagsMap[p.id] || [],
      categories: catsMap[p.id] || [],
    };
  });

  res.json({ posts, limit, offset, total });
});

app.get("/api/posts/:slug", (req, res) => {
  const slug = String(req.params.slug ?? "");
  const post = db
    .prepare(
      `
      SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt
      FROM posts
      WHERE slug = ? AND status = 'published'
      LIMIT 1
    `
    )
    .get(slug);
  if (!post) return res.status(404).json({ error: "not_found" });

  const html = post.contentHtml || renderMarkdownToSafeHtml(post.contentMarkdown);
  const tags = listTagsForPost(db, post.id);
  const categories = listCategoriesForPost(db, post.id);
  res.json({
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      contentHtml: html,
      tags,
      categories,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
  });
});

app.get("/rss.xml", (req, res) => {
  const posts = db
    .prepare(
      `SELECT title, slug, excerpt, coverImageUrl, publishedAt
       FROM posts WHERE status = 'published'
       ORDER BY publishedAt DESC LIMIT 20`
    )
    .all();

  const siteUrl = SITE_URL;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>ifoxchen's blog</title>
  <link>${siteUrl}</link>
  <description>技术博客分享</description>
  <language>zh-CN</language>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
  ${posts
    .map(
      (p) => `<item>
    <title><![CDATA[${p.title}]]></title>
    <link>${siteUrl}/post.html?slug=${p.slug}</link>
    <description><![CDATA[${p.excerpt || ""}]]></description>
    <pubDate>${p.publishedAt ? new Date(p.publishedAt).toUTCString() : ""}</pubDate>
    <guid isPermaLink="false">${siteUrl}/post.html?slug=${p.slug}</guid>
  </item>`
    )
    .join("")}
</channel>
</rss>`;

  res.type("application/rss+xml").send(xml);
});

// -----------------------
// Deprecated API catch-all — legacy frontApp /api/admin/* and /admin/* routes
// have been removed in Phase 5. Returns 410 for any remaining references.
// -----------------------
app.use("/admin", (req, res, next) => {
  if (req.method !== "GET") return next();
  res.status(410).type("html").send(
    "<h1>410 Gone</h1><p>该页面已迁移到新版后台，请访问 <a href='/'>/admin/</a></p>"
  );
});

app.post("/api/admin/*", (req, res) => {
  res.status(410).json({
    code: 410,
    error: "deprecated",
    message: "该 API 已迁移到 v2，请使用 /api/v2/",
    redirectTo: "/api/v2/",
  });
});

module.exports = app;
