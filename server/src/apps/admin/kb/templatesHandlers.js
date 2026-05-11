const { openDb } = require('../../../db');
const { nowIso, toInt } = require('../../../utils');

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function pickTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    command: row.command,
    content: row.content,
    variables: parseJson(row.variables, []),
    tags: parseJson(row.tags, []),
    is_active: !!row.is_active,
    use_count: row.use_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Replace {{variable}} placeholders in content with provided values.
 */
function fillTemplate(content, varValues) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, name) => varValues[name] ?? `{{${name}}}`);
}

module.exports = {
  listTemplates(req, res, next) {
    try {
      const db = openDb();
      const { active } = req.query;
      let sql = 'SELECT * FROM kb_prompt_templates WHERE 1=1';
      const params = [];
      if (active !== undefined) { sql += ' AND is_active = ?'; params.push(active ? 1 : 0); }
      sql += ' ORDER BY use_count DESC, id ASC';
      const rows = db.prepare(sql).all(...params);
      res.json({ code: 0, message: 'ok', data: rows.map(pickTemplate) });
    } catch (e) { next(e); }
  },

  createTemplate(req, res, next) {
    try {
      const db = openDb();
      const { title, command, content, variables, tags, is_active } = req.body;
      if (!title || !command || !content) {
        return res.status(400).json({ code: 400, message: 'title, command, content are required' });
      }
      const now = nowIso();
      const result = db.prepare(`
        INSERT INTO kb_prompt_templates (title, command, content, variables, tags, is_active, use_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        title, command, content,
        JSON.stringify(variables || []),
        JSON.stringify(tags || []),
        is_active !== 0 ? 1 : 0,
        now, now
      );
      const row = db.prepare('SELECT * FROM kb_prompt_templates WHERE id = ?').get(result.lastInsertRowid);
      res.json({ code: 0, message: 'ok', data: pickTemplate(row) });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ code: 409, message: 'Command already exists' });
      }
      next(e);
    }
  },

  updateTemplate(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const existing = db.prepare('SELECT * FROM kb_prompt_templates WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ code: 404, message: 'Template not found' });

      const { title, command, content, variables, tags, is_active } = req.body;
      const now = nowIso();
      db.prepare(`
        UPDATE kb_prompt_templates SET
          title = ?, command = ?, content = ?,
          variables = ?, tags = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title ?? existing.title,
        command ?? existing.command,
        content ?? existing.content,
        variables ? JSON.stringify(variables) : existing.variables,
        tags ? JSON.stringify(tags) : existing.tags,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        now, id
      );
      const row = db.prepare('SELECT * FROM kb_prompt_templates WHERE id = ?').get(id);
      res.json({ code: 0, message: 'ok', data: pickTemplate(row) });
    } catch (e) { next(e); }
  },

  deleteTemplate(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      db.prepare('DELETE FROM kb_prompt_templates WHERE id = ?').run(id);
      res.json({ code: 0, message: 'ok', data: null });
    } catch (e) { next(e); }
  },

  // Expose for use in chat
  fillTemplate,
};
