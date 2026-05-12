const { openDb } = require('../../../db');
const { nowIso, toInt } = require('../../../utils');

// Simple XOR-based key encryption (for api_key storage)
// Not security-grade — use env vars for production keys.
// Decoding: encoded ^ keyByte → original
function xorEncrypt(text, key) {
  const result = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    result[i] = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
  }
  return result.toString('hex');
}

function encrypt(text) {
  return xorEncrypt(text, 'kb-workbench-2026');
}

function decrypt(encoded) {
  try {
    const buf = Buffer.from(encoded, 'hex');
    const result = Buffer.alloc(buf.length);
    const key = 'kb-workbench-2026';
    for (let i = 0; i < buf.length; i++) {
      result[i] = buf[i] ^ key.charCodeAt(i % key.length);
    }
    return result.toString();
  } catch {
    return '';
  }
}

function pickModel(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    api_endpoint: row.api_endpoint,
    // Don't expose raw api_key — return masked
    api_key: row.api_key ? '••••••••' + row.api_key.slice(-4) : '',
    has_api_key: !!row.api_key,
    model_name: row.model_name,
    max_tokens: row.max_tokens,
    temperature: row.temperature,
    is_default: !!row.is_default,
    is_active: !!row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function callAI(model, messages, maxTokens, temperature) {
  const db = openDb();
  const config = db.prepare(
    'SELECT * FROM kb_model_config WHERE model_name = ? AND is_active = 1 LIMIT 1'
  ).get(model);

  if (!config) throw new Error(`Model "${model}" not found or inactive`);

  const provider = config.provider;
  const apiKey = decrypt(config.api_key);
  const baseUrl = config.api_endpoint;
  const temperature_ = temperature ?? config.temperature;
  const maxTokens_ = maxTokens ?? config.max_tokens;

  if (!apiKey) throw new Error('API key not configured for this model');

  // Normalize messages to the format expected by each provider
  const normalizedMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (provider === 'anthropic') {
    // Anthropic requires system prompt as a top-level field, not in messages
    const systemTexts = normalizedMessages.filter(m => m.role === 'system').map(m => m.content);
    const anthropicMessages = normalizedMessages.filter(m => m.role !== 'system');
    const body = {
      model: config.model_name,
      system: systemTexts.join('\n\n'),
      messages: anthropicMessages,
      max_tokens: maxTokens_,
    };
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return { content: data.content?.[0]?.text ?? '', provider: 'anthropic' };
  }

  if (provider === 'openai' || provider === 'groq' || provider === 'custom' || provider === 'ollama') {
    const body = {
      model: config.model_name,
      messages: normalizedMessages,
      max_tokens: maxTokens_,
      temperature: temperature_,
    };
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${provider} API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content ?? '', provider };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Streaming AI call — pipes SSE response directly to the Express response.
 * Sets appropriate SSE headers and streams each chunk as `data: <text>\n\n`.
 */
async function callAIStream(model, messages, maxTokens, temperature, res) {
  const db = openDb();
  const config = db.prepare(
    'SELECT * FROM kb_model_config WHERE model_name = ? AND is_active = 1 LIMIT 1'
  ).get(model);

  if (!config) {
    res.write('event: error\ndata: Model not found or inactive\n\n');
    res.end();
    return;
  }

  const provider = config.provider;
  const apiKey = decrypt(config.api_key);
  const baseUrl = config.api_endpoint;
  const temperature_ = temperature ?? config.temperature;
  const maxTokens_ = maxTokens ?? config.max_tokens;

  if (!apiKey) {
    res.write('event: error\ndata: API key not configured\n\n');
    res.end();
    return;
  }

  const normalizedMessages = messages.map(m => ({ role: m.role, content: m.content }));

  const commonHeaders = { 'content-type': 'application/json' };

  if (provider === 'anthropic') {
    const systemTexts = normalizedMessages.filter(m => m.role === 'system').map(m => m.content);
    const anthropicMessages = normalizedMessages.filter(m => m.role !== 'system');
    const body = {
      model: config.model_name,
      system: systemTexts.join('\n\n'),
      messages: anthropicMessages,
      max_tokens: maxTokens_,
      stream: true,
    };
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...commonHeaders },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.text();
      res.write(`event: error\ndata: Anthropic API error ${response.status}: ${err}\n\n`);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Anthropic SSE: lines like 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}\n\n'
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                res.write(`data: ${parsed.delta.text}\n\n`);
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } finally { reader.releaseLock(); }
    res.write('event: done\ndata: \n\n');
    res.end();
    return;
  }

  // OpenAI / Groq / Ollama / Custom
  const body = {
    model: config.model_name,
    messages: normalizedMessages,
    max_tokens: maxTokens_,
    temperature: temperature_,
    stream: true,
  };
  const authHeader = provider === 'ollama'
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'Authorization': `Bearer ${apiKey}` };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { ...authHeader, ...commonHeaders },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    res.write(`event: error\ndata: ${provider} API error ${response.status}: ${err}\n\n`);
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // OpenAI SSE: lines like 'data: {"choices":[{"delta":{"content":"..."}}]}\n\n'
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line === 'data: [DONE]') {
          res.write('event: done\ndata: \n\n');
        } else if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) res.write(`data: ${content}\n\n`);
          } catch { /* skip malformed */ }
        }
      }
    }
  } finally { reader.releaseLock(); }
  res.write('event: done\ndata: \n\n');
  res.end();
}

module.exports = {
  listModels(req, res, next) {
    try {
      const db = openDb();
      const rows = db.prepare(
        'SELECT * FROM kb_model_config ORDER BY sort_order ASC, id ASC'
      ).all();
      res.json({ code: 0, message: 'ok', data: rows.map(pickModel) });
    } catch (e) {
      next(e);
    }
  },

  createModel(req, res, next) {
    try {
      const db = openDb();
      const { name, provider, api_endpoint, api_key, model_name, max_tokens, temperature, is_default, is_active, sort_order } = req.body;
      const now = nowIso();

      // Encrypt api_key before storing
      const encryptedKey = api_key ? encrypt(api_key) : '';
      const result = db.prepare(`
        INSERT INTO kb_model_config (name, provider, api_endpoint, api_key, model_name, max_tokens, temperature, is_default, is_active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, provider, api_endpoint, encryptedKey, model_name, max_tokens ?? 4096, temperature ?? 0.7, is_default ? 1 : 0, is_active !== 0 ? 1 : 0, sort_order ?? 0, now, now);

      // If this is default, clear default flag from others
      if (is_default) {
        db.prepare('UPDATE kb_model_config SET is_default = 0 WHERE id != ?').run(result.lastInsertRowid);
      }

      const row = db.prepare('SELECT * FROM kb_model_config WHERE id = ?').get(result.lastInsertRowid);
      res.json({ code: 0, message: 'ok', data: pickModel(row) });
    } catch (e) {
      next(e);
    }
  },

  updateModel(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const existing = db.prepare('SELECT * FROM kb_model_config WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ code: 404, message: 'Model not found' });

      const { name, provider, api_endpoint, api_key, model_name, max_tokens, temperature, is_default, is_active, sort_order } = req.body;
      const now = nowIso();

      // Only re-encrypt if a new api_key is provided (and it's not the masked version)
      let encryptedKey = existing.api_key;
      if (api_key && !api_key.startsWith('••••')) {
        encryptedKey = encrypt(api_key);
      }

      db.prepare(`
        UPDATE kb_model_config SET
          name = ?, provider = ?, api_endpoint = ?, api_key = ?, model_name = ?,
          max_tokens = ?, temperature = ?, is_default = ?, is_active = ?, sort_order = ?, updated_at = ?
        WHERE id = ?
      `).run(
        name ?? existing.name,
        provider ?? existing.provider,
        api_endpoint ?? existing.api_endpoint,
        encryptedKey,
        model_name ?? existing.model_name,
        max_tokens ?? existing.max_tokens,
        temperature ?? existing.temperature,
        is_default ? 1 : 0,
        is_active !== 0 ? 1 : 0,
        sort_order ?? existing.sort_order,
        now,
        id
      );

      if (is_default) {
        db.prepare('UPDATE kb_model_config SET is_default = 0 WHERE id != ?').run(id);
      }

      const row = db.prepare('SELECT * FROM kb_model_config WHERE id = ?').get(id);
      res.json({ code: 0, message: 'ok', data: pickModel(row) });
    } catch (e) {
      next(e);
    }
  },

  deleteModel(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      db.prepare('DELETE FROM kb_model_config WHERE id = ?').run(id);
      res.json({ code: 0, message: 'ok', data: null });
    } catch (e) {
      next(e);
    }
  },

  async testModel(req, res, next) {
    try {
      const db = openDb();
      const id = toInt(req.params.id);
      const config = db.prepare('SELECT * FROM kb_model_config WHERE id = ?').get(id);
      if (!config) return res.status(404).json({ code: 404, message: 'Model not found' });

      const apiKey = decrypt(config.api_key);
      if (!apiKey) return res.json({ code: 0, message: 'API key not set', data: { ok: false, error: 'API key not configured' } });

      const testMessages = [{ role: 'user', content: 'Say "hello" in exactly one word.' }];
      const result = await callAI(config.model_name, testMessages, 10, 0.1);
      res.json({ code: 0, message: 'ok', data: { ok: true, response: result.content } });
    } catch (e) {
      res.json({ code: 0, message: 'ok', data: { ok: false, error: e.message } });
    }
  },

  // Expose callAI for use by conversationsHandlers
  callAI,
  callAIStream,
};
