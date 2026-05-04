// One-off helper: verify CMS links API handlers (incl. reorder)
// Usage (from server/): node scripts/check-cms-links-api.js
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-links-check-do-not-use-in-prod";
}

const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const handlers = require("../src/apps/admin/cms/linkHandlers");

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

function cleanupTestLinks() {
  db.prepare("DELETE FROM external_links WHERE title LIKE 'testlink_%' OR url LIKE 'https://testlink.example.%'").run();
}

(async () => {
  cleanupTestLinks();

  // ---------- check that link:* perms are seeded ----------
  {
    const codes = ["link:list", "link:create", "link:update", "link:delete"];
    for (const c of codes) {
      const row = db.prepare("SELECT id FROM permissions WHERE code = ?").get(c);
      check(`permission ${c} seeded`, !!row);
    }
    const contentRoleId = db.prepare("SELECT id FROM roles WHERE code='content_admin'").get();
    const lp = db.prepare("SELECT id FROM permissions WHERE code='link:list'").get();
    if (contentRoleId && lp) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRoleId.id, lp.id);
      check("content_admin role has link:list bound", !!rp);
    }
  }

  // ---------- safeUrl unit tests ----------
  {
    check("safeUrl '' returns ''", handlers._safeUrl("") === "");
    check("safeUrl absolute http", handlers._safeUrl("http://example.com") === "http://example.com");
    check("safeUrl absolute https", handlers._safeUrl("https://example.com") === "https://example.com");
    check("safeUrl relative path", handlers._safeUrl("/foo") === "/foo");
    check("safeUrl javascript:: -> null", handlers._safeUrl("javascript:alert(1)") === null);
    check("safeUrl data:image rejected by default", handlers._safeUrl("data:image/png;base64,abc") === null);
    check("safeUrl data:image allowed when allowDataImage", handlers._safeUrl("data:image/png;base64,abc", { allowDataImage: true }) === "data:image/png;base64,abc");
  }

  // ---------- createLink ----------
  let id1 = 0, id2 = 0, id3 = 0;
  {
    const r = await call(handlers.createLink, makeReq({ body: {
      title: "testlink_alpha",
      url: "https://testlink.example.com/alpha",
      icon: "/img/alpha.png",
      iconSize: "2x1",
      sortOrder: 5,
    }}));
    check("createLink -> 201", r.statusCode === 201);
    const d = r.body && r.body.data;
    check("createLink returns id", d && d.id > 0);
    check("createLink iconSize=2x1", d && d.iconSize === "2x1");
    check("createLink sortOrder=5 (v2 fix vs legacy hardcode 0)", d && d.sortOrder === 5);
    id1 = d ? d.id : 0;
  }
  {
    const r = await call(handlers.createLink, makeReq({ body: {
      title: "testlink_beta", url: "https://testlink.example.com/beta",
    }}));
    const d = r.body && r.body.data;
    check("createLink default iconSize=1x1", d && d.iconSize === "1x1");
    check("createLink default sortOrder=0", d && d.sortOrder === 0);
    id2 = d ? d.id : 0;
  }
  {
    // bad iconSize falls back to 1x1
    const r = await call(handlers.createLink, makeReq({ body: {
      title: "testlink_gamma", url: "https://testlink.example.com/gamma",
      iconSize: "9x9",
    }}));
    const d = r.body && r.body.data;
    check("createLink bad iconSize -> 1x1", d && d.iconSize === "1x1");
    id3 = d ? d.id : 0;
  }
  {
    // missing/empty title -> default "未命名"
    const r = await call(handlers.createLink, makeReq({ body: { url: "https://testlink.example.com/noname" } }));
    const d = r.body && r.body.data;
    check("createLink empty title -> default '未命名'", d && d.title === "未命名");
  }
  {
    // bad url -> 400
    const r = await call(handlers.createLink, makeReq({ body: { title: "testlink_bad", url: "javascript:alert(1)" } }));
    check("createLink invalid_url -> 400", r.statusCode === 400);
  }
  {
    // bad icon (non data:image, non absolute) -> 400
    const r = await call(handlers.createLink, makeReq({ body: {
      title: "testlink_badicon", url: "https://testlink.example.com/x", icon: "ftp://bad/icon.png",
    }}));
    check("createLink invalid_icon -> 400", r.statusCode === 400);
  }
  {
    // data:image icon allowed
    const r = await call(handlers.createLink, makeReq({ body: {
      title: "testlink_dataimg", url: "https://testlink.example.com/dataimg",
      icon: "data:image/png;base64,iVBORw0KGgo=",
    }}));
    const d = r.body && r.body.data;
    check("createLink data:image icon allowed", r.statusCode === 201 && d && d.icon.startsWith("data:image/png"));
  }

  // ---------- listLinks ----------
  {
    const r = await call(handlers.listLinks, makeReq({}));
    check("listLinks -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("listLinks has items array", d && Array.isArray(d.items));
    const idsSeen = d ? d.items.map((x) => x.id) : [];
    check("listLinks contains created links", idsSeen.includes(id1) && idsSeen.includes(id2));
    // ordering: ascending sortOrder
    const indices = [id3, id2, id1].map((id) => idsSeen.indexOf(id));
    check("listLinks ordered by sortOrder ASC", indices[0] !== -1 && indices[0] <= indices[2], `indices=${JSON.stringify(indices)}`);
  }

  // ---------- updateLink ----------
  {
    const r = await call(handlers.updateLink, makeReq({
      params: { id: String(id1) },
      body: { title: "testlink_alpha_updated", iconSize: "2x2" },
    }));
    check("updateLink -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("updateLink title changed", d && d.title === "testlink_alpha_updated");
    check("updateLink iconSize changed to 2x2", d && d.iconSize === "2x2");
    check("updateLink url preserved", d && d.url === "https://testlink.example.com/alpha");
  }
  {
    // partial: clear icon by sending empty string
    const r = await call(handlers.updateLink, makeReq({ params: { id: String(id1) }, body: { icon: "" } }));
    const d = r.body && r.body.data;
    check("updateLink icon cleared via empty string", d && d.icon === "");
  }
  {
    const r = await call(handlers.updateLink, makeReq({ params: { id: String(id1) }, body: { url: "javascript:bad" } }));
    check("updateLink invalid_url -> 400", r.statusCode === 400);
  }
  {
    const r = await call(handlers.updateLink, makeReq({ params: { id: "999999" }, body: { title: "x" } }));
    check("updateLink nonexistent -> 404", r.statusCode === 404);
  }
  {
    const r = await call(handlers.updateLink, makeReq({ params: { id: "0" }, body: { title: "x" } }));
    check("updateLink invalid id -> 400", r.statusCode === 400);
  }

  // ---------- reorderLinks ----------
  // current sortOrder: id1=5, id2=0, id3=0; flip to id1=1, id2=2, id3=3
  {
    const r = await call(handlers.reorderLinks, makeReq({ body: {
      items: [
        { id: id1, sortOrder: 1 },
        { id: id2, sortOrder: 2 },
        { id: id3, sortOrder: 3 },
      ],
    }}));
    check("reorderLinks -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("reorderLinks returns reordered count", d && d.reordered === 3);

    // verify DB state
    const a = db.prepare("SELECT sortOrder FROM external_links WHERE id=?").get(id1);
    const b = db.prepare("SELECT sortOrder FROM external_links WHERE id=?").get(id2);
    const c = db.prepare("SELECT sortOrder FROM external_links WHERE id=?").get(id3);
    check("reorderLinks DB id1.sortOrder=1", a && a.sortOrder === 1);
    check("reorderLinks DB id2.sortOrder=2", b && b.sortOrder === 2);
    check("reorderLinks DB id3.sortOrder=3", c && c.sortOrder === 3);
  }
  {
    const r = await call(handlers.reorderLinks, makeReq({ body: {} }));
    check("reorderLinks empty body -> 400", r.statusCode === 400);
  }
  {
    const r = await call(handlers.reorderLinks, makeReq({ body: { items: [] } }));
    check("reorderLinks empty array -> 400", r.statusCode === 400);
  }

  // ---------- deleteLink ----------
  {
    const r = await call(handlers.deleteLink, makeReq({ params: { id: String(id3) } }));
    check("deleteLink -> 200", r.statusCode === 200);
    const d = r.body && r.body.data;
    check("deleteLink returns deleted=true", d && d.deleted === true);
    const row = db.prepare("SELECT id FROM external_links WHERE id=?").get(id3);
    check("deleteLink row gone", !row);
  }
  {
    const r = await call(handlers.deleteLink, makeReq({ params: { id: "999999" } }));
    check("deleteLink nonexistent -> 404", r.statusCode === 404);
  }

  cleanupTestLinks();

  console.log("");
  console.log(pass ? "PASS: CMS links API verified." : "FAIL: see [FAIL] entries above.");
  process.exit(pass ? 0 : 1);
})();
