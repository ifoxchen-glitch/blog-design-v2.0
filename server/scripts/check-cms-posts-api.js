// One-off helper: verify CMS posts API handlers
// Usage (from server/): node scripts/check-cms-posts-api.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-posts-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/cms/postHandlers");

const db = openDb();
migrate(db);
ensureSeed(db);
ensureRbacSeed(db, {
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
});

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

function makeReq(overrides = {}) {
  return {
    query: {},
    params: {},
    body: {},
    user: null,
    ...overrides,
    query: { ...overrides.query },
    params: { ...overrides.params },
    body: overrides.body !== undefined ? overrides.body : {},
  };
}

async function call(handler, req) {
  let statusCode = 0;
  let respBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { respBody = b; return this; },
  };
  await handler(req, res);
  return { statusCode, body: respBody };
}

function cleanupTestPosts() {
  const ids = db
    .prepare("SELECT id FROM posts WHERE slug LIKE 'testpost-%' OR title LIKE 'testpost_%'")
    .all()
    .map((r) => r.id);
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM post_tags WHERE postId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM post_categories WHERE postId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM posts WHERE id IN (${ph})`).run(...ids);
  }
  // Clean test tags / categories
  db.prepare("DELETE FROM tags WHERE slug LIKE 'testtag-%'").run();
  db.prepare("DELETE FROM categories WHERE slug LIKE 'testcat-%'").run();
}

(async () => {
  cleanupTestPosts();

  let createdId = 0;
  // ---------- createPost ----------
  {
    const r = await call(handlers.createPost, makeReq({ body: {
      title: "testpost_1",
      slug: "testpost-one",
      contentMarkdown: "# Hello",
      excerpt: "intro",
      tags: "testtag-a, testtag-b",
      categories: "testcat-x",
    }}));
    check("createPost -> 201", r.statusCode === 201, `code=${r.body && r.body.code}`);
    const d = r.body && r.body.data;
    check("createPost returns id and slug", d && d.id > 0 && d.slug === "testpost-one");
    check("createPost status default draft", d && d.status === "draft");
    check("createPost no contentHtml leaked", d && !("contentHtml" in d));
    check("createPost has tags array", d && Array.isArray(d.tags) && d.tags.length === 2);
    check("createPost has categories array", d && Array.isArray(d.categories) && d.categories.length === 1);
    createdId = d ? d.id : 0;
  }

  // create with status published -> publishedAt set
  {
    const r = await call(handlers.createPost, makeReq({ body: {
      title: "testpost_2",
      slug: "testpost-two",
      contentMarkdown: "# Two",
      status: "published",
    }}));
    const d = r.body && r.body.data;
    check("createPost published sets publishedAt", d && d.status === "published" && !!d.publishedAt);
  }

  // duplicate slug -> 409
  {
    const r = await call(handlers.createPost, makeReq({ body: {
      title: "testpost_dup",
      slug: "testpost-one",
      contentMarkdown: "# Dup",
    }}));
    check("createPost duplicate slug -> 409", r.statusCode === 409, `body=${JSON.stringify(r.body)}`);
  }

  // ---------- listPosts ----------
  {
    const r = await call(handlers.listPosts, makeReq({ query: { page: "1", pageSize: "10" } }));
    check("listPosts -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("listPosts has items array", d && Array.isArray(d.items));
    check("listPosts has total/page/pageSize", d && typeof d.total === "number" && d.page === 1 && d.pageSize === 10);
    const found = d && d.items.find((p) => p.id === createdId);
    check("listPosts contains created post", !!found);
    check("listPosts items have tags+categories", found && Array.isArray(found.tags) && Array.isArray(found.categories));
  }

  // keyword filter
  {
    const r = await call(handlers.listPosts, makeReq({ query: { keyword: "testpost_1" } }));
    const d = r.body && r.body.data;
    check("listPosts keyword filter works", d && d.items.length >= 1 && d.items.some((p) => p.id === createdId));
  }

  // status filter
  {
    const r = await call(handlers.listPosts, makeReq({ query: { status: "published" } }));
    const d = r.body && r.body.data;
    check("listPosts status filter -> only published", d && d.items.every((p) => p.status === "published"));
  }

  // ---------- getPost ----------
  {
    const r = await call(handlers.getPost, makeReq({ params: { id: String(createdId) } }));
    check("getPost -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("getPost has contentMarkdown", d && typeof d.contentMarkdown === "string");
    check("getPost has tags+categories", d && Array.isArray(d.tags) && Array.isArray(d.categories));
  }
  {
    const r = await call(handlers.getPost, makeReq({ params: { id: "0" } }));
    check("getPost invalid id -> 400", r.statusCode === 400);
  }
  {
    const r = await call(handlers.getPost, makeReq({ params: { id: "999999" } }));
    check("getPost nonexistent -> 404", r.statusCode === 404);
  }

  // ---------- updatePost ----------
  {
    const r = await call(handlers.updatePost, makeReq({
      params: { id: String(createdId) },
      body: { title: "testpost_1_updated", excerpt: "new excerpt", tags: "testtag-c" },
    }));
    check("updatePost -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("updatePost title changed", d && d.title === "testpost_1_updated");
    check("updatePost excerpt changed", d && d.excerpt === "new excerpt");
    check("updatePost tags reset to single", d && d.tags.length === 1);
  }
  {
    const r = await call(handlers.updatePost, makeReq({
      params: { id: String(createdId) },
      body: { slug: "testpost-two" }, // collide with existing
    }));
    check("updatePost duplicate slug -> 409", r.statusCode === 409);
  }
  {
    const r = await call(handlers.updatePost, makeReq({ params: { id: "999999" }, body: { title: "x" } }));
    check("updatePost nonexistent -> 404", r.statusCode === 404);
  }

  // ---------- deletePost ----------
  // create a third to delete
  let toDelId = 0;
  {
    const r = await call(handlers.createPost, makeReq({ body: {
      title: "testpost_3", slug: "testpost-three", contentMarkdown: "# T3",
    }}));
    toDelId = r.body && r.body.data ? r.body.data.id : 0;
  }
  {
    const r = await call(handlers.deletePost, makeReq({ params: { id: String(toDelId) } }));
    check("deletePost -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("deletePost returns deleted=true", d && d.deleted === true);
  }
  {
    const r = await call(handlers.deletePost, makeReq({ params: { id: "999999" } }));
    check("deletePost nonexistent -> 404", r.statusCode === 404);
  }

  // ---------- performance: list 1000 posts < 200ms ----------
  // seed 1000 testpost rows, then time a single listPosts call
  {
    const insertMany = db.prepare(`
      INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
      VALUES (@title, @slug, @excerpt, NULL, @contentMarkdown, NULL, 'published', @publishedAt, @createdAt, @updatedAt)
    `);
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        insertMany.run({
          title: `testpost_perf_${i}`,
          slug: `testpost-perf-${i}`,
          excerpt: `excerpt ${i}`,
          contentMarkdown: `# Post ${i}`,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    tx();

    const t0 = Date.now();
    const r = await call(handlers.listPosts, makeReq({ query: { page: "1", pageSize: "20" } }));
    const elapsed = Date.now() - t0;
    check(`listPosts 1000 rows < 200ms (got ${elapsed}ms)`, r.statusCode === 200 && elapsed < 200);

    // cleanup perf rows
    db.prepare("DELETE FROM posts WHERE slug LIKE 'testpost-perf-%'").run();
  }

  // cleanup
  cleanupTestPosts();

  console.log("");
  console.log(pass ? "PASS: CMS posts API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
