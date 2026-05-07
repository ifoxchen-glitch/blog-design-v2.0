/**
 * CouchDB adapter for Obsidian LiveSync.
 *
 * LiveSync stores each note as a CouchDB document. The document structure
 * varies by plugin version but typically looks like:
 *
 *   {
 *     _id: "xxxxx",
 *     _rev: "1-xxxxx",
 *     name: "folder/note.md",        // file path relative to vault root
 *     data: "# Hello\n\ncontent...",  // plain text markdown
 *     type: "note",
 *     mtime: 1715123456789,
 *     size: 256,
 *     deleted: false
 *   }
 *
 * Some versions store `data` as base64, which we detect and decode.
 */

const crypto = require("crypto");

function computeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Fetch all documents from a CouchDB database.
 * Supports authentication via cookie or basic auth.
 */
async function fetchAllDocs(baseUrl, dbName, auth) {
  const dbUrl = `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(dbName)}`;
  const headers = { Accept: "application/json" };
  if (auth) headers.Authorization = auth;

  // Step 1: get all doc IDs
  const allDocsUrl = `${dbUrl}/_all_docs?include_docs=false`;
  const allResp = await fetch(allDocsUrl, { headers });
  if (!allResp.ok) {
    throw new Error(`CouchDB _all_docs failed: ${allResp.status} ${allResp.statusText}`);
  }
  const allData = await allResp.json();
  if (allData.error) {
    throw new Error(`CouchDB error: ${allData.reason || allData.error}`);
  }

  const ids = (allData.rows || [])
    .filter((r) => !r.id.startsWith("_design/") && !r.id.startsWith("_local/"))
    .map((r) => r.id);

  if (ids.length === 0) return [];

  // Step 2: bulk fetch with _all_docs?include_docs=true
  const bulkUrl = `${dbUrl}/_all_docs?include_docs=true`;
  const bulkResp = await fetch(bulkUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ keys: ids }),
  });
  if (!bulkResp.ok) {
    throw new Error(`CouchDB bulk fetch failed: ${bulkResp.status}`);
  }
  const bulkData = await bulkResp.json();
  return (bulkData.rows || [])
    .filter((r) => r.doc && !r.doc.deleted)
    .map((r) => r.doc);
}

/**
 * Try to extract markdown content from a LiveSync CouchDB document.
 * Handles both plain text and base64-encoded `data` fields.
 */
function extractContent(doc) {
  // LiveSync v0.22+ stores content in `data` field
  if (typeof doc.data === "string" && doc.data.length > 0) {
    // Detect base64 encoding
    if (/^[A-Za-z0-9+/=]+$/.test(doc.data.slice(0, 200)) && doc.data.length > 60) {
      try {
        const decoded = Buffer.from(doc.data, "base64").toString("utf8");
        // If decoded looks like valid text, use it
        if (decoded.length > 0 && !decoded.includes("\x00")) {
          return decoded;
        }
      } catch {
        // not base64, use as-is
      }
    }
    return doc.data;
  }

  // Some older versions or custom setups may use `content` or `body`
  if (typeof doc.content === "string" && doc.content.length > 0) return doc.content;
  if (typeof doc.body === "string" && doc.body.length > 0) return doc.body;

  return "";
}

/**
 * Extract the relative path from a LiveSync document.
 */
function extractPath(doc) {
  // `name` is the primary field in LiveSync
  if (typeof doc.name === "string" && doc.name.length > 0) {
    return doc.name.replace(/\\/g, "/");
  }
  // Fall back to `_id` if it looks like a path
  if (typeof doc._id === "string" && doc._id.includes("/")) {
    return doc._id.replace(/\\/g, "/");
  }
  // Last resort: use `_id` + ".md"
  if (typeof doc._id === "string") {
    return `${doc._id}.md`;
  }
  return `untitled-${Date.now()}.md`;
}

/**
 * Fetch all markdown notes from a LiveSync CouchDB database.
 *
 * @param {object} config
 * @param {string} config.url        - CouchDB base URL (e.g. "http://localhost:5984")
 * @param {string} config.dbName     - Database name (e.g. "obsidian-vault")
 * @param {string} [config.username] - Basic auth username
 * @param {string} [config.password] - Basic auth password
 * @returns {Promise<Array<{relativePath: string, content: string, checksum: string, size: number}>>}
 */
async function fetchFromCouchDB(config) {
  const { url, dbName, username, password } = config;
  if (!url || !dbName) {
    throw new Error("CouchDB URL and database name are required");
  }

  let auth = null;
  if (username && password) {
    auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  const docs = await fetchAllDocs(url, dbName, auth);
  const results = [];

  for (const doc of docs) {
    // Only process "note" type documents (skip plugin configs, etc.)
    if (doc.type && doc.type !== "note") continue;
    // Skip if it has no identifiable path or content
    const filePath = extractPath(doc);
    // Only process .md files or paths that look like markdown
    if (!filePath.endsWith(".md") && !filePath.endsWith(".mdx")) continue;

    const content = extractContent(doc);
    if (!content) continue;

    const size = Buffer.byteLength(content, "utf8");
    if (size > MAX_FILE_SIZE) continue;

    results.push({
      relativePath: filePath,
      content,
      checksum: computeChecksum(content),
      size,
    });
  }

  return results;
}

module.exports = { fetchFromCouchDB, fetchAllDocs, extractContent, extractPath };
