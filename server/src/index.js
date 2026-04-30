const path = require("node:path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { optional, required } = require("./env");
const { openDb, migrate, ensureSeed, listTagsForPost, setPostTags, listCategoriesForPost, setPostCategories } = require("./db");
const { renderMarkdownToSafeHtml } = require("./markdown");
const { nowIso, normalizeSlug, splitTags, toInt } = require("./utils");
const { verifyAdminLogin, requireAdmin, requireAdminPage } = require("./auth");

const app = express();

const PORT = toInt(optional("PORT", "8787"), 8787);
const SESSION_SECRET = required("SESSION_SECRET", crypto.randomBytes(32).toString("hex"));
const ADMIN_EMAIL = optional("ADMIN_EMAIL", "admin@example.com");
const ADMIN_PASSWORD = optional("ADMIN_PASSWORD", "admin");
const ADMIN_PASSWORD_HASH = optional("ADMIN_PASSWORD_HASH", "");
const AGENT_API_KEY = optional("AGENT_API_KEY", "");

const BLOG_ROOT = path.join(__dirname, "..", ".."); // blog-design/
const SERVER_PUBLIC = path.join(__dirname, "..", "public");
const UPLOAD_DIR = path.join(SERVER_PUBLIC, "uploads");

function requireAgentApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query["api_key"];
  if (!AGENT_API_KEY) return res.status(401).json({ error: "agent_api_not_configured" });
  if (!apiKey || apiKey !== AGENT_API_KEY) return res.status(401).json({ error: "invalid_api_key" });
  next();
}

const db = openDb();
migrate(db);
ensureSeed(db);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${name}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" },
}));

// Serve the existing prototype as the front-end.
app.use(express.static(BLOG_ROOT));
// Admin-only assets (optional).
app.use("/admin-static", express.static(SERVER_PUBLIC));

app.get("/health", (req, res) => res.json({ ok: true }));

// -----------------------
// Image Upload API (admin only)
// -----------------------
app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "invalid_file" });
  const url = `/admin-static/uploads/${req.file.filename}`;
  res.json({ url });
});

// -----------------------
// External Links API
// -----------------------
app.get("/api/links", (req, res) => {
  const links = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder FROM external_links ORDER BY sortOrder ASC`)
    .all();
  res.json({ links });
});

app.get("/api/admin/links", requireAdmin, (req, res) => {
  const links = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder FROM external_links ORDER BY sortOrder ASC`)
    .all();
  res.json({ links });
});

app.post("/api/admin/links", requireAdmin, (req, res) => {
  const title = String(req.body.title ?? "").trim() || "未命名";
  const url = String(req.body.url ?? "").trim();
  const icon = String(req.body.icon ?? "").trim() || "";
  const iconSize = ["1x1", "2x1", "1x2", "2x2"].includes(req.body.iconSize) ? req.body.iconSize : "1x1";
  const now = nowIso();

  const info = db
    .prepare(`INSERT INTO external_links (title, url, icon, iconSize, sortOrder, createdAt, updatedAt) VALUES (@title, @url, @icon, @iconSize, 0, @now, @now)`)
    .run({ title, url, icon, iconSize, now });

  res.status(201).json({ link: { id: info.lastInsertRowid, title, url, icon, iconSize } });
});

app.put("/api/admin/links/:id", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  const title = String(req.body.title ?? "").trim() || "未命名";
  const url = String(req.body.url ?? "").trim();
  const icon = String(req.body.icon ?? "").trim();
  const iconSize = ["1x1", "2x1", "1x2", "2x2"].includes(req.body.iconSize) ? req.body.iconSize : "1x1";
  const sortOrder = toInt(req.body.sortOrder, 0);
  const now = nowIso();

  db.prepare(`UPDATE external_links SET title=@title, url=@url, icon=@icon, iconSize=@iconSize, sortOrder=@sortOrder, updatedAt=@now WHERE id=@id`)
    .run({ id, title, url, icon, iconSize, sortOrder, now });

  res.json({ ok: true });
});

app.delete("/api/admin/links/:id", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  db.prepare(`DELETE FROM external_links WHERE id = ?`).run(id);
  res.json({ ok: true });
});

app.get("/api/admin/export", requireAdmin, (req, res) => {
  const links = db.prepare(`SELECT * FROM external_links`).all();
  const posts = db.prepare(`SELECT * FROM posts`).all();
  const tags = db.prepare(`SELECT * FROM tags`).all();
  const postTags = db.prepare(`SELECT * FROM post_tags`).all();
  res.json({ version: 1, exportedAt: nowIso(), links, posts, tags, postTags });
});

app.post("/api/admin/import", requireAdmin, (req, res) => {
  const data = req.body;
  if (!data.version) return res.status(400).json({ error: "invalid_format" });

  const tx = db.transaction(() => {
    db.pragma("foreign_keys = OFF");
    if (data.posts) {
      db.prepare(`DELETE FROM posts`).run();
      const insertPost = db.prepare(`INSERT INTO posts (id, title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt) VALUES (@id, @title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, @contentHtml, @status, @publishedAt, @createdAt, @updatedAt)`);
      data.posts.forEach(post => insertPost.run(post));
    }
    if (data.tags) {
      db.prepare(`DELETE FROM tags`).run();
      const now = nowIso();
      data.tags.forEach(tag => db.prepare(`INSERT INTO tags (id, name, slug, createdAt) VALUES (@id, @name, @slug, @createdAt)`).run({ ...tag, id: tag.id, createdAt: tag.createdAt || now }));
    }
    if (data.postTags) {
      db.prepare(`DELETE FROM post_tags`).run();
      data.postTags.forEach(pt => db.prepare(`INSERT INTO post_tags (postId, tagId) VALUES (@postId, @tagId)`).run(pt));
    }
    if (data.links) {
      db.prepare(`DELETE FROM external_links`).run();
      const insertLink = db.prepare(`INSERT INTO external_links (title, url, icon, iconSize, sortOrder, createdAt, updatedAt) VALUES (@title, @url, @icon, @iconSize, @sortOrder, @createdAt, @updatedAt)`);
      data.links.forEach(link => insertLink.run(link));
    }
    db.pragma("foreign_keys = ON");
  });

  try {
    tx();
    res.json({ ok: true });
  } catch (err) {
    db.pragma("foreign_keys = ON");
    res.status(500).json({ error: err.message });
  }
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

app.post("/api/agent/sync-obsidian", requireAgentApiKey, (req, res) => {
  const { vaultPath, slugPrefix } = req.body;
  
  const vault = vaultPath || path.join(process.env.HOME || process.env.USERPROFILE, "obsidian");
  const postsDir = path.join(vault, "posts");
  const prefix = slugPrefix || "obsidian-";

  if (!require("node:fs").existsSync(postsDir)) {
    return res.status(400).json({ error: "obsidian_vault_not_found", path: postsDir });
  }

  const fs = require("node:fs");
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith(".md"));
  const now = nowIso();
  const synced = [];

  for (const file of files) {
    try {
      const filePath = path.join(postsDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      
      let frontmatter = {};
      if (content.startsWith("---")) {
        const end = content.indexOf("---", 3);
        if (end > 0) {
          const fmText = content.slice(3, end).trim();
          fmText.split("\n").forEach(line => {
            const [key, ...vals] = line.split(":");
            if (key && vals.length) {
              frontmatter[key.trim()] = vals.join(":").trim();
            }
          });
        }
      }

      const mdContent = content.replace(/^---[\s\S]*?---/, "").trim();
      const title = frontmatter.title || file.replace(".md", "");
      const slug = normalizeSlug(prefix + (frontmatter.slug || title));
      const tags = frontmatter.tags ? frontmatter.tags.split(",").map(t => t.trim()) : [];
      const categories = frontmatter.categories ? frontmatter.categories.split(",").map(c => c.trim()) : [];
      const postStatus = frontmatter.status === "published" ? "published" : "draft";
      const publishedAt = postStatus === "published" ? now : null;

      try {
        const info = db
          .prepare(`
            INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
            VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, @status, @publishedAt, @createdAt, @updatedAt)
            ON CONFLICT(slug) DO UPDATE SET title=@title, contentMarkdown=@contentMarkdown, updatedAt=@updatedAt
          `)
          .run({
            title,
            slug,
            excerpt: frontmatter.excerpt || null,
            coverImageUrl: frontmatter.cover || null,
            contentMarkdown: mdContent,
            status: postStatus,
            publishedAt,
            createdAt: now,
            updatedAt: now
          });

        const postId = info.lastInsertRowid || db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug)?.id;
        
        if (postId) {
          setPostTags(db, postId, tags);
          setPostCategories(db, postId, categories);
        }

        synced.push(title);
      } catch (e) {
        console.error("Sync error for", file, e.message);
      }
    } catch (e) {
      console.error("Read error for", file, e.message);
    }
  }

  res.json({ ok: true, synced: synced.length, files: synced });
});

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
  const countSql = `SELECT COUNT(*) as total FROM posts p${joins ? ' ' + joins : ''} WHERE ${where.join(" AND ")}`;
  const countResult = db.prepare(countSql).get(params);
  const total = countResult?.total || 0;

  const rows = db
    .prepare(
      `
      SELECT p.id, p.title, p.slug, p.excerpt, p.coverImageUrl, p.publishedAt, p.createdAt, p.updatedAt
      FROM posts p
      ${joins}
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(p.publishedAt, p.createdAt) DESC
      LIMIT @limit OFFSET @offset
    `
  )
  .all(params);

  const posts = rows.map((p) => ({
    ...p,
    tags: listTagsForPost(db, p.id),
    categories: listCategoriesForPost(db, p.id),
  }));

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

  const siteUrl = "https://ifoxchen.com";
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
// Admin API (auth required)
// -----------------------

app.post("/api/admin/login", async (req, res) => {
  const email = String(req.body.email ?? "");
  const password = String(req.body.password ?? "");
  const ok = await verifyAdminLogin(
    { email, password },
    { adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD, adminPasswordHash: ADMIN_PASSWORD_HASH || "" }
  );

  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  req.session.admin = { loggedIn: true, email: ADMIN_EMAIL };
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/posts", requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, title, slug, excerpt, coverImageUrl, status, publishedAt, createdAt, updatedAt
      FROM posts
      ORDER BY updatedAt DESC
    `
    )
    .all();
  const posts = rows.map((p) => ({ ...p, tags: listTagsForPost(db, p.id) }));
  res.json({ posts });
});

app.post("/api/admin/posts", requireAdmin, (req, res) => {
  const title = String(req.body.title ?? "").trim() || "未命名文章";
  const slug = normalizeSlug(req.body.slug || title || nowIso());
  const excerpt = String(req.body.excerpt ?? "").trim() || null;
  const coverImageUrl = String(req.body.coverImageUrl ?? "").trim() || null;
  const contentMarkdown = String(req.body.contentMarkdown ?? "").trim() || "";
  const status = String(req.body.status ?? "draft") === "published" ? "published" : "draft";
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const publishedAt = status === "published" ? nowIso() : null;

  try {
    const info = db
      .prepare(
        `
        INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
        VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, @status, @publishedAt, @createdAt, @updatedAt)
      `
      )
      .run({ title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt });

    const tagNames = splitTags(req.body.tags);
    const tags = setPostTags(db, info.lastInsertRowid, tagNames);
    const categoryNames = splitTags(req.body.categories || "");
    setPostCategories(db, info.lastInsertRowid, categoryNames);

    res.status(201).json({ post: { id: info.lastInsertRowid, title, slug, status, tags } });
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE") && String(e.message || "").includes("posts.slug")) {
      return res.status(409).json({ error: "slug_taken" });
    }
    return res.status(500).json({ error: "server_error" });
  }
});

app.put("/api/admin/posts/:id", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  const existing = db
    .prepare(
      `SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt FROM posts WHERE id = ?`
    )
    .get(id);
  if (!existing) return res.status(404).json({ error: "not_found" });

  const title = String(req.body.title ?? existing.title).trim() || existing.title;
  const slug = normalizeSlug(req.body.slug ?? existing.slug) || existing.slug;
  const excerpt = String(req.body.excerpt ?? "").trim() || null;
  const coverImageUrl = String(req.body.coverImageUrl ?? "").trim() || null;
  const contentMarkdown = String(req.body.contentMarkdown ?? existing.contentMarkdown);
  const updatedAt = nowIso();

  try {
    db.prepare(
      `
      UPDATE posts
      SET title=@title, slug=@slug, excerpt=@excerpt, coverImageUrl=@coverImageUrl,
          contentMarkdown=@contentMarkdown, contentHtml=NULL, updatedAt=@updatedAt
      WHERE id=@id
    `
    ).run({ id, title, slug, excerpt, coverImageUrl, contentMarkdown, updatedAt });

    const tagNames = splitTags(req.body.tags);
    const tags = setPostTags(db, id, tagNames);
    const categoryNames = splitTags(req.body.categories || "");
    setPostCategories(db, id, categoryNames);

    res.json({ post: { id, title, slug, tags } });
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE") && String(e.message || "").includes("posts.slug")) {
      return res.status(409).json({ error: "slug_taken" });
    }
    return res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/admin/posts/:id/publish", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  const updatedAt = nowIso();
  const publishedAt = nowIso();
  const info = db
    .prepare(`UPDATE posts SET status='published', publishedAt=@publishedAt, updatedAt=@updatedAt WHERE id=@id`)
    .run({ id, publishedAt, updatedAt });
  if (info.changes === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

app.post("/api/admin/posts/:id/unpublish", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  const updatedAt = nowIso();
  const info = db.prepare(`UPDATE posts SET status='draft', updatedAt=@updatedAt WHERE id=@id`).run({ id, updatedAt });
  if (info.changes === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

app.delete("/api/admin/posts/:id", requireAdmin, (req, res) => {
  const id = toInt(req.params.id, 0);
  const info = db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// -----------------------
// Admin pages (EJS)
// -----------------------

app.get("/admin/api", requireAdminPage, (req, res) => {
  res.render("api", { agentApiKey: AGENT_API_KEY });
});

app.post("/admin/api/regenerate-key", requireAdminPage, (req, res) => {
  const newKey = crypto.randomBytes(24).toString("hex");
  const envPath = path.join(__dirname, "..", ".env");
  const fs = require("node:fs");
  
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    content = content.replace(/AGENT_API_KEY=.*/g, `AGENT_API_KEY=${newKey}`);
    content += "\n";
    fs.writeFileSync(envPath, content);
  }
  
  process.env.AGENT_API_KEY = newKey;
  global.AGENT_API_KEY = newKey;
  
  res.json({ ok: true, apiKey: newKey });
});

app.get("/admin/login", (req, res) => {
  res.render("login", { adminEmail: ADMIN_EMAIL });
});

app.post("/admin/login", async (req, res) => {
  const email = String(req.body.email ?? "");
  const password = String(req.body.password ?? "");
  const ok = await verifyAdminLogin(
    { email, password },
    { adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD, adminPasswordHash: ADMIN_PASSWORD_HASH || "" }
  );
  if (!ok) return res.status(401).render("login", { adminEmail: ADMIN_EMAIL, error: "邮箱或密码错误" });
  req.session.admin = { loggedIn: true, email: ADMIN_EMAIL };
  res.redirect("/admin/posts");
});

app.post("/admin/logout", requireAdminPage, (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

app.get("/admin/posts", requireAdminPage, (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "").trim();

  const where = [];
  const params = {};

  if (q) {
    where.push("(title LIKE @q OR slug LIKE @q OR excerpt LIKE @q)");
    params.q = `%${q}%`;
  }
  if (status === "published" || status === "draft") {
    where.push("status = @status");
    params.status = status;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const posts = db
    .prepare(
      `SELECT id, title, slug, excerpt, coverImageUrl, status, publishedAt, createdAt, updatedAt
       FROM posts ${whereClause}
       ORDER BY updatedAt DESC`
    )
    .all(params)
    .map((p) => ({
      ...p,
      tags: listTagsForPost(db, p.id),
      categories: listCategoriesForPost(db, p.id),
    }));

  const counts = {
    all: db.prepare("SELECT COUNT(*) AS c FROM posts").get().c,
    published: db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status='published'").get().c,
    draft: db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status='draft'").get().c,
  };

  res.render("posts", { posts, q, status, counts });
});

app.get("/admin/posts/new", requireAdminPage, (req, res) => {
  res.render("edit", {
    mode: "new",
    post: {
      title: "",
      slug: "",
      excerpt: "",
      coverImageUrl: "",
      tags: "",
      contentMarkdown: "",
      status: "draft",
    },
  });
});

app.get("/admin/posts/:id/edit", requireAdminPage, (req, res) => {
  const id = toInt(req.params.id, 0);
  const post = db
    .prepare(
      `
      SELECT id, title, slug, excerpt, coverImageUrl, contentMarkdown, status, publishedAt, createdAt, updatedAt
      FROM posts
      WHERE id = ?
    `
    )
    .get(id);
  if (!post) return res.status(404).send("Not found");

  const tags = listTagsForPost(db, id).map((t) => t.name).join(", ");
  const categories = listCategoriesForPost(db, id).map((c) => c.name).join(", ");
  res.render("edit", { mode: "edit", post: { ...post, tags, categories } });
});

app.post("/admin/posts/save", requireAdminPage, (req, res) => {
  const id = toInt(req.body.id, 0);
  const isNew = !id;
  const title = String(req.body.title ?? "").trim() || "未命名文章";
  const slug = normalizeSlug(req.body.slug || title || nowIso());
  const excerpt = String(req.body.excerpt ?? "").trim() || null;
  const coverImageUrl = String(req.body.coverImageUrl ?? "").trim() || null;
  const tags = splitTags(req.body.tags);
  const categories = splitTags(req.body.categories);
  const contentMarkdown = String(req.body.contentMarkdown ?? "");
  const updatedAt = nowIso();

  try {
    if (isNew) {
      const createdAt = updatedAt;
      const info = db
        .prepare(
          `
          INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
          VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, 'draft', NULL, @createdAt, @updatedAt)
        `
        )
        .run({ title, slug, excerpt, coverImageUrl, contentMarkdown, createdAt, updatedAt });
      setPostTags(db, info.lastInsertRowid, tags);
      setPostCategories(db, info.lastInsertRowid, categories);
      return res.redirect(`/admin/posts/${info.lastInsertRowid}/edit`);
    }

    db.prepare(
      `
      UPDATE posts
      SET title=@title, slug=@slug, excerpt=@excerpt, coverImageUrl=@coverImageUrl,
          contentMarkdown=@contentMarkdown, contentHtml=NULL, updatedAt=@updatedAt
      WHERE id=@id
    `
    ).run({ id, title, slug, excerpt, coverImageUrl, contentMarkdown, updatedAt });
    setPostTags(db, id, tags);
    setPostCategories(db, id, categories);
    return res.redirect(`/admin/posts/${id}/edit`);
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE") && String(e.message || "").includes("posts.slug")) {
      return res.status(409).send("slug 已存在，请换一个");
    }
    return res.status(500).send("保存失败");
  }
});

app.post("/admin/posts/:id/publish", requireAdminPage, (req, res) => {
  const id = toInt(req.params.id, 0);
  const updatedAt = nowIso();
  const publishedAt = nowIso();
  db.prepare(`UPDATE posts SET status='published', publishedAt=@publishedAt, updatedAt=@updatedAt WHERE id=@id`).run({
    id,
    publishedAt,
    updatedAt,
  });
  res.redirect(`/admin/posts/${id}/edit`);
});

app.post("/admin/posts/:id/unpublish", requireAdminPage, (req, res) => {
  const id = toInt(req.params.id, 0);
  const updatedAt = nowIso();
  db.prepare(`UPDATE posts SET status='draft', updatedAt=@updatedAt WHERE id=@id`).run({ id, updatedAt });
  res.redirect(`/admin/posts/${id}/edit`);
});

app.post("/admin/posts/:id/delete", requireAdminPage, (req, res) => {
  const id = toInt(req.params.id, 0);
  db.prepare(`DELETE FROM posts WHERE id=?`).run(id);
  res.redirect("/admin/posts");
});

app.get("/admin/links", requireAdminPage, (req, res) => {
  res.render("links");
});

app.listen(PORT, () => {
  console.log(`Blog server running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/login`);
});

