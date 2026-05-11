const { openDb } = require('../../../db');
const { nowIso, toInt } = require('../../../utils');

function parseTags(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function pickTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date || null,
    tags: parseTags(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = {
  listTasks(req, res, next) {
    try {
      const db = openDb();
      const { status } = req.query;
      let sql = 'SELECT * FROM kb_tasks WHERE 1=1';
      const params = [];
      if (status) { sql += ' AND status = ?'; params.push(status); }
      sql += ' ORDER BY priority ASC, created_at DESC';
      const rows = db.prepare(sql).all(...params);
      res.json({ code: 0, message: 'ok', data: rows.map(pickTask) });
    } catch (e) {
      next(e);
    }
  },

  createTask(req, res, next) {
    try {
      const db = openDb();
      const { title, description, status, priority, due_date, tags } = req.body;
      const now = nowIso();
      const result = db.prepare(`
        INSERT INTO kb_tasks (title, description, status, priority, due_date, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, description || null, status || 'todo', priority ?? 2, due_date || null, tags ? JSON.stringify(tags) : '[]', now, now);
      const row = db.prepare('SELECT * FROM kb_tasks WHERE id = ?').get(result.lastInsertRowid);
      res.json({ code: 0, message: 'ok', data: pickTask(row) });
    } catch (e) {
      next(e);
    }
  },

  updateTask(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const existing = db.prepare('SELECT * FROM kb_tasks WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ code: 404, message: 'Task not found' });
      const { title, description, status, priority, due_date, tags } = req.body;
      const now = nowIso();
      db.prepare(`
        UPDATE kb_tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title ?? existing.title,
        description ?? existing.description,
        status ?? existing.status,
        priority ?? existing.priority,
        due_date ?? existing.due_date,
        tags ? JSON.stringify(tags) : existing.tags,
        now, id
      );
      const row = db.prepare('SELECT * FROM kb_tasks WHERE id = ?').get(id);
      res.json({ code: 0, message: 'ok', data: pickTask(row) });
    } catch (e) {
      next(e);
    }
  },

  deleteTask(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      db.prepare('DELETE FROM kb_tasks WHERE id = ?').run(id);
      res.json({ code: 0, message: 'ok', data: null });
    } catch (e) {
      next(e);
    }
  },
};
