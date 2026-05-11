const { openDb } = require('../../../db');
const { nowIso } = require('../../../utils');

/**
 * Perform a web search using the configured provider.
 * Currently supported: duckduckgo (no API key), google (SerpApi), searxng (self-hosted).
 */
async function performSearch(query, config) {
  const provider = config.provider || 'duckduckgo';

  if (provider === 'duckduckgo') {
    // DuckDuckGo HTML lite (no API key needed)
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KB-Workbench/1.0)' },
    });
    if (!res.ok) throw new Error(`DuckDuckGo error ${res.status}`);
    const html = await res.text();
    // Parse snippets from DDG HTML results
    const snippets = [];
    const re = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null && snippets.length < 8) {
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) snippets.push(text);
    }
    return {
      provider: 'duckduckgo',
      query,
      results: snippets.slice(0, 6).map((snippet, i) => ({ index: i, snippet })),
    };
  }

  if (provider === 'searxng') {
    if (!config.api_endpoint) throw new Error('SearXNG endpoint not configured');
    const url = `${config.api_endpoint}/search`;
    const res = await fetch(`${url}?q=${encodeURIComponent(query)}&format=json&engines=dDuckDuckGo,Google&limit=8`);
    if (!res.ok) throw new Error(`SearXNG error ${res.status}`);
    const data = await res.json();
    const results = (data.results || []).slice(0, 6).map((r, i) => ({
      index: i,
      snippet: r.content || r.title || '',
      url: r.url,
      title: r.title,
    }));
    return { provider: 'searxng', query, results };
  }

  if (provider === 'serpapi') {
    if (!config.api_key) throw new Error('SerpApi key not configured');
    const res = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${config.api_key}&num=6`
    );
    if (!res.ok) throw new Error(`SerpApi error ${res.status}`);
    const data = await res.json();
    const results = (data.organic_results || []).slice(0, 6).map((r, i) => ({
      index: i,
      snippet: r.snippet || '',
      url: r.link,
      title: r.title,
    }));
    return { provider: 'serpapi', query, results };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

module.exports = {
  getConfig(req, res, next) {
    try {
      const db = openDb();
      const row = db.prepare('SELECT * FROM kb_web_search_config WHERE id = 1').get();
      res.json({
        code: 0, message: 'ok',
        data: {
          provider: row.provider,
          api_endpoint: row.api_endpoint || '',
          is_active: !!row.is_active,
        },
      });
    } catch (e) { next(e); }
  },

  updateConfig(req, res, next) {
    try {
      const db = openDb();
      const { provider, api_endpoint, api_key, is_active } = req.body;
      const now = nowIso();
      db.prepare(`
        UPDATE kb_web_search_config SET
          provider = ?, api_endpoint = ?,
          api_key = COALESCE(NULLIF(?, ''), api_key),
          is_active = ?, updated_at = ?
        WHERE id = 1
      `).run(
        provider || 'duckduckgo',
        api_endpoint || '',
        api_key || '',
        is_active !== false ? 1 : 0,
        now,
      );
      res.json({ code: 0, message: 'ok', data: null });
    } catch (e) { next(e); }
  },

  async search(req, res, next) {
    try {
      const db = openDb();
      const { q } = req.query;
      if (!q || !q.trim()) return res.status(400).json({ code: 400, message: 'q is required' });

      const config = db.prepare('SELECT * FROM kb_web_search_config WHERE id = 1').get();
      if (!config?.is_active) return res.status(400).json({ code: 400, message: 'Web search is disabled' });

      const result = await performSearch(q.trim(), config);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (e) {
      res.json({ code: 0, message: 'ok', data: { provider: 'error', query: req.query.q || '', results: [], error: e.message } });
    }
  },
};
