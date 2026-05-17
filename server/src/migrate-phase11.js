// Phase 11: Multi-source sync
module.exports = function migratePhase11(db) {
  try { db.exec("CREATE TABLE IF NOT EXISTS sync_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('obsidian','local_folder','openwebui')),
    config TEXT NOT NULL DEFAULT '{}', enabled INTEGER NOT NULL DEFAULT 1,
    last_sync_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )"); } catch(e) { console.log('[P11a]', e.message); }
  try { db.exec("ALTER TABLE kb_sync_logs ADD COLUMN source_id INTEGER REFERENCES sync_sources(id) ON DELETE SET NULL"); } catch(e) {}
  try {
    db.exec("CREATE TABLE IF NOT EXISTS kb_documents_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE, excerpt TEXT,
      content_markdown TEXT NOT NULL DEFAULT '', content_html TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('obsidian','manual','api','openwebui')),
      original_path TEXT, checksum TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )");
    var di = db.prepare("SELECT sql FROM sqlite_master WHERE name='kb_documents' AND sql LIKE '%CHECK%'").get();
    if (di) {
      db.exec("INSERT INTO kb_documents_new SELECT id,title,slug,excerpt,content_markdown,content_html,source,original_path,checksum,tags,status,word_count,created_at,updated_at FROM kb_documents");
      db.exec("DROP TABLE kb_documents");
      db.exec("ALTER TABLE kb_documents_new RENAME TO kb_documents");
      db.exec("CREATE INDEX IF NOT EXISTS idx_kb_docs_slug ON kb_documents(slug)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_kb_docs_source ON kb_documents(source)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON kb_documents(status)");
      var cols = ['category','doc_type','connections','sources','doc_date','review_status'];
      for (var i = 0; i < cols.length; i++) { try { db.exec("ALTER TABLE kb_documents ADD COLUMN " + cols[i] + " TEXT DEFAULT NULL"); } catch(e) {} }
    } else { db.exec("DROP TABLE IF EXISTS kb_documents_new"); }
  } catch(e) { console.log('[P11c]', e.message); }
  console.log('[Phase 11] done');
};