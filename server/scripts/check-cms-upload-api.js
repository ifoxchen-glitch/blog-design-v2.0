// One-off helper: verify CMS upload API (multer + RBAC)
// Usage (from server/): node scripts/check-cms-upload-api.js
//
// 与其他 cms verifier 不同：上传必须经过 multer 中间件 + 真实 multipart body，
// 无法用 stub req/res，所以这里跑一台临时 HTTP 服务（127.0.0.1:0），用 fetch+FormData
// 驱动。Node 18+ 自带 fetch / FormData / Blob，不需要 supertest 依赖。

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-jwt-for-cms-upload-check-do-not-use-in-prod";
}

const express = require("express");
const jwt = require("jsonwebtoken");
const { openDb, migrate, ensureSeed } = require("../src/db");
const { ensureRbacSeed } = require("../src/seeds/rbacSeed");
const mediaRouter = require("../src/apps/admin/cms/mediaRouter");

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

function ensureViewerUser() {
  const username = "upload_viewer";
  let row = db.prepare("SELECT id FROM users WHERE username=? LIMIT 1").get(username);
  if (!row) {
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, status, is_super_admin, created_at, updated_at)
         VALUES (?, ?, 'unused', 'active', 0, ?, ?)`,
      )
      .run(username, `${username}@example.com`, now, now);
    row = { id: info.lastInsertRowid };
  }
  // 仅绑定 viewer 角色（不含 media:upload）
  const viewerRole = db.prepare("SELECT id FROM roles WHERE code='viewer'").get();
  if (viewerRole) {
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").run(row.id, viewerRole.id);
    // 清掉 content_admin/super_admin 等其他角色（防止之前残留）
    db.prepare(
      `DELETE FROM user_roles
       WHERE user_id = ?
         AND role_id NOT IN (SELECT id FROM roles WHERE code='viewer')`,
    ).run(row.id);
  }
  return row.id;
}

const SUPER_ID = db.prepare("SELECT id FROM users WHERE is_super_admin=1 LIMIT 1").get().id;
const VIEWER_ID = ensureViewerUser();

function signToken(userId, isSuper) {
  return jwt.sign(
    {
      userId,
      username: `u${userId}`,
      roles: isSuper ? ["super_admin"] : ["viewer"],
      type: "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" },
  );
}

const SUPER_TOKEN = signToken(SUPER_ID, true);
const VIEWER_TOKEN = signToken(VIEWER_ID, false);

// ---- test fixtures ----
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function pngBytes(payloadLen = 100) {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(payloadLen)]);
}

function jpegBytes(payloadLen = 100) {
  return Buffer.concat([JPEG_HEADER, Buffer.alloc(payloadLen)]);
}

(async () => {
  // ---------- check that media:upload perm is seeded + bound to content_admin ----------
  {
    const row = db.prepare("SELECT id FROM permissions WHERE code = ?").get("media:upload");
    check("permission media:upload seeded", !!row);
    const contentRole = db.prepare("SELECT id FROM roles WHERE code='content_admin'").get();
    if (contentRole && row) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(contentRole.id, row.id);
      check("content_admin role has media:upload bound", !!rp);
    }
    const viewerRole = db.prepare("SELECT id FROM roles WHERE code='viewer'").get();
    if (viewerRole && row) {
      const rp = db
        .prepare("SELECT 1 FROM role_permissions WHERE role_id=? AND permission_id=?")
        .get(viewerRole.id, row.id);
      check("viewer role does NOT have media:upload bound", !rp);
    }
  }

  // ---------- multer config sanity ----------
  {
    const u = mediaRouter._uploader;
    check("multer instance exported", !!u);
    check(
      "UPLOAD_DIR is under server/public/uploads",
      mediaRouter._UPLOAD_DIR.endsWith(path.join("public", "uploads")),
    );
    check("UPLOAD_DIR exists on disk", fs.existsSync(mediaRouter._UPLOAD_DIR));
  }

  // ---------- start ephemeral HTTP server ----------
  const app = express();
  app.use("/api/v2/admin/cms", mediaRouter);
  // multer 出错（>5MB / busboy parse 错）会冒泡到 Express 默认 handler，
  // Express 5 默认是 500 + HTML body。这里包一个 JSON error handler，方便断言。
  app.use((err, req, res, _next) => {
    res.status(err && err.status ? err.status : 500).json({
      code: 500,
      message: err && err.code ? err.code : "server_error",
      detail: err && err.message,
    });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v2/admin/cms/upload`;

  async function postUpload({ token, fileBuffer, filename, fieldName = "image", mimeType }) {
    const form = new FormData();
    if (fileBuffer && filename) {
      const ext = path.extname(filename).toLowerCase();
      const inferredType =
        mimeType ||
        (ext === ".png" ? "image/png" :
         ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
         ext === ".gif" ? "image/gif" :
         ext === ".webp" ? "image/webp" :
         "application/octet-stream");
      form.append(fieldName, new Blob([fileBuffer], { type: inferredType }), filename);
    }
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(baseUrl, { method: "POST", headers, body: form });
    let body;
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await r.json();
    } else {
      body = await r.text();
    }
    return { status: r.status, body };
  }

  const createdFiles = [];

  // 1) no token → 401
  {
    const { status } = await postUpload({});
    check("no token → 401", status === 401, `got ${status}`);
  }

  // 2) viewer (no media:upload) → 403
  {
    const { status } = await postUpload({
      token: VIEWER_TOKEN,
      fileBuffer: pngBytes(64),
      filename: "test.png",
    });
    check("viewer token (no media:upload) → 403", status === 403, `got ${status}`);
  }

  // 3) super, no file → 400 invalid_file
  {
    const { status, body } = await postUpload({ token: SUPER_TOKEN });
    check(
      "no file → 400 invalid_file",
      status === 400 && body && body.message === "invalid_file",
      `got ${status} ${JSON.stringify(body)}`,
    );
  }

  // 4) super, valid PNG → 200
  {
    const { status, body } = await postUpload({
      token: SUPER_TOKEN,
      fileBuffer: pngBytes(128),
      filename: "smoke.png",
    });
    check(
      "PNG upload → 200",
      status === 200 && body && body.code === 200,
      `got ${status} ${JSON.stringify(body)}`,
    );
    if (body && body.data) {
      check(
        "response.data.url starts with /admin-static/uploads/",
        typeof body.data.url === "string" && body.data.url.startsWith("/admin-static/uploads/"),
      );
      check(
        "response.data.filename ends with .png",
        typeof body.data.filename === "string" && body.data.filename.endsWith(".png"),
      );
      check(
        "response.data.size > 0",
        typeof body.data.size === "number" && body.data.size > 0,
      );
      check(
        "response.data.mimeType is image/*",
        typeof body.data.mimeType === "string" && body.data.mimeType.startsWith("image/"),
      );
      if (body.data.filename) createdFiles.push(body.data.filename);
    }
  }

  // 5) super, valid JPEG → 200
  {
    const { status, body } = await postUpload({
      token: SUPER_TOKEN,
      fileBuffer: jpegBytes(128),
      filename: "smoke.jpg",
    });
    check(
      "JPEG upload → 200",
      status === 200 && body && body.code === 200,
      `got ${status} ${JSON.stringify(body)}`,
    );
    if (body && body.data && body.data.filename) createdFiles.push(body.data.filename);
  }

  // 6) super, disallowed extension (.txt) → multer fileFilter 拒收，handler 拿不到 req.file → 400 invalid_file
  {
    const { status, body } = await postUpload({
      token: SUPER_TOKEN,
      fileBuffer: Buffer.from("hello world"),
      filename: "note.txt",
    });
    check(
      ".txt rejected by ext whitelist → 400 invalid_file",
      status === 400 && body && body.message === "invalid_file",
      `got ${status} ${JSON.stringify(body)}`,
    );
  }

  // 7) super, oversize (>5MB) → 不应是 200（multer 会触发 LIMIT_FILE_SIZE）
  {
    const oversize = pngBytes(5 * 1024 * 1024 + 1024);
    const { status } = await postUpload({
      token: SUPER_TOKEN,
      fileBuffer: oversize,
      filename: "big.png",
    });
    check(
      "oversize file (>5MB) → not 200 (multer LIMIT_FILE_SIZE)",
      status !== 200,
      `got ${status}`,
    );
  }

  // ---------- cleanup uploaded fixture files ----------
  for (const f of createdFiles) {
    try {
      const p = path.join(mediaRouter._UPLOAD_DIR, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }

  // ---------- shutdown ----------
  await new Promise((resolve) => server.close(resolve));

  console.log(pass ? "\nPASS: cms upload API" : "\nFAIL: cms upload API");
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
