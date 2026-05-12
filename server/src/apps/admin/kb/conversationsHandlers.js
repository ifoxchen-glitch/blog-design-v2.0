const fs = require('fs');
const path = require('path');
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
    folder: row.folder || 'default',
    system_prompt: row.system_prompt || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function tryParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

function buildSystemPrompt(conversationRow) {
  if (conversationRow?.system_prompt?.trim()) {
    return conversationRow.system_prompt.trim();
  }
  return 'You are a helpful AI assistant. Respond clearly and concisely in the user\'s language.';
}

function buildKbContext(kbContext) {
  if (!Array.isArray(kbContext) || kbContext.length === 0) return null;
  const snippets = kbContext.map(c => `【${c.title}】\n${c.snippet || ''}`).join('\n\n');
  return `以下是与用户问题相关的知识库文档片段：\n\n${snippets}`;
}

function isVisionModel(modelName) {
  if (!modelName) return false;
  const name = modelName.toLowerCase();
  return name.includes('vision') || name.includes('gpt-4o') || name.includes('claude-3');
}

function buildUserMessage(content, attachments, modelName) {
  const images = (attachments || []).filter(a => a.type === 'image');
  if (images.length === 0 || !isVisionModel(modelName)) {
    return { role: 'user', content: content.trim(), attachments };
  }

  // OpenAI-compatible vision format
  const contentParts = [{ type: 'text', text: content.trim() }];
  for (const img of images) {
    try {
      const filePath = path.join(__dirname, '..', '..', '..', 'public', img.url.replace(/^\/admin-static\//, ''));
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      const mime = path.extname(filePath).toLowerCase() === '.png' ? 'image/png'
        : path.extname(filePath).toLowerCase() === '.gif' ? 'image/gif'
        : path.extname(filePath).toLowerCase() === '.webp' ? 'image/webp'
        : 'image/jpeg';
      contentParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } });
    } catch {
      // Skip unreadable images
    }
  }
  return { role: 'user', content: contentParts, attachments };
}

module.exports = {
  listConversations(req, res, next) {
    try {
      const db = openDb();
      const { search, model, starred, folder } = req.query;
      let sql = 'SELECT * FROM kb_conversations WHERE 1=1';
      const params = [];
      if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
      if (model) { sql += ' AND model = ?'; params.push(model); }
      if (starred !== undefined) { sql += ' AND is_starred = ?'; params.push(starred ? 1 : 0); }
      if (folder) { sql += ' AND folder = ?'; params.push(folder); }
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
      const { title, model, tags, folder, system_prompt } = req.body;
      const now = nowIso();
      // Find default model
      const defaultModel = db.prepare(
        "SELECT model_name FROM kb_model_config WHERE is_default = 1 AND is_active = 1 LIMIT 1"
      ).get();
      const modelName = model || defaultModel?.model_name || 'gpt-4o';
      const result = db.prepare(`
        INSERT INTO kb_conversations (title, model, messages, tokens_used, tags, is_starred, folder, system_prompt, created_at, updated_at)
        VALUES (?, ?, '[]', 0, ?, 0, ?, ?, ?, ?)
      `).run(title || '新对话', modelName, tags ? JSON.stringify(tags) : '[]', folder || 'default', system_prompt || '', now, now);
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
      const { title, model, tags, is_starred, folder, system_prompt } = req.body;
      const now = nowIso();
      db.prepare(`
        UPDATE kb_conversations SET title = ?, model = ?, tags = ?, is_starred = ?, folder = ?, system_prompt = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title ?? existing.title,
        model ?? existing.model,
        tags ? JSON.stringify(tags) : existing.tags,
        is_starred !== undefined ? (is_starred ? 1 : 0) : existing.is_starred,
        folder ?? existing.folder,
        system_prompt !== undefined ? system_prompt : existing.system_prompt,
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

  uploadAttachment(req, res, next) {
    try {
      const id = toInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ code: 400, message: 'No file uploaded' });
      }
      const url = `/admin-static/uploads/chat/${id}/${req.file.filename}`;
      res.json({ code: 0, message: 'ok', data: { url, name: req.file.originalname, type: req.file.mimetype.startsWith('image/') ? 'image' : 'file' } });
    } catch (e) {
      next(e);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const { content, temperature, kbContext } = req.body;
      const attachments = req.body.attachments || [];
      const hasContent = content && content.trim();
      if (!hasContent && attachments.length === 0) {
        return res.status(400).json({ code: 400, message: 'Message content is required' });
      }

      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });

      const now = nowIso();
      const userMsg = { role: 'user', content: content ? content.trim() : '', timestamp: now, attachments };
      const messages = parseMessages(row.messages);

      // Build full message list for AI (with system prompt + optional KB context)
      const visionUserMsg = buildUserMessage(content, attachments, row.model);
      visionUserMsg.timestamp = now;
      const aiMessages = [
        { role: 'system', content: buildSystemPrompt(row) },
      ];
      const kbCtx = buildKbContext(kbContext);
      if (kbCtx) aiMessages.push({ role: 'system', content: kbCtx });
      aiMessages.push(...messages, visionUserMsg);

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
      upsertConversationDocument(db, row, rawFilePath, messages);

      res.json({ code: 0, message: 'ok', data: { path: rawFilePath } });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Streaming SSE — creates a user message, then streams the AI response.
   * On completion, saves the full message pair to DB.
   * GET /conversations/:id/messages/stream?content=...&temperature=...
   */
  async sendMessageStream(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const content = (req.query.content || '').trim();
      const temperature = req.query.temperature ? parseFloat(req.query.temperature) : undefined;
      let kbContext = null;
      if (req.query.kbContext) {
        try { kbContext = JSON.parse(req.query.kbContext); } catch { /* ignore */ }
      }

      let attachments = [];
      if (req.query.attachments) {
        try { attachments = JSON.parse(req.query.attachments); } catch { /* ignore */ }
      }

      if (!content && attachments.length === 0) {
        res.write('event: error\ndata: Content is required\n\n');
        res.end();
        return;
      }

      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) {
        res.write('event: error\ndata: Conversation not found\n\n');
        res.end();
        return;
      }

      const now = nowIso();
      const userMsg = { role: 'user', content, timestamp: now, attachments };
      const messages = parseMessages(row.messages);

      const visionUserMsg = buildUserMessage(content, attachments, row.model);
      visionUserMsg.timestamp = now;
      const aiMessages = [
        { role: 'system', content: buildSystemPrompt(row) },
      ];
      const kbCtx = buildKbContext(kbContext);
      if (kbCtx) aiMessages.push({ role: 'system', content: kbCtx });
      aiMessages.push(...messages, visionUserMsg);

      // Send user message event to client
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

      res.write(`event: user_message\ndata: ${JSON.stringify(userMsg)}\n\n`);

      let fullContent = '';
      let streamError = null;

      // Stream AI response and accumulate
      await new Promise((resolve, reject) => {
        const streamRes = {
          write(event, data) {
            if (res.writableEnded) return;
            if (data === undefined && typeof event === 'string') {
              // Single-argument raw SSE line from callAIStream
              res.write(event);
              const lines = event.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const text = line.slice(6);
                  if (text && text !== '[DONE]') fullContent += text;
                }
              }
            } else if (event === 'data') {
              fullContent += data;
              res.write(`data: ${data}\n\n`);
            } else {
              res.write(`event: ${event}\ndata: ${data ?? ''}\n\n`);
            }
          },
          end() {
            if (!res.writableEnded) res.end();
            resolve();
          },
        };

        modelsHandlers.callAIStream(row.model, aiMessages, null, temperature, streamRes).catch((err) => {
          streamError = err;
          if (!res.writableEnded) {
            res.write(`event: error\ndata: ${err.message}\n\n`);
            res.end();
          }
          reject(err);
        });
      }).catch(() => {
        // swallow so we can still save partial content below
      });

      // Save completed messages to DB (even if stream errored, keep partial response)
      const assistantMsg = { role: 'assistant', content: fullContent, timestamp: nowIso(), provider: 'ai' };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      db.prepare('UPDATE kb_conversations SET messages = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updatedMessages), nowIso(), id);

      if (!res.writableEnded) {
        res.write('event: done\ndata: \n\n');
        res.end();
      }
    } catch (e) {
      next(e);
    }
  },

  /**
   * Multi-model comparison — send same message to multiple models in parallel.
   * POST /conversations/:id/compare
   * Body: { content: string, models: string[] }
   * Returns: { branches: Array<{ model, content, provider, status }> }
   */
  async compareModels(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const { content, models: targetModels } = req.body;

      if (!content?.trim()) return res.status(400).json({ code: 400, message: 'Content required' });
      if (!Array.isArray(targetModels) || targetModels.length < 2) {
        return res.status(400).json({ code: 400, message: 'At least 2 models required' });
      }
      if (targetModels.length > 4) {
        return res.status(400).json({ code: 400, message: 'Max 4 models at once' });
      }

      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });

      const now = nowIso();
      const userMsg = { role: 'user', content: content.trim(), timestamp: now };
      const messages = parseMessages(row.messages);
      const aiMessages = [
        { role: 'system', content: buildSystemPrompt(row) },
        ...messages,
        userMsg,
      ];

      // Save user message to conversation
      const updatedMessages = [...messages, userMsg];
      db.prepare('UPDATE kb_conversations SET messages = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updatedMessages), now, id);

      // Create branch records
      const branchIds = [];
      const insertBranch = db.prepare(`
        INSERT INTO kb_conversation_branches (conversation_id, model, messages_snapshot, status, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `);
      for (const model of targetModels) {
        const r = insertBranch.run(id, model, JSON.stringify(aiMessages), now, now);
        branchIds.push(r.lastInsertRowid);
      }

      // Call all models in parallel
      const updateBranch = db.prepare(`
        UPDATE kb_conversation_branches SET response_content = ?, response_provider = ?, status = 'done', updated_at = ? WHERE id = ?
      `);
      const updateBranchError = db.prepare(`
        UPDATE kb_conversation_branches SET error_message = ?, status = 'error', updated_at = ? WHERE id = ?
      `);

      await Promise.allSettled(targetModels.map(async (model, i) => {
        try {
          const result = await modelsHandlers.callAI(model, aiMessages, null, undefined);
          updateBranch.run(result.content, result.provider, nowIso(), branchIds[i]);
        } catch (err) {
          updateBranchError.run(String(err.message || err), nowIso(), branchIds[i]);
        }
      }));

      // Fetch updated branches
      const branches = db.prepare(
        'SELECT * FROM kb_conversation_branches WHERE id IN (?, ?, ?, ?)'
      ).all(...branchIds);

      const response = branches.map(b => ({
        branch_id: b.id,
        model: b.model,
        content: b.response_content || null,
        provider: b.response_provider || null,
        status: b.status,
        error: b.error_message || null,
      }));

      res.json({ code: 0, message: 'ok', data: { branches: response } });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Regenerate a single assistant message at a given index.
   * Preserves history: takes all messages up to (and including) the user message
   * that triggered the target assistant response, then calls AI again.
   * POST /conversations/:id/messages/:idx/regenerate
   */
  async regenerateMessage(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const idx = toInt(req.params.idx);

      const row = db.prepare('SELECT * FROM kb_conversations WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ code: 404, message: 'Conversation not found' });

      const messages = parseMessages(row.messages);
      if (idx < 0 || idx >= messages.length || messages[idx].role !== 'assistant') {
        return res.status(400).json({ code: 400, message: 'Invalid message index' });
      }

      // Find the user message that triggered this assistant response
      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') { userIdx = i; break; }
      }
      if (userIdx === -1) {
        return res.status(400).json({ code: 400, message: 'No preceding user message found' });
      }

      // Build context: system + all messages up to and including the triggering user message
      const contextMessages = [
        { role: 'system', content: buildSystemPrompt(row) },
        ...messages.slice(0, userIdx + 1),
      ];

      const aiResult = await modelsHandlers.callAI(row.model, contextMessages, null, undefined);
      const assistantMsg = {
        role: 'assistant',
        content: aiResult.content,
        timestamp: nowIso(),
        provider: aiResult.provider,
      };

      // Update the target message in the array
      messages[idx] = assistantMsg;
      db.prepare('UPDATE kb_conversations SET messages = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(messages), nowIso(), id);

      res.json({ code: 0, message: 'ok', data: assistantMsg });
    } catch (e) {
      next(e);
    }
  },
};
