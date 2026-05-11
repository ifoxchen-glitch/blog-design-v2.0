const { openDb } = require('../../../db');
const { nowIso, toInt } = require('../../../utils');
const modelsHandlers = require('./modelsHandlers');
const { saveConversationToRaw, upsertConversationDocument } = require('./saveConversation');

function parseMessages(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function pickConversation(row) {
  const messages = parseMessages(row.messages);
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    message_count: messages.length,
    tokens_used: row.tokens_used,
    tags: row.tags ? (tryParse(row.tags) || []) : [],
    is_starred: !!row.is_starred,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function tryParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

function buildSystemPrompt() {
  return 'You are a helpful AI assistant. Respond clearly and concisely in the user\'s language.';
}

module.exports = {
  listConversations(req, res, next) {
    try {
      const db = openDb();
      const { search, model, starred } = req.query;
      let sql = 'SELECT * FROM kb_conversations WHERE 1=1';
      const params = [];
      if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
      if (model) { sql += ' AND model = ?'; params.push(model); }
      if (starred !== undefined) { sql += ' AND is_starred = ?'; params.push(starred ? 1 : 0); }
      sql += ' ORDER BY updated_at DESC';
      const limit = toInt(req.query.limit) || 50;
      const offset = toInt(req.query.offset) || 0;
      sql += ' LIMIT ? OFFSET ?';
      const rows = db.prepare(sql).all(...params, limit, offset);
      const total = db.prepare('SELECT COUNT(*) AS c FROM kb_conversations').get().c;
      res.json({ code: 0, message: 'ok', data: { items: rows.map(pickConversation), total } });
    } catch (e) {
      next(e);
    }
  },

  createConversation(req, res, next) {
    try {
      const db = openDb();
      const { title, model, tags } = req.body;
      const now = nowIso();
      // Find default model
      const defaultModel = db.prepare(
        "SELECT model_name FROM kb_model_config WHERE is_default = 1 AND is_active = 1 LIMIT 1"
      ).get();
      const modelName = model || defaultModel?.model_name || 'gpt-4o';
      const result = db.prepare(`
        INSERT INTO kb_conversations (title, model, messages, tokens_used, tags, is_starred, created_at, updated_at)
        VALUES (?, ?, '[]', 0, ?, 0, ?, ?)
      `).run(title || '新对话', modelName, tags ? JSON.stringify(tags) : '[]', now, now);
      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(result.lastInsertRowid);
      res.json({ code: 0, message: 'ok', data: pickConversation(row) });
    } catch (e) {
      next(e);
    }
  },

  getConversation(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });
      res.json({
        code: 0, message: 'ok',
        data: {
          ...pickConversation(row),
          messages: parseMessages(row.messages),
        }
      });
    } catch (e) {
      next(e);
    }
  },

  updateConversation(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const existing = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ code: 404, message: 'Conversation not found' });
      const { title, model, tags, is_starred } = req.body;
      const now = nowIso();
      db.prepare(`
        UPDATE kb_conversations SET title = ?, model = ?, tags = ?, is_starred = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title ?? existing.title,
        model ?? existing.model,
        tags ? JSON.stringify(tags) : existing.tags,
        is_starred !== undefined ? (is_starred ? 1 : 0) : existing.is_starred,
        now, id
      );
      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      res.json({ code: 0, message: 'ok', data: pickConversation(row) });
    } catch (e) {
      next(e);
    }
  },

  deleteConversation(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      db.prepare('DELETE FROM kb_conversations WHERE id = ?').run(id);
      res.json({ code: 0, message: 'ok', data: null });
    } catch (e) {
      next(e);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const { content, temperature } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ code: 400, message: 'Message content is required' });
      }

      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });

      const now = nowIso();
      const userMsg = { role: 'user', content: content.trim(), timestamp: now };
      const messages = parseMessages(row.messages);

      // Build full message list for AI (with system prompt)
      const aiMessages = [
        { role: 'system', content: buildSystemPrompt() },
        ...messages,
        userMsg,
      ];

      const aiResult = await modelsHandlers.callAI(row.model, aiMessages, null, temperature);
      const assistantMsg = { role: 'assistant', content: aiResult.content, timestamp: nowIso(), provider: aiResult.provider };

      const updatedMessages = [...messages, userMsg, assistantMsg];
      db.prepare('UPDATE kb_conversations SET messages = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updatedMessages), now, id);

      res.json({ code: 0, message: 'ok', data: assistantMsg });
    } catch (e) {
      next(e);
    }
  },

  saveToKb(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });

      // Get the vault path from sync config
      const syncConfig = db.prepare('SELECT vault_path FROM kb_sync_config WHERE id = 1').get();
      if (!syncConfig?.vault_path) {
        return res.status(400).json({ code: 400, message: 'Obsidian vault path not configured. Please configure sync in KB Settings.' });
      }

      const messages = parseMessages(row.messages);
      const rawFilePath = saveConversationToRaw(row, messages, syncConfig.vault_path);
      upsertConversationDocument(db, row, rawFilePath);

      res.json({ code: 0, message: 'ok', data: { path: rawFilePath } });
    } catch (e) {
      next(e);
    }
  },
};
