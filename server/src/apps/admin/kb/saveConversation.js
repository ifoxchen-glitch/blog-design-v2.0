/**
 * Save AI conversation to KB as a raw .md file.
 * Stored in the Obsidian vault's raw/ai-conversations/ directory,
 * with YAML front matter for metadata.
 */

const fs = require("fs");
const path = require("path");
const { nowIso } = require("../../../utils");

const RAW_DIR = "raw/ai-conversations";

/**
 * Convert a conversation object + messages array into a Markdown file content.
 */
function buildConversationMarkdown(conv, messages) {
  const lines = [
    "---",
    `title: "${escapeYaml(conv.title)}"`,
    `type: source`,
    `model: ${conv.model}`,
    `tags: [${(conv.tags || []).map(t => `"${escapeYaml(t)}"`).join(", ")}]`,
    `created_at: ${conv.created_at}`,
    `conversation_id: ${conv.id}`,
    "---",
    "",
    `# ${escapeYaml(conv.title)}`,
    "",
    "## 对话记录",
    "",
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleString("zh-CN")
      : "";
    lines.push(`**${role}** (${time}):`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

function escapeYaml(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

/**
 * Save a conversation (with its messages) as a .raw file.
 * Returns the file path relative to vault root, or throws on error.
 */
function saveConversationToRaw(conv, messages, vaultPath) {
  if (!vaultPath) throw new Error("Vault path not configured");
  const rawDir = path.join(vaultPath, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });

  // Slug: conversation-title-YYYYMMDD-HHMMSS.md
  const ts = conv.updated_at
    ? new Date(conv.updated_at).toISOString().replace(/[:.]/g, "-").slice(0, 19)
    : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = conv.title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = `${base}-${ts}.md`;
  const filePath = path.join(rawDir, filename);

  const content = buildConversationMarkdown(conv, messages);
  fs.writeFileSync(filePath, "﻿" + content, "utf8"); // BOM for compatibility

  return path.join(RAW_DIR, filename);
}

/**
 * Upsert a KB document record for the saved conversation.
 * This links the .raw file to the KB document system.
 */
function upsertConversationDocument(db, conv, rawFilePath, messages) {
  const now = nowIso();
  const existing = db.prepare(
    "SELECT id FROM kb_documents WHERE original_path = ?"
  ).get(rawFilePath);

  const messageList = Array.isArray(messages) ? messages : [];
  const contentMarkdown = buildConversationMarkdown(conv, messageList);
  const excerpt = messageList
    .filter(m => m.role === "assistant")
    .map(m => m.content)
    .join("\n\n")
    .slice(0, 200);

  if (existing) {
    db.prepare(`
      UPDATE kb_documents SET
        title = ?, excerpt = ?, content_markdown = ?,
        updated_at = ?, doc_date = ?, doc_type = 'source', status = 'active'
      WHERE id = ?
    `).run(conv.title, excerpt, contentMarkdown, now, now, existing.id);
    return existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO kb_documents
        (title, slug, excerpt, content_markdown, source, original_path, tags, doc_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'api', ?, ?, 'source', 'active', ?, ?)
    `).run(
      conv.title,
      conv.title
        .toLowerCase()
        .replace(/[^a-z0-9一-龥]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60) + "-" + Date.now().toString(36),
      excerpt,
      contentMarkdown,
      rawFilePath,
      JSON.stringify(conv.tags || []),
      now,
      now,
    );
    return result.lastInsertRowid;
  }
}

module.exports = {
  saveConversationToRaw,
  upsertConversationDocument,
  RAW_DIR,
};
