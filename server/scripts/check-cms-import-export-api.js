// One-off helper: verify CMS import/export API handlers
// Usage (from server/): node scripts/check-cms-import-export-api.js
//
// 注意:这个脚本会触发 importData 整库覆盖。我们先用 exportData 拿到全库快照,
// 测完后再 import 一次同份快照来恢复,所以即便中途断言失败也能保留原始数据。
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-import-export-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/cms/cmsHandlers");

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

function tableCount(name) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;
}

(async () => {
  // ---------- check that cms:* perms are seeded with super_admin only ----------
  {
    const exp = db.prepare("SELECT id FROM permissions WHERE code='cms:export'").get();
    const imp = db.prepare("SELECT id FROM permissions WHERE code='cms:import'").get();
    check("permission cms:export seeded", !!exp);
    check("permission cms:import seeded", !!imp);

    // content_admin should NOT have cms:* perms
    const contentRole = db.prepare("SELECT id FROM roles WHERE code='content_admin'").get();
    if (contentRole && exp) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRole.id, exp.id);
      check("content_admin role does NOT have cms:export bound", !rp);
    }
    if (contentRole && imp) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRole.id, imp.id);
      check("content_admin role does NOT have cms:import bound", !rp);
    }
    // super_admin should have them via the "*" role-permissions binding
    const superRole = db.prepare("SELECT id FROM roles WHERE code='super_admin'").get();
    if (superRole && exp) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(superRole.id, exp.id);
      check("super_admin role has cms:export bound", !!rp);
    }
    if (superRole && imp) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(superRole.id, imp.id);
      check("super_admin role has cms:import bound", !!rp);
    }
  }

  // ---------- snapshot current DB ----------
  const snapshotResp = await call(handlers.exportData, makeReq({}));
  check("exportData -> 200", snapshotResp.statusCode === 200);
  const snapshot = snapshotResp.body && snapshotResp.body.data;
  check("exportData has version=2", snapshot && snapshot.version === 2);
  check("exportData has exportedAt iso string",
    snapshot && typeof snapshot.exportedAt === "string" && snapshot.exportedAt.length > 0);
  check("exportData has 6 collections (links,posts,tags,postTags,categories,postCategories)",
    snapshot &&
      Array.isArray(snapshot.links) &&
      Array.isArray(snapshot.posts) &&
      Array.isArray(snapshot.tags) &&
      Array.isArray(snapshot.postTags) &&
      Array.isArray(snapshot.categories) &&
      Array.isArray(snapshot.postCategories));

  const baseline = {
    posts: tableCount("posts"),
    tags: tableCount("tags"),
    postTags: tableCount("post_tags"),
    categories: tableCount("categories"),
    postCategories: tableCount("post_categories"),
    links: tableCount("external_links"),
  };
  check("exportData posts count matches DB",
    snapshot && snapshot.posts.length === baseline.posts);
  check("exportData tags count matches DB",
    snapshot && snapshot.tags.length === baseline.tags);
  check("exportData links count matches DB",
    snapshot && snapshot.links.length === baseline.links);

  // ---------- importData: invalid version ----------
  {
    const r = await call(handlers.importData, makeReq({ body: { version: 1, posts: [] } }));
    check("importData v1 rejected -> 400", r.statusCode === 400);
  }

  // ---------- importData: missing version -> 400 ----------
  {
    const r = await call(handlers.importData, makeReq({ body: { posts: [] } }));
    check("importData missing version -> 400", r.statusCode === 400);
  }

  // ---------- importData: posts not array -> 400 ----------
  {
    const r = await call(handlers.importData, makeReq({
      body: { version: 2, posts: "this should be array" },
    }));
    check("importData posts must be array -> 400",
      r.statusCode === 400 && r.body && /posts/.test(r.body.message || ""),
      `body=${JSON.stringify(r.body)}`);
  }

  // ---------- importData: snapshot round-trip (raw shape) ----------
  {
    const r = await call(handlers.importData, makeReq({ body: snapshot }));
    check("importData snapshot raw shape -> 200", r.statusCode === 200, `body=${JSON.stringify(r.body)}`);
    const counts = r.body && r.body.data && r.body.data.imported;
    check("importData reports counts.posts == baseline.posts",
      counts && counts.posts === baseline.posts);
    check("importData reports counts.tags == baseline.tags",
      counts && counts.tags === baseline.tags);
    check("importData reports counts.links == baseline.links",
      counts && counts.links === baseline.links);
    // DB state preserved
    check("after import: posts count restored", tableCount("posts") === baseline.posts);
    check("after import: tags count restored", tableCount("tags") === baseline.tags);
    check("after import: post_tags count restored", tableCount("post_tags") === baseline.postTags);
    check("after import: categories count restored", tableCount("categories") === baseline.categories);
    check("after import: post_categories count restored",
      tableCount("post_categories") === baseline.postCategories);
    check("after import: external_links count restored", tableCount("external_links") === baseline.links);
  }

  // ---------- importData: envelope wrapper { data: {...} } ----------
  {
    const r = await call(handlers.importData, makeReq({ body: { data: snapshot } }));
    check("importData envelope-wrapped shape -> 200", r.statusCode === 200);
  }

  // ---------- importData: empty arrays (clear all then re-import) ----------
  {
    const empty = {
      version: 2,
      links: [],
      posts: [],
      tags: [],
      postTags: [],
      categories: [],
      postCategories: [],
    };
    const r1 = await call(handlers.importData, makeReq({ body: empty }));
    check("importData empty payload -> 200 (clears tables)", r1.statusCode === 200);
    check("after empty import: posts cleared", tableCount("posts") === 0);
    check("after empty import: tags cleared", tableCount("tags") === 0);
    check("after empty import: links cleared", tableCount("external_links") === 0);

    // restore from snapshot
    const r2 = await call(handlers.importData, makeReq({ body: snapshot }));
    check("importData restore-from-snapshot after clear -> 200", r2.statusCode === 200);
    check("after restore: posts count",
      tableCount("posts") === baseline.posts,
      `expected ${baseline.posts}, got ${tableCount("posts")}`);
    check("after restore: tags count",
      tableCount("tags") === baseline.tags,
      `expected ${baseline.tags}, got ${tableCount("tags")}`);
    check("after restore: external_links count",
      tableCount("external_links") === baseline.links,
      `expected ${baseline.links}, got ${tableCount("external_links")}`);
  }

  // ---------- importData: partial payload (only posts field, others left alone) ----------
  // NOTE: handler 仅在字段是 array 时才 DELETE+INSERT。我们传只含 posts 的 payload,
  //       其他表应保持不变(但 posts 会重写)。
  {
    const tagsBefore = tableCount("tags");
    const linksBefore = tableCount("external_links");
    const r = await call(handlers.importData, makeReq({
      body: { version: 2, posts: snapshot.posts },
    }));
    check("importData partial payload (posts only) -> 200", r.statusCode === 200);
    check("after partial import: tags untouched", tableCount("tags") === tagsBefore);
    check("after partial import: external_links untouched", tableCount("external_links") === linksBefore);
    check("after partial import: posts restored", tableCount("posts") === baseline.posts);
  }

  // ---------- final restore (defense in depth) ----------
  {
    const r = await call(handlers.importData, makeReq({ body: snapshot }));
    check("final snapshot restore -> 200", r.statusCode === 200);
  }

  console.log("");
  console.log(pass ? "PASS: CMS import/export API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
