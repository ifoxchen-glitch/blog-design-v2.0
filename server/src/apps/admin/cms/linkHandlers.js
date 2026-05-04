const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");

const ALLOWED_ICON_SIZES = ["1x1", "2x1", "1x2", "2x2"];

// 同步自 frontApp.js: safeUrl(s, { allowDataImage })。
// - 允许相对路径 (以 "/" 起首) 或 http(s) URL
// - allowDataImage=true 时额外允许 data:image/{png,jpeg,jpg,gif,webp};...
// 不合法返回 null；空字符串返回 ""（即"未设置"）。
function safeUrl(s, { allowDataImage = false } = {}) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  if (v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
  if (allowDataImage && /^data:image\/(png|jpeg|jpg|gif|webp);/i.test(v)) return v;
  return null;
}

function pickLink(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    icon: row.icon || "",
    iconSize: row.iconSize,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function listLinks(req, res) {
  const db = openDb();
  const rows = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder, createdAt, updatedAt FROM external_links ORDER BY sortOrder ASC, id ASC`)
    .all();
  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items: rows.map(pickLink), total: rows.length },
  });
}

function createLink(req, res) {
  const db = openDb();
  const body = req.body || {};
  const title = String(body.title ?? "").trim() || "未命名";
  const url = safeUrl(body.url);
  if (url === null) return res.status(400).json({ code: 400, message: "invalid_url" });
  const iconRaw = String(body.icon ?? "").trim();
  const icon = iconRaw ? safeUrl(iconRaw, { allowDataImage: true }) : "";
  if (icon === null) return res.status(400).json({ code: 400, message: "invalid_icon" });
  const iconSize = ALLOWED_ICON_SIZES.includes(body.iconSize) ? body.iconSize : "1x1";
  // legacy 把 sortOrder 写死为 0；v2 修正：允许显式 sortOrder
  const sortOrder = toInt(body.sortOrder, 0);
  const now = nowIso();

  const info = db
    .prepare(`INSERT INTO external_links (title, url, icon, iconSize, sortOrder, createdAt, updatedAt) VALUES (@title, @url, @icon, @iconSize, @sortOrder, @now, @now)`)
    .run({ title, url, icon, iconSize, sortOrder, now });

  const row = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder, createdAt, updatedAt FROM external_links WHERE id = ?`)
    .get(info.lastInsertRowid);
  return res.status(201).json({ code: 201, message: "success", data: pickLink(row) });
}

function updateLink(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder FROM external_links WHERE id = ?`)
    .get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Link not found" });

  const body = req.body || {};
  const title = body.title !== undefined ? (String(body.title).trim() || "未命名") : existing.title;

  let url = existing.url;
  if (body.url !== undefined) {
    const checked = safeUrl(body.url);
    if (checked === null) return res.status(400).json({ code: 400, message: "invalid_url" });
    url = checked;
  }

  let icon = existing.icon || "";
  if (body.icon !== undefined) {
    const iconRaw = String(body.icon).trim();
    if (iconRaw) {
      const checked = safeUrl(iconRaw, { allowDataImage: true });
      if (checked === null) return res.status(400).json({ code: 400, message: "invalid_icon" });
      icon = checked;
    } else {
      icon = "";
    }
  }

  const iconSize = body.iconSize !== undefined && ALLOWED_ICON_SIZES.includes(body.iconSize)
    ? body.iconSize
    : existing.iconSize;
  const sortOrder = body.sortOrder !== undefined ? toInt(body.sortOrder, existing.sortOrder) : existing.sortOrder;
  const now = nowIso();

  db.prepare(`UPDATE external_links SET title=@title, url=@url, icon=@icon, iconSize=@iconSize, sortOrder=@sortOrder, updatedAt=@now WHERE id=@id`)
    .run({ id, title, url, icon, iconSize, sortOrder, now });

  const row = db
    .prepare(`SELECT id, title, url, icon, iconSize, sortOrder, createdAt, updatedAt FROM external_links WHERE id = ?`)
    .get(id);
  return res.status(200).json({ code: 200, message: "success", data: pickLink(row) });
}

function deleteLink(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare(`DELETE FROM external_links WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Link not found" });
  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function reorderLinks(req, res) {
  const db = openDb();
  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: "items must be a non-empty array" });
  }

  const stmt = db.prepare(`UPDATE external_links SET sortOrder = ?, updatedAt = ? WHERE id = ?`);
  const now = nowIso();

  const tx = db.transaction(() => {
    for (const it of items) {
      const lid = toInt(it.id, 0);
      if (!lid) continue;
      const sortOrder = toInt(it.sortOrder, 0);
      stmt.run(sortOrder, now, lid);
    }
  });
  tx();

  return res.status(200).json({ code: 200, message: "success", data: { reordered: items.length } });
}

// TODO(T2.12): icon 支持 data:image/...;长度限制？legacy 没有，先放过。
// TODO(T2.12): legacy POST 把 sortOrder 写死 0 是个 bug；v2 已修正（POST 接收 sortOrder，默认 0），保持兼容。
// TODO(T2.12): reorder 仅写本次 items 列出的 id；未列出的 id 保持原 sortOrder（与 menuHandlers.reorderMenus 同策略）。

module.exports = {
  listLinks,
  createLink,
  updateLink,
  deleteLink,
  reorderLinks,
  // 暴露给单测/将来的 utils 抽取
  _safeUrl: safeUrl,
};
