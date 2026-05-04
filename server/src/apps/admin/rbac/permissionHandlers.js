const { openDb } = require("../../../db");
const { toInt } = require("../../../utils");

function listPermissions(req, res) {
  const db = openDb();
  const resource = String(req.query.resource || "").trim() || null;

  let where = "1=1";
  const params = [];
  if (resource) {
    where += " AND resource = ?";
    params.push(resource);
  }

  const rows = db
    .prepare(`
      SELECT id, code, resource, action, name, description
        FROM permissions
       WHERE ${where}
       ORDER BY id
    `)
    .all(...params);

  const items = rows.map((r) => ({
    id: r.id,
    code: r.code,
    resource: r.resource,
    action: r.action,
    name: r.name,
    description: r.description || null,
  }));

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items, total: items.length },
  });
}

function updatePermission(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT id FROM permissions WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Permission not found" });

  const { name, description } = req.body || {};
  const sets = [];
  const params = [];

  if (name !== undefined) {
    sets.push("name = ?");
    params.push(name);
  }
  if (description !== undefined) {
    sets.push("description = ?");
    params.push(description || null);
  }

  if (sets.length === 0) {
    return res.status(400).json({ code: 400, message: "No fields to update" });
  }

  params.push(id);
  db.prepare(`UPDATE permissions SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  const row = db
    .prepare(`SELECT id, code, resource, action, name, description FROM permissions WHERE id = ?`)
    .get(id);

  const item = {
    id: row.id,
    code: row.code,
    resource: row.resource,
    action: row.action,
    name: row.name,
    description: row.description || null,
  };

  return res.status(200).json({ code: 200, message: "success", data: item });
}

module.exports = {
  listPermissions,
  updatePermission,
};
