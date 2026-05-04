const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");

function buildTree(rows) {
  const byId = new Map();
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
  }
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (r.parent_id == null) {
      roots.push(node);
    } else {
      const parent = byId.get(r.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }
  // sort children recursively
  function sortChildren(nodes) {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const n of nodes) sortChildren(n.children);
  }
  sortChildren(roots);
  return roots;
}

function pickMenuPublic(r) {
  return {
    id: r.id,
    parentId: r.parent_id || null,
    name: r.name,
    path: r.path || null,
    icon: r.icon || null,
    permissionCode: r.permission_code || null,
    sortOrder: r.sort_order || 0,
    status: r.status,
    createdAt: r.created_at,
  };
}

function wouldFormCycle(db, currentId, targetParentId) {
  if (!targetParentId) return false;
  if (currentId === targetParentId) return true;
  let p = targetParentId;
  for (let i = 0; i < 20; i++) {
    const row = db.prepare("SELECT parent_id FROM menus WHERE id = ?").get(p);
    if (!row) return false;
    if (!row.parent_id) return false;
    if (row.parent_id === currentId) return true;
    p = row.parent_id;
  }
  return true; // safety
}

function listMenus(req, res) {
  const db = openDb();
  const rows = db
    .prepare(`
      SELECT id, parent_id, name, path, icon, permission_code, sort_order, status, created_at
        FROM menus
       ORDER BY sort_order, id
    `)
    .all();

  const tree = buildTree(rows.map((r) => pickMenuPublic(r)));
  return res.status(200).json({ code: 200, message: "success", data: { tree } });
}

function getMenu(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db
    .prepare(`
      SELECT id, parent_id, name, path, icon, permission_code, sort_order, status, created_at        FROM menus WHERE id = ?
    `)
    .get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Menu not found" });

  const children = db
    .prepare(`
      SELECT id, parent_id, name, path, icon, permission_code, sort_order, status, created_at        FROM menus WHERE parent_id = ? ORDER BY sort_order, id
    `)
    .all(id)
    .map((r) => pickMenuPublic(r));

  const menu = pickMenuPublic(row);
  menu.children = children;
  return res.status(200).json({ code: 200, message: "success", data: menu });
}

function createMenu(req, res) {
  const db = openDb();
  const {
    parent_id,
    name,
    path,
    icon,
    permission_code,
    sort_order,
    status,
  } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ code: 400, message: "name is required" });
  }

  const parentId = parent_id != null ? toInt(parent_id, null) : null;
  if (parentId != null) {
    const parent = db.prepare("SELECT id FROM menus WHERE id = ?").get(parentId);
    if (!parent) {
      return res.status(400).json({ code: 400, message: "Parent menu not found" });
    }
    if (wouldFormCycle(db, 0, parentId)) {
      return res.status(400).json({ code: 400, message: "parent_id forms a cycle" });
    }
  }

  const createdAt = nowIso();
  const info = db.prepare(`
    INSERT INTO menus (parent_id, name, path, icon, permission_code, sort_order, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parentId,
    name.trim(),
    path || null,
    icon || null,
    permission_code || null,
    sort_order != null ? toInt(sort_order, 0) : 0,
    status === "disabled" ? "disabled" : "active",
    createdAt
  );

  const row = db
    .prepare(`
      SELECT id, parent_id, name, path, icon, permission_code, sort_order, status, created_at        FROM menus WHERE id = ?
    `)
    .get(info.lastInsertRowid);

  return res.status(201).json({ code: 201, message: "success", data: pickMenuPublic(row) });
}

function updateMenu(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT id FROM menus WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Menu not found" });

  const {
    parent_id,
    name,
    path,
    icon,
    permission_code,
    sort_order,
    status,
  } = req.body || {};

  const sets = [];
  const params = [];

  if (parent_id !== undefined) {
    const parentId = parent_id != null ? toInt(parent_id, null) : null;
    if (parentId != null) {
      const parent = db.prepare("SELECT id FROM menus WHERE id = ?").get(parentId);
      if (!parent) {
        return res.status(400).json({ code: 400, message: "Parent menu not found" });
      }
      if (wouldFormCycle(db, id, parentId)) {
        return res.status(400).json({ code: 400, message: "parent_id forms a cycle" });
      }
    }
    sets.push("parent_id = ?");
    params.push(parentId);
  }
  if (name !== undefined) {
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ code: 400, message: "name is required" });
    }
    sets.push("name = ?");
    params.push(name.trim());
  }
  if (path !== undefined) {
    sets.push("path = ?");
    params.push(path || null);
  }
  if (icon !== undefined) {
    sets.push("icon = ?");
    params.push(icon || null);
  }
  if (permission_code !== undefined) {
    sets.push("permission_code = ?");
    params.push(permission_code || null);
  }
  if (sort_order !== undefined) {
    sets.push("sort_order = ?");
    params.push(toInt(sort_order, 0));
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status === "disabled" ? "disabled" : "active");
  }

  if (sets.length === 0) {
    return res.status(400).json({ code: 400, message: "No fields to update" });
  }

  params.push(id);
  db.prepare(`UPDATE menus SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  const row = db
    .prepare(`
      SELECT id, parent_id, name, path, icon, permission_code, sort_order, status, created_at        FROM menus WHERE id = ?
    `)
    .get(id);

  return res.status(200).json({ code: 200, message: "success", data: pickMenuPublic(row) });
}

function deleteMenu(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db.prepare("SELECT id FROM menus WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Menu not found" });

  const childCount = db.prepare("SELECT COUNT(*) AS c FROM menus WHERE parent_id = ?").get(id).c;
  const cascade = String(req.query.cascade || "").trim().toLowerCase() === "true";

  if (childCount > 0 && !cascade) {
    return res.status(409).json({
      code: 409,
      message: `Menu has ${childCount} child(ren). Pass cascade=true to delete recursively`,
    });
  }

  if (cascade) {
    // delete descendants recursively (breadth-first to avoid FK issues)
    const toDelete = [id];
    let i = 0;
    while (i < toDelete.length) {
      const current = toDelete[i++];
      const children = db.prepare("SELECT id FROM menus WHERE parent_id = ?").all(current);
      for (const c of children) toDelete.push(c.id);
    }
    // delete from deepest to shallowest so FK doesn't complain
    const stmt = db.prepare("DELETE FROM menus WHERE id = ?");
    const tx = db.transaction(() => {
      for (let j = toDelete.length - 1; j >= 0; j--) {
        stmt.run(toDelete[j]);
      }
    });
    tx();
  } else {
    db.prepare("DELETE FROM menus WHERE id = ?").run(id);
  }

  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

function reorderMenus(req, res) {
  const db = openDb();
  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: "items must be a non-empty array" });
  }

  const stmt = db.prepare(`
    UPDATE menus SET parent_id = ?, sort_order = ? WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const it of items) {
      const mid = toInt(it.id, 0);
      if (!mid) continue;
      const parentId = it.parent_id != null ? toInt(it.parent_id, null) : null;
      const sortOrder = toInt(it.sort_order, 0);
      stmt.run(parentId, sortOrder, mid);
    }
  });
  tx();

  return res.status(200).json({ code: 200, message: "success", data: { reordered: items.length } });
}

module.exports = {
  listMenus,
  getMenu,
  createMenu,
  updateMenu,
  deleteMenu,
  reorderMenus,
};
