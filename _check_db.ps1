Set-Location "C:\Users\陈科\MyProject\blog-design-v2.0\server"
$output = node -e "const Database = require('better-sqlite3'); const db = new Database('./db/blog.sqlite', { readonly: true }); const cols = db.prepare('PRAGMA table_info(kb_sync_config)').all(); console.log(JSON.stringify(cols, null, 2)); db.close()"
Write-Output $output
