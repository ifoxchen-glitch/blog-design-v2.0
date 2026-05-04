// One-off helper: verify CMS tags API handlers
// Usage (from server/): node scripts/check-cms-tags-api.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-tags-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/cms/tagHandlers");

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

function cleanupTestTags() {
  // Tag rows created by test
  const ids = db
    .prepare("SELECT id FROM tags WHERE slug LIKE 'testtag-%' OR name LIKE 'testtag_%'")
    .all()
    .map((r) => r.id);
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM post_tags WHERE tagId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM tags WHERE id IN (${ph})`).run(...ids);
  }
  // Test posts created via direct insert
  const postIds = db
    .prepare("SELECT id FROM posts WHERE slug LIKE 'testtag-postref-%'")
    .all()
    .map((r) => r.id);
  if (postIds.length) {
    const ph = postIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM post_tags WHERE postId IN (${ph})`).run(...postIds);
    db.prepare(`DELETE FROM posts WHERE id IN (${ph})`).run(...postIds);
  }
}

(async () => {
  cleanupTestTags();

  // ---------- check that tag:* perms are seeded ----------
  {
    const codes = ["tag:list", "tag:create", "tag:update", "tag:delete"];
    for (const c of codes) {
      const row = db.prepare("SELECT id FROM permissions WHERE code = ?").get(c);
      check(`permission ${c} seeded`, !!row);
    }
    // content_admin should have tag:* now
    const contentRoleId = db.prepare("SELECT id FROM roles WHERE code='content_admin'").get();
    const tagListPerm = db.prepare("SELECT id FROM permissions WHERE code='tag:list'").get();
    if (contentRoleId && tagListPerm) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRoleId.id, tagListPerm.id);
      check("content_admin role has tag:list bound", !!rp);
    }
  }

  let createdId = 0;
  // ---------- createTag ----------
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "testtag_alpha", slug: "testtag-alpha" } }));
    check("createTag -> 201", r.statusCode === 201);
    const d = r.body && r.body.data;
    check("createTag returns id/name/slug", d && d.id > 0 && d.name === "testtag_alpha" && d.slug === "testtag-alpha");
    check("createTag postCount=0", d && d.postCount === 0);
    createdId = d ? d.id : 0;
  }

  // slug auto-derived from name when omitted
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "testtag_beta" } }));
    const d = r.body && r.body.data;
    // slugify(strict:true) strips underscore -> "testtagbeta"; just verify non-empty + lowercase
    check("createTag auto-slug from name", d && typeof d.slug === "string" && d.slug.length > 0 && d.slug === d.slug.toLowerCase());
  }

  // empty name -> 400
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "" } }));
    check("createTag empty name -> 400", r.statusCode === 400);
  }

  // duplicate slug -> 409
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "testtag_dup", slug: "testtag-alpha" } }));
    check("createTag duplicate slug -> 409", r.statusCode === 409, `body=${JSON.stringify(r.body)}`);
  }

  // duplicate name -> 409
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "testtag_alpha", slug: "testtag-other" } }));
    check("createTag duplicate name -> 409", r.statusCode === 409);
  }

  // ---------- listTags ----------
  {
    const r = await call(handlers.listTags, makeReq({}));
    check("listTags -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("listTags has items array", d && Array.isArray(d.items));
    check("listTags has total", d && typeof d.total === "number" && d.total >= 2);
    const found = d && d.items.find((t) => t.id === createdId);
    check("listTags contains created tag", !!found);
    check("listTags items have postCount", found && typeof found.postCount === "number");
  }

  // ---------- listTags with postCount > 0 ----------
  {
    // create a post and link to createdId
    const now = new Date().toISOString();
    const postInfo = db
      .prepare(`
        INSERT INTO posts (title, slug, contentMarkdown, status, publishedAt, createdAt, updatedAt)
        VALUES ('testtag_postref_1', 'testtag-postref-1', '# x', 'published', ?, ?, ?)
      `)
      .run(now, now, now);
    db.prepare(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`).run(postInfo.lastInsertRowid, createdId);

    const r = await call(handlers.listTags, makeReq({}));
    const d = r.body && r.body.data;
    const target = d && d.items.find((t) => t.id === createdId);
    check("listTags postCount reflects post_tags links", target && target.postCount === 1);
  }

  // ---------- updateTag ----------
  {
    const r = await call(handlers.updateTag, makeReq({
      params: { id: String(createdId) },
      body: { name: "testtag_alpha_renamed", slug: "testtag-alpha-renamed" },
    }));
    check("updateTag -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("updateTag name changed", d && d.name === "testtag_alpha_renamed");
    check("updateTag slug changed", d && d.slug === "testtag-alpha-renamed");
    check("updateTag postCount preserved", d && d.postCount === 1);
  }

  // partial update: only slug
  {
    const r = await call(handlers.updateTag, makeReq({
      params: { id: String(createdId) },
      body: { slug: "testtag-alpha-newslug" },
    }));
    const d = r.body && r.body.data;
    check("updateTag partial (slug only)", d && d.slug === "testtag-alpha-newslug" && d.name === "testtag_alpha_renamed");
  }

  // duplicate slug on update -> 409
  {
    // beta tag's slug
    const beta = db.prepare("SELECT slug FROM tags WHERE name='testtag_beta'").get();
    const r = await call(handlers.updateTag, makeReq({
      params: { id: String(createdId) },
      body: { slug: beta.slug },
    }));
    check("updateTag duplicate slug -> 409", r.statusCode === 409);
  }

  // nonexistent -> 404
  {
    const r = await call(handlers.updateTag, makeReq({ params: { id: "999999" }, body: { name: "x" } }));
    check("updateTag nonexistent -> 404", r.statusCode === 404);
  }

  // invalid id -> 400
  {
    const r = await call(handlers.updateTag, makeReq({ params: { id: "0" }, body: { name: "x" } }));
    check("updateTag invalid id -> 400", r.statusCode === 400);
  }

  // ---------- deleteTag ----------
  // create a third tag explicitly to delete
  let toDelId = 0;
  {
    const r = await call(handlers.createTag, makeReq({ body: { name: "testtag_todelete", slug: "testtag-todelete" } }));
    toDelId = r.body && r.body.data ? r.body.data.id : 0;
    // attach to a fresh post to verify FK cascade
    const now = new Date().toISOString();
    const postInfo = db
      .prepare(`
        INSERT INTO posts (title, slug, contentMarkdown, status, createdAt, updatedAt)
        VALUES ('testtag_postref_2', 'testtag-postref-2', '# x', 'draft', ?, ?)
      `)
      .run(now, now);
    db.prepare(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`).run(postInfo.lastInsertRowid, toDelId);
    const linkBefore = db.prepare("SELECT COUNT(*) AS c FROM post_tags WHERE tagId=?").get(toDelId).c;
    check("deleteTag pre-check: 1 post_tag link", linkBefore === 1);
  }
  {
    const r = await call(handlers.deleteTag, makeReq({ params: { id: String(toDelId) } }));
    check("deleteTag -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("deleteTag returns deleted=true", d && d.deleted === true);
    // FK cascade: post_tags rows should be gone
    const linkAfter = db.prepare("SELECT COUNT(*) AS c FROM post_tags WHERE tagId=?").get(toDelId).c;
    check("deleteTag FK cascade clears post_tags", linkAfter === 0);
  }
  {
    const r = await call(handlers.deleteTag, makeReq({ params: { id: "999999" } }));
    check("deleteTag nonexistent -> 404", r.statusCode === 404);
  }
  {
    const r = await call(handlers.deleteTag, makeReq({ params: { id: "0" } }));
    check("deleteTag invalid id -> 400", r.statusCode === 400);
  }

  cleanupTestTags();

  console.log("");
  console.log(pass ? "PASS: CMS tags API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
