const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");

// ---- helpers ----

function pickCanvas(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    zoom: row.zoom,
    pan_x: row.pan_x,
    pan_y: row.pan_y,
    grid_visible: row.grid_visible === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function pickNode(row) {
  return {
    id: row.id,
    canvas_id: row.canvas_id,
    type: row.type,
    label: row.label,
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    metadata: JSON.parse(row.metadata || "{}"),
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function pickEdge(row) {
  return {
    id: row.id,
    canvas_id: row.canvas_id,
    source_node_id: row.source_node_id,
    target_node_id: row.target_node_id,
    label: row.label,
    style: JSON.parse(row.style || "{}"),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---- canvases ----

function listCanvases(req, res) {
  const db = openDb();
  const rows = db.prepare("SELECT * FROM kb_canvases ORDER BY updated_at DESC").all();

  const items = rows.map((c) => {
    const canvas = pickCanvas(c);
    const nodeCount = db.prepare("SELECT COUNT(*) AS c FROM kb_canvas_nodes WHERE canvas_id = ?").get(c.id).c;
    const edgeCount = db.prepare("SELECT COUNT(*) AS c FROM kb_canvas_edges WHERE canvas_id = ?").get(c.id).c;
    return { ...canvas, node_count: nodeCount, edge_count: edgeCount };
  });

  return res.status(200).json({ code: 200, message: "success", data: { items, total: items.length } });
}

function createCanvas(req, res) {
  const db = openDb();
  const body = req.body || {};
  const title = String(body.title ?? "").trim() || "未命名画布";
  const description = String(body.description ?? "").trim() || null;
  const now = nowIso();

  const info = db.prepare(`
    INSERT INTO kb_canvases (title, description, zoom, pan_x, pan_y, grid_visible, created_at, updated_at)
    VALUES (@title, @description, 1.0, 0.0, 0.0, 1, @created_at, @updated_at)
  `).run({ title, description, created_at: now, updated_at: now });

  const row = db.prepare("SELECT * FROM kb_canvases WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ code: 201, message: "success", data: pickCanvas(row) });
}

function getCanvas(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const canvas = db.prepare("SELECT * FROM kb_canvases WHERE id = ?").get(id);
  if (!canvas) return res.status(404).json({ code: 404, message: "Canvas not found" });

  const nodes = db.prepare("SELECT * FROM kb_canvas_nodes WHERE canvas_id = ? ORDER BY sort_order, id").all(id).map(pickNode);
  const edges = db.prepare("SELECT * FROM kb_canvas_edges WHERE canvas_id = ?").all(id).map(pickEdge);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { ...pickCanvas(canvas), nodes, edges },
  });
}

function updateCanvas(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT * FROM kb_canvases WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Canvas not found" });

  const body = req.body || {};
  const title = body.title !== undefined ? (String(body.title).trim() || existing.title) : existing.title;
  const description = body.description !== undefined ? (String(body.description).trim() || null) : existing.description;
  const zoom = body.zoom !== undefined ? Number(body.zoom) : existing.zoom;
  const pan_x = body.pan_x !== undefined ? Number(body.pan_x) : existing.pan_x;
  const pan_y = body.pan_y !== undefined ? Number(body.pan_y) : existing.pan_y;
  const grid_visible = body.grid_visible !== undefined ? (body.grid_visible ? 1 : 0) : existing.grid_visible;
  const now = nowIso();

  db.prepare(`
    UPDATE kb_canvases
       SET title=@title, description=@description, zoom=@zoom, pan_x=@pan_x, pan_y=@pan_y,
           grid_visible=@grid_visible, updated_at=@updated_at
     WHERE id=@id
  `).run({ title, description, zoom, pan_x, pan_y, grid_visible, updated_at: now, id });

  const row = db.prepare("SELECT * FROM kb_canvases WHERE id = ?").get(id);
  return res.status(200).json({ code: 200, message: "success", data: pickCanvas(row) });
}

function deleteCanvas(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare("DELETE FROM kb_canvases WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Canvas not found" });

  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

// ---- nodes ----

function addNode(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  if (!canvasId) return res.status(400).json({ code: 400, message: "Invalid canvas id" });

  const canvas = db.prepare("SELECT id FROM kb_canvases WHERE id = ?").get(canvasId);
  if (!canvas) return res.status(404).json({ code: 404, message: "Canvas not found" });

  const body = req.body || {};
  const type = String(body.type ?? "concept");
  const label = String(body.label ?? "").trim() || "新节点";
  const content = String(body.content ?? "");
  const x = Number(body.x ?? 0);
  const y = Number(body.y ?? 0);
  const width = Number(body.width ?? 180);
  const height = Number(body.height ?? 80);
  const color = String(body.color ?? "#6366f1");
  const metadata = JSON.stringify(body.metadata ?? {});
  const now = nowIso();

  // Get next sort_order
  const maxOrder = db.prepare("SELECT MAX(sort_order) AS m FROM kb_canvas_nodes WHERE canvas_id = ?").get(canvasId).m ?? 0;
  const sort_order = maxOrder + 1;

  const info = db.prepare(`
    INSERT INTO kb_canvas_nodes (canvas_id, type, label, content, x, y, width, height, color, metadata, sort_order, created_at, updated_at)
    VALUES (@canvas_id, @type, @label, @content, @x, @y, @width, @height, @color, @metadata, @sort_order, @created_at, @updated_at)
  `).run({ canvas_id: canvasId, type, label, content, x, y, width, height, color, metadata, sort_order, created_at: now, updated_at: now });

  const row = db.prepare("SELECT * FROM kb_canvas_nodes WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ code: 201, message: "success", data: pickNode(row) });
}

function updateNode(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  const nodeId = toInt(req.params.nid, 0);
  if (!canvasId || !nodeId) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT * FROM kb_canvas_nodes WHERE id = ? AND canvas_id = ?").get(nodeId, canvasId);
  if (!existing) return res.status(404).json({ code: 404, message: "Node not found" });

  const body = req.body || {};
  const type = body.type !== undefined ? String(body.type) : existing.type;
  const label = body.label !== undefined ? (String(body.label).trim() || existing.label) : existing.label;
  const content = body.content !== undefined ? String(body.content) : existing.content;
  const x = body.x !== undefined ? Number(body.x) : existing.x;
  const y = body.y !== undefined ? Number(body.y) : existing.y;
  const width = body.width !== undefined ? Number(body.width) : existing.width;
  const height = body.height !== undefined ? Number(body.height) : existing.height;
  const color = body.color !== undefined ? String(body.color) : existing.color;
  const metadata = body.metadata !== undefined ? JSON.stringify(body.metadata) : existing.metadata;
  const now = nowIso();

  db.prepare(`
    UPDATE kb_canvas_nodes
       SET type=@type, label=@label, content=@content, x=@x, y=@y, width=@width, height=@height,
           color=@color, metadata=@metadata, updated_at=@updated_at
     WHERE id=@id AND canvas_id=@canvas_id
  `).run({ type, label, content, x, y, width, height, color, metadata, updated_at: now, id: nodeId, canvas_id: canvasId });

  const row = db.prepare("SELECT * FROM kb_canvas_nodes WHERE id = ?").get(nodeId);
  return res.status(200).json({ code: 200, message: "success", data: pickNode(row) });
}

function deleteNode(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  const nodeId = toInt(req.params.nid, 0);
  if (!canvasId || !nodeId) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare("DELETE FROM kb_canvas_nodes WHERE id = ? AND canvas_id = ?").run(nodeId, canvasId);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Node not found" });

  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

// ---- edges ----

function addEdge(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  if (!canvasId) return res.status(400).json({ code: 400, message: "Invalid canvas id" });

  const canvas = db.prepare("SELECT id FROM kb_canvases WHERE id = ?").get(canvasId);
  if (!canvas) return res.status(404).json({ code: 404, message: "Canvas not found" });

  const body = req.body || {};
  const source_node_id = toInt(body.source_node_id, 0);
  const target_node_id = toInt(body.target_node_id, 0);
  if (!source_node_id || !target_node_id) return res.status(400).json({ code: 400, message: "source_node_id and target_node_id required" });

  // Verify both nodes belong to this canvas
  const srcNode = db.prepare("SELECT id FROM kb_canvas_nodes WHERE id = ? AND canvas_id = ?").get(source_node_id, canvasId);
  const tgtNode = db.prepare("SELECT id FROM kb_canvas_nodes WHERE id = ? AND canvas_id = ?").get(target_node_id, canvasId);
  if (!srcNode || !tgtNode) return res.status(400).json({ code: 400, message: "Nodes must belong to the same canvas" });

  const label = String(body.label ?? "");
  const style = JSON.stringify(body.style ?? {});
  const now = nowIso();

  const info = db.prepare(`
    INSERT INTO kb_canvas_edges (canvas_id, source_node_id, target_node_id, label, style, created_at, updated_at)
    VALUES (@canvas_id, @source_node_id, @target_node_id, @label, @style, @created_at, @updated_at)
  `).run({ canvas_id: canvasId, source_node_id, target_node_id, label, style, created_at: now, updated_at: now });

  const row = db.prepare("SELECT * FROM kb_canvas_edges WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ code: 201, message: "success", data: pickEdge(row) });
}

function updateEdge(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  const edgeId = toInt(req.params.eid, 0);
  if (!canvasId || !edgeId) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare("SELECT * FROM kb_canvas_edges WHERE id = ? AND canvas_id = ?").get(edgeId, canvasId);
  if (!existing) return res.status(404).json({ code: 404, message: "Edge not found" });

  const body = req.body || {};
  const label = body.label !== undefined ? String(body.label) : existing.label;
  const style = body.style !== undefined ? JSON.stringify(body.style) : existing.style;
  const now = nowIso();

  db.prepare("UPDATE kb_canvas_edges SET label=@label, style=@style, updated_at=@updated_at WHERE id=@id")
    .run({ label, style, updated_at: now, id: edgeId });

  const row = db.prepare("SELECT * FROM kb_canvas_edges WHERE id = ?").get(edgeId);
  return res.status(200).json({ code: 200, message: "success", data: pickEdge(row) });
}

function deleteEdge(req, res) {
  const db = openDb();
  const canvasId = toInt(req.params.id, 0);
  const edgeId = toInt(req.params.eid, 0);
  if (!canvasId || !edgeId) return res.status(400).json({ code: 400, message: "Invalid id" });

  const info = db.prepare("DELETE FROM kb_canvas_edges WHERE id = ? AND canvas_id = ?").run(edgeId, canvasId);
  if (info.changes === 0) return res.status(404).json({ code: 404, message: "Edge not found" });

  return res.status(200).json({ code: 200, message: "success", data: { deleted: true } });
}

module.exports = {
  listCanvases,
  createCanvas,
  getCanvas,
  updateCanvas,
  deleteCanvas,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  updateEdge,
  deleteEdge,
};
