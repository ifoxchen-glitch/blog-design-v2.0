const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { nowIso, normalizeSlug } = require("./utils");

let _db = null;

function openDb() {
  if (_db) return _db;
  const dbPath = path.join(__dirname, "..", "db", "blog.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("foreign_keys = ON");
  _db.pragma("journal_mode = WAL");
  return _db;
}

function __resetForRestore() {
  // 还原备份前清空模块级缓存的 db 句柄
  // 调用方负责在调用前关闭 db
  _db = null;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      coverImageUrl TEXT,
      contentMarkdown TEXT NOT NULL,
      contentHtml TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
      publishedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_tags (
      postId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (postId, tagId),
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_categories (
      postId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      PRIMARY KEY (postId, categoryId),
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS external_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      iconSize TEXT NOT NULL DEFAULT '1x1' CHECK (iconSize IN ('1x1', '2x1', '1x2', '2x2')),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_status_publishedAt ON posts(status, publishedAt);
    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    CREATE INDEX IF NOT EXISTS idx_post_tags_tagId ON post_tags(tagId);
    CREATE INDEX IF NOT EXISTS idx_post_categories_categoryId ON post_categories(categoryId);
    CREATE INDEX IF NOT EXISTS idx_external_links_sortOrder ON external_links(sortOrder);

    -- ============================================================
    -- Phase 1 (Admin v2): RBAC + 审计 + 多站点 + 前台读者预留
    -- 新表统一使用 snake_case，与旧表的 camelCase 区分；通过这种命名
    -- 风格差异即可一眼看出是 v2 域的表。详见 docs/04-admin-architecture.md §5。
    -- ============================================================

    -- 5.1 后台用户
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 5.2 角色
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 5.3 用户-角色关联
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    -- 5.4 权限（资源:操作 格式）
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    -- 5.5 角色-权限关联
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    -- 5.6 后台菜单（树形）
    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT NULL REFERENCES menus(id),
      name TEXT NOT NULL,
      path TEXT,
      icon TEXT,
      permission_code TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    -- 5.7 操作审计日志
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      detail TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    -- 5.8 多站点（预留）
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      domain TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 5.9 前台读者用户（预留：评论/收藏体系）
    CREATE TABLE IF NOT EXISTS front_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 5.10 访问统计原始记录
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      ip TEXT,
      user_agent TEXT,
      session_id TEXT,
      front_user_id INTEGER REFERENCES front_users(id),
      created_at TEXT NOT NULL
    );

    -- v2 索引
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);

    -- Phase 4: 备份管理
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      size INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'ok',
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);

    -- Phase 6: 备份定时任务配置
    CREATE TABLE IF NOT EXISTS backup_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      keep_count INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Phase 7: Knowledge Base
    CREATE TABLE IF NOT EXISTS kb_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      content_markdown TEXT NOT NULL DEFAULT '',
      content_html TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('obsidian','manual','api')),
      original_path TEXT,
      checksum TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_docs_slug ON kb_documents(slug);
    CREATE INDEX IF NOT EXISTS idx_kb_docs_source ON kb_documents(source);
    CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON kb_documents(status);

    CREATE TABLE IF NOT EXISTS kb_canvases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      zoom REAL NOT NULL DEFAULT 1.0,
      pan_x REAL NOT NULL DEFAULT 0.0,
      pan_y REAL NOT NULL DEFAULT 0.0,
      grid_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_canvas_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canvas_id INTEGER NOT NULL REFERENCES kb_canvases(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'concept',
      label TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 180,
      height REAL NOT NULL DEFAULT 80,
      color TEXT NOT NULL DEFAULT '#6366f1',
      metadata TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_cn_canvas ON kb_canvas_nodes(canvas_id);

    CREATE TABLE IF NOT EXISTS kb_canvas_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canvas_id INTEGER NOT NULL REFERENCES kb_canvases(id) ON DELETE CASCADE,
      source_node_id INTEGER NOT NULL REFERENCES kb_canvas_nodes(id) ON DELETE CASCADE,
      target_node_id INTEGER NOT NULL REFERENCES kb_canvas_nodes(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_ce_canvas ON kb_canvas_edges(canvas_id);
    CREATE INDEX IF NOT EXISTS idx_kb_ce_source ON kb_canvas_edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_kb_ce_target ON kb_canvas_edges(target_node_id);

    CREATE TABLE IF NOT EXISTS kb_document_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      sync_enabled INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (document_id, post_id)
    );
    CREATE INDEX IF NOT EXISTS idx_kb_dp_doc ON kb_document_posts(document_id);
    CREATE INDEX IF NOT EXISTS idx_kb_dp_post ON kb_document_posts(post_id);

    CREATE TABLE IF NOT EXISTS kb_sync_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_path TEXT NOT NULL DEFAULT '',
      auto_sync_enabled INTEGER NOT NULL DEFAULT 0,
      sync_interval_minutes INTEGER NOT NULL DEFAULT 30,
      conflict_strategy TEXT NOT NULL DEFAULT 'last_write_wins' CHECK (conflict_strategy IN ('last_write_wins','keep_both','skip')),
      last_sync_at TEXT,
      selected_paths TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL CHECK (direction IN ('import','export')),
      file_path TEXT,
      document_id INTEGER REFERENCES kb_documents(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('success','skipped','conflict','error')),
      checksum TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_sl_created ON kb_sync_logs(created_at);

    -- Phase 10: IoT Card Management
    CREATE TABLE IF NOT EXISTS iot_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      iccid TEXT UNIQUE NOT NULL,
      msisdn TEXT,
      imsi TEXT,
      operator TEXT,
      card_type TEXT,
      combo_name TEXT,
      combo_residue INTEGER DEFAULT 0,
      combo_used INTEGER DEFAULT 0,
      combo_total INTEGER DEFAULT 0,
      period_validity TEXT,
      status TEXT,
      gprs_state TEXT,
      on_off_status TEXT,
      activated_state TEXT,
      real_position TEXT,
      activation_time TEXT,
      end_time TEXT,
      remarks TEXT,
      last_sync_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_iot_cards_iccid ON iot_cards(iccid);
    CREATE INDEX IF NOT EXISTS idx_iot_cards_status ON iot_cards(status);
  `);
  // Seed the singleton row for kb_sync_config
  db.prepare(`INSERT OR IGNORE INTO kb_sync_config (id, vault_path, created_at, updated_at) VALUES (1, '', datetime('now'), datetime('now'))`).run();

  // Phase 7b: Wiki subdirectory + YAML front matter fields
  const kbAdds = [
    `ALTER TABLE kb_documents ADD COLUMN category TEXT DEFAULT NULL`,
    `ALTER TABLE kb_documents ADD COLUMN doc_type TEXT DEFAULT NULL CHECK (doc_type IN ('entity','concept','source','synthesis'))`,
    `ALTER TABLE kb_documents ADD COLUMN connections TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE kb_documents ADD COLUMN sources TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE kb_documents ADD COLUMN doc_date TEXT DEFAULT NULL`,
    `ALTER TABLE kb_documents ADD COLUMN review_status TEXT DEFAULT NULL CHECK (review_status IN ('seed','developing','mature'))`,
  ];
  for (const sql of kbAdds) {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  }
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_docs_category ON kb_documents(category)`); } catch { /* ignore */ }

  // Migrate existing obsidian original_path to strip wiki/ prefix
  try {
    db.exec(`UPDATE kb_documents SET original_path = SUBSTR(original_path, 6), checksum = NULL, updated_at = datetime('now') WHERE source = 'obsidian' AND original_path LIKE 'wiki/%'`);
  } catch { /* ignore */ }

  // Add selected_paths column for sync folder selection
  try { db.exec(`ALTER TABLE kb_sync_config ADD COLUMN selected_paths TEXT NOT NULL DEFAULT '[]'`); } catch { /* already exists */ }

  // Relax kb_canvas_nodes type CHECK constraint to allow kb-doc types
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS kb_canvas_nodes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        canvas_id INTEGER NOT NULL REFERENCES kb_canvases(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'concept',
        label TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 180,
        height REAL NOT NULL DEFAULT 80,
        color TEXT NOT NULL DEFAULT '#6366f1',
        metadata TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    // Only migrate if the old table has the CHECK constraint
    const tblInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name='kb_canvas_nodes' AND sql LIKE '%CHECK%'").get();
    if (tblInfo) {
      db.exec(`INSERT INTO kb_canvas_nodes_new SELECT * FROM kb_canvas_nodes`);
      db.exec(`DROP TABLE kb_canvas_nodes`);
      db.exec(`ALTER TABLE kb_canvas_nodes_new RENAME TO kb_canvas_nodes`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_cn_canvas ON kb_canvas_nodes(canvas_id)`);
    } else {
      db.exec(`DROP TABLE IF EXISTS kb_canvas_nodes_new`);
    }
  } catch { /* ignore migration failures */ }

  // ============================================================
  // Phase 8: KB Workbench — AI Chat + Tasks
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_model_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','ollama','groq','custom')),
      api_endpoint TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_name TEXT NOT NULL,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      temperature REAL NOT NULL DEFAULT 0.7,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '新对话',
      model TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      tokens_used INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      is_starred INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
      priority INTEGER NOT NULL DEFAULT 2,
      due_date TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kb_conv_created ON kb_conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_kb_tasks_status ON kb_tasks(status);

    CREATE TABLE IF NOT EXISTS kb_prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      command TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kb_tmpl_active ON kb_prompt_templates(is_active);

    CREATE TABLE IF NOT EXISTS kb_conversation_branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES kb_conversations(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      messages_snapshot TEXT NOT NULL DEFAULT '[]',
      response_content TEXT,
      response_provider TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kb_branches_conv ON kb_conversation_branches(conversation_id);

    CREATE TABLE IF NOT EXISTS kb_web_search_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'duckduckgo',
      api_key TEXT NOT NULL DEFAULT '',
      api_endpoint TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Phase 8.1 migrations: add folder / system_prompt safely (ignore if already exists)
  try { db.exec(`ALTER TABLE kb_conversations ADD COLUMN folder TEXT DEFAULT 'default'`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE kb_conversations ADD COLUMN system_prompt TEXT DEFAULT ''`); } catch { /* exists */ }

  // Seed singleton row for web search config
  db.prepare(`INSERT OR IGNORE INTO kb_web_search_config (id, provider, is_active, created_at, updated_at) VALUES (1, 'duckduckgo', 1, datetime('now'), datetime('now'))`).run();

  // Phase 9: System settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      open_webui_url TEXT NOT NULL DEFAULT '',
      open_webui_api_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  // Add open_webui_api_key column if not exists (migration for existing DBs)
  try { db.exec(`ALTER TABLE system_settings ADD COLUMN open_webui_api_key TEXT NOT NULL DEFAULT ''`); } catch { /* exists */ }
  db.prepare(`INSERT OR IGNORE INTO system_settings (id, open_webui_url, open_webui_api_key, created_at, updated_at) VALUES (1, '', '', datetime('now'), datetime('now'))`).run();

  // Seed default prompt templates
  const tmplCount = db.prepare("SELECT COUNT(*) AS c FROM kb_prompt_templates").get().c;
  if (tmplCount === 0) {
    const now = nowIso();
    const seedTemplates = [
      { title: '总结摘要', command: '/summarize', content: '请用中文总结以下内容的要点：\n{{text}}', variables: JSON.stringify([{ name: 'text', label: '待总结内容', default: '' }]) },
      { title: '翻译', command: '/translate', content: '请将以下内容翻译成{{lang}}：\n{{text}}', variables: JSON.stringify([{ name: 'lang', label: '目标语言', default: '中文' }, { name: 'text', label: '原文', default: '' }]) },
      { title: '解释概念', command: '/explain', content: '用通俗易懂的语言解释以下概念：\n{{concept}}', variables: JSON.stringify([{ name: 'concept', label: '概念', default: '' }]) },
      { title: '代码审查', command: '/review', content: '请审查以下代码，指出问题并提供改进建议：\n```\n{{code}}\n```', variables: JSON.stringify([{ name: 'code', label: '代码', default: '' }]) },
      { title: '写作润色', command: '/writing', content: '请帮我润色以下文字，使表达更流畅：\n{{text}}', variables: JSON.stringify([{ name: 'text', label: '原文', default: '' }]) },
      { title: '学习计划', command: '/plan', content: '请为「{{topic}}」制定一个学习计划，包括阶段划分和推荐资源。', variables: JSON.stringify([{ name: 'topic', label: '学习主题', default: '' }]) },
    ];
    const ins = db.prepare(`INSERT INTO kb_prompt_templates (title, command, content, variables, tags, is_active, use_count, created_at, updated_at) VALUES (?, ?, ?, ?, '[]', 1, 0, ?, ?)`);
    for (const t of seedTemplates) ins.run(t.title, t.command, t.content, t.variables, now, now);
  }



  // Seed default model config if empty
  const modelCount = db.prepare("SELECT COUNT(*) AS c FROM kb_model_config").get().c;
  if (modelCount === 0) {
    const now = nowIso();
    db.prepare(`INSERT INTO kb_model_config (name, provider, api_endpoint, api_key, model_name, max_tokens, temperature, is_default, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'GPT-4o', 'openai', 'https://api.openai.com/v1', '', 'gpt-4o', 4096, 0.7, 1, 1, 0, now, now
    );
    db.prepare(`INSERT INTO kb_model_config (name, provider, api_endpoint, api_key, model_name, max_tokens, temperature, is_default, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'Claude 4 Opus', 'anthropic', 'https://api.anthropic.com/v1', '', 'claude-3-opus-20240229', 4096, 0.7, 0, 1, 1, now, now
    );
  }

}

function ensureSeed(db) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM posts").get().c;
  if (count > 0) return;

  const createdAt = nowIso();
  const updatedAt = createdAt;
  const publishedAt = createdAt;
  const title = "用真实长文压版式：单篇文章模板";
  const slug = normalizeSlug("post-template");
  const excerpt = "代码块、列表、引用与多级标题在同一条阅读流里是否舒服，只有放进真内容才知道。";
  const coverImageUrl = "https://picsum.photos/seed/posthero/960/480";
  const contentMarkdown = `# 用真实长文压版式：单篇文章模板

这是一篇用于压版的示例文章。你可以在后台编辑它，发布后前台会通过 API 动态渲染。

## 设计令牌与 CSS

原型将 Variables 映射为 \`css/tokens.css\` 中的自定义属性：颜色、字号阶梯、间距、圆角与正文最大宽度。

## 代码块示例

\`\`\`ts
type Post = { title: string; slug: string; publishedAt: string };
\`\`\`
`;

  const insertPost = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, coverImageUrl, contentMarkdown, contentHtml, status, publishedAt, createdAt, updatedAt)
    VALUES (@title, @slug, @excerpt, @coverImageUrl, @contentMarkdown, NULL, 'published', @publishedAt, @createdAt, @updatedAt)
  `);
  const info = insertPost.run({
    title,
    slug,
    excerpt,
    coverImageUrl,
    contentMarkdown,
    publishedAt,
    createdAt,
    updatedAt,
  });

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getTagId = db.prepare(`SELECT id FROM tags WHERE slug = ?`);
  const attach = db.prepare(`INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`);

  const tagNames = ["前端", "排版"];
  for (const name of tagNames) {
    const tSlug = normalizeSlug(name);
    insertTag.run({ name, slug: tSlug, createdAt });
    const tagId = getTagId.get(tSlug).id;
    attach.run(info.lastInsertRowid, tagId);
  }
}

function listTagsForPost(db, postId) {
  return db
    .prepare(
      `
      SELECT t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tagId = t.id
      WHERE pt.postId = ?
      ORDER BY t.name ASC
    `
    )
    .all(postId);
}

function listTagsForPosts(db, postIds) {
  if (!postIds.length) return {};
  const placeholders = postIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
      SELECT pt.postId, t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tagId = t.id
      WHERE pt.postId IN (${placeholders})
      ORDER BY t.name ASC
    `
    )
    .all(...postIds);
  const map = {};
  for (const id of postIds) map[id] = [];
  for (const row of rows) map[row.postId].push({ name: row.name, slug: row.slug });
  return map;
}

function listCategoriesForPosts(db, postIds) {
  if (!postIds.length) return {};
  const placeholders = postIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
      SELECT pc.postId, c.name, c.slug
      FROM categories c
      JOIN post_categories pc ON pc.categoryId = c.id
      WHERE pc.postId IN (${placeholders})
      ORDER BY c.name ASC
    `
    )
    .all(...postIds);
  const map = {};
  for (const id of postIds) map[id] = [];
  for (const row of rows) map[row.postId].push({ name: row.name, slug: row.slug });
  return map;
}

function upsertTags(db, tagNames) {
  const createdAt = nowIso();
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getTag = db.prepare(`SELECT id, name, slug FROM tags WHERE slug = ?`);

  const tags = [];
  for (const name of tagNames) {
    const slug = normalizeSlug(name);
    if (!slug) continue;
    insertTag.run({ name, slug, createdAt });
    tags.push(getTag.get(slug));
  }
  return tags;
}

function setPostTags(db, postId, tagNames) {
  const tags = upsertTags(db, tagNames);
  const del = db.prepare(`DELETE FROM post_tags WHERE postId = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`);

  const tx = db.transaction(() => {
    del.run(postId);
    for (const t of tags) ins.run(postId, t.id);
  });
  tx();

  return tags.map(({ name, slug }) => ({ name, slug }));
}

function upsertCategories(db, categoryNames) {
  const createdAt = nowIso();
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, createdAt)
    VALUES (@name, @slug, @createdAt)
  `);
  const getCategory = db.prepare(`SELECT id, name, slug FROM categories WHERE slug = ?`);

  const categories = [];
  for (const name of categoryNames) {
    const slug = normalizeSlug(name);
    if (!slug) continue;
    insertCategory.run({ name, slug, createdAt });
    const existing = getCategory.get(slug);
    if (existing) categories.push(existing);
  }
  return categories;
}

function listCategoriesForPost(db, postId) {
  return db
    .prepare(
      `
      SELECT c.name, c.slug
      FROM categories c
      JOIN post_categories pc ON pc.categoryId = c.id
      WHERE pc.postId = ?
      ORDER BY c.name ASC
    `
    )
    .all(postId);
}

function setPostCategories(db, postId, categoryNames) {
  const categories = upsertCategories(db, categoryNames);
  const del = db.prepare(`DELETE FROM post_categories WHERE postId = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO post_categories (postId, categoryId) VALUES (?, ?)`);

  const tx = db.transaction(() => {
    del.run(postId);
    for (const c of categories) ins.run(postId, c.id);
  });
  tx();

  return categories.map(({ name, slug }) => ({ name, slug }));
}

module.exports = {
  openDb,
  __resetForRestore,
  migrate,
  ensureSeed,
  listTagsForPost,
  listTagsForPosts,
  listCategoriesForPosts,
  setPostTags,
  listCategoriesForPost,
  setPostCategories,
};

