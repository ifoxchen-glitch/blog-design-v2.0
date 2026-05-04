// One-off helper: verify CMS categories API handlers
// Usage (from server/): node scripts/check-cms-categories-api.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-categories-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/cms/categoryHandlers");

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

function cleanupTestCategories() {
  const ids = db
    .prepare("SELECT id FROM categories WHERE slug LIKE 'testcat-%' OR name LIKE 'testcat_%'")
    .all()
    .map((r) => r.id);
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM post_categories WHERE categoryId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM categories WHERE id IN (${ph})`).run(...ids);
  }
  const postIds = db
    .prepare("SELECT id FROM posts WHERE slug LIKE 'testcat-postref-%'")
    .all()
    .map((r) => r.id);
  if (postIds.length) {
    const ph = postIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM post_categories WHERE postId IN (${ph})`).run(...postIds);
    db.prepare(`DELETE FROM posts WHERE id IN (${ph})`).run(...postIds);
  }
}

(async () => {
  cleanupTestCategories();

  // ---------- check that category:* perms are seeded ----------
  {
    const codes = ["category:list", "category:create", "category:update", "category:delete"];
    for (const c of codes) {
      const row = db.prepare("SELECT id FROM permissions WHERE code = ?").get(c);
      check(`permission ${c} seeded`, !!row);
    }
    const contentRoleId = db.prepare("SELECT id FROM roles WHERE code='content_admin'").get();
    const catListPerm = db.prepare("SELECT id FROM permissions WHERE code='category:list'").get();
    if (contentRoleId && catListPerm) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRoleId.id, catListPerm.id);
      check("content_admin role has category:list bound", !!rp);
    }
  }

  let createdId = 0;
  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "testcat_alpha", slug: "testcat-alpha" } }));
    check("createCategory -> 201", r.statusCode === 201);
    const d = r.body && r.body.data;
    check("createCategory returns id/name/slug", d && d.id > 0 && d.name === "testcat_alpha" && d.slug === "testcat-alpha");
    check("createCategory postCount=0", d && d.postCount === 0);
    createdId = d ? d.id : 0;
  }

  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "testcat_beta" } }));
    const d = r.body && r.body.data;
    check("createCategory auto-slug from name", d && typeof d.slug === "string" && d.slug.length > 0 && d.slug === d.slug.toLowerCase());
  }

  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "" } }));
    check("createCategory empty name -> 400", r.statusCode === 400);
  }

  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "testcat_dup", slug: "testcat-alpha" } }));
    check("createCategory duplicate slug -> 409", r.statusCode === 409, `body=${JSON.stringify(r.body)}`);
  }

  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "testcat_alpha", slug: "testcat-other" } }));
    check("createCategory duplicate name -> 409", r.statusCode === 409);
  }

  // ---------- listCategories ----------
  {
    const r = await call(handlers.listCategories, makeReq({}));
    check("listCategories -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("listCategories has items array", d && Array.isArray(d.items));
    check("listCategories has total", d && typeof d.total === "number" && d.total >= 2);
    const found = d && d.items.find((c) => c.id === createdId);
    check("listCategories contains created cat", !!found);
    check("listCategories items have postCount", found && typeof found.postCount === "number");
  }

  // ---------- listCategories with postCount > 0 ----------
  {
    const now = new Date().toISOString();
    const postInfo = db
      .prepare(`
        INSERT INTO posts (title, slug, contentMarkdown, status, publishedAt, createdAt, updatedAt)
        VALUES ('testcat_postref_1', 'testcat-postref-1', '# x', 'published', ?, ?, ?)
      `)
      .run(now, now, now);
    db.prepare(`INSERT INTO post_categories (postId, categoryId) VALUES (?, ?)`).run(postInfo.lastInsertRowid, createdId);
    const r = await call(handlers.listCategories, makeReq({}));
    const d = r.body && r.body.data;
    const target = d && d.items.find((c) => c.id === createdId);
    check("listCategories postCount reflects post_categories links", target && target.postCount === 1);
  }

  // ---------- updateCategory ----------
  {
    const r = await call(handlers.updateCategory, makeReq({
      params: { id: String(createdId) },
      body: { name: "testcat_alpha_renamed", slug: "testcat-alpha-renamed" },
    }));
    check("updateCategory -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("updateCategory name changed", d && d.name === "testcat_alpha_renamed");
    check("updateCategory slug changed", d && d.slug === "testcat-alpha-renamed");
    check("updateCategory postCount preserved", d && d.postCount === 1);
  }

  {
    const r = await call(handlers.updateCategory, makeReq({
      params: { id: String(createdId) },
      body: { slug: "testcat-alpha-newslug" },
    }));
    const d = r.body && r.body.data;
    check("updateCategory partial (slug only)", d && d.slug === "testcat-alpha-newslug" && d.name === "testcat_alpha_renamed");
  }

  {
    const beta = db.prepare("SELECT slug FROM categories WHERE name='testcat_beta'").get();
    const r = await call(handlers.updateCategory, makeReq({
      params: { id: String(createdId) },
      body: { slug: beta.slug },
    }));
    check("updateCategory duplicate slug -> 409", r.statusCode === 409);
  }

  {
    const r = await call(handlers.updateCategory, makeReq({ params: { id: "999999" }, body: { name: "x" } }));
    check("updateCategory nonexistent -> 404", r.statusCode === 404);
  }
  {
    const r = await call(handlers.updateCategory, makeReq({ params: { id: "0" }, body: { name: "x" } }));
    check("updateCategory invalid id -> 400", r.statusCode === 400);
  }

  // ---------- deleteCategory ----------
  let toDelId = 0;
  {
    const r = await call(handlers.createCategory, makeReq({ body: { name: "testcat_todelete", slug: "testcat-todelete" } }));
    toDelId = r.body && r.body.data ? r.body.data.id : 0;
    const now = new Date().toISOString();
    const postInfo = db
      .prepare(`
        INSERT INTO posts (title, slug, contentMarkdown, status, createdAt, updatedAt)
        VALUES ('testcat_postref_2', 'testcat-postref-2', '# x', 'draft', ?, ?)
      `)
      .run(now, now);
    db.prepare(`INSERT INTO post_categories (postId, categoryId) VALUES (?, ?)`).run(postInfo.lastInsertRowid, toDelId);
    const linkBefore = db.prepare("SELECT COUNT(*) AS c FROM post_categories WHERE categoryId=?").get(toDelId).c;
    check("deleteCategory pre-check: 1 post_categories link", linkBefore === 1);
  }
  {
    const r = await call(handlers.deleteCategory, makeReq({ params: { id: String(toDelId) } }));
    check("deleteCategory -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("deleteCategory returns deleted=true", d && d.deleted === true);
    const linkAfter = db.prepare("SELECT COUNT(*) AS c FROM post_categories WHERE categoryId=?").get(toDelId).c;
    check("deleteCategory FK cascade clears post_categories", linkAfter === 0);
  }
  {
    const r = await call(handlers.deleteCategory, makeReq({ params: { id: "999999" } }));
    check("deleteCategory nonexistent -> 404", r.statusCode === 404);
  }
  {
    const r = await call(handlers.deleteCategory, makeReq({ params: { id: "0" } }));
    check("deleteCategory invalid id -> 400", r.statusCode === 400);
  }

  cleanupTestCategories();

  console.log("");
  console.log(pass ? "PASS: CMS categories API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
