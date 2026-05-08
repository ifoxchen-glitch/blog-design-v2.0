const yaml = require("js-yaml");

/**
 * Parse YAML front matter from markdown content.
 * @param {string} content - Full file content
 * @returns {{ attributes: Object, body: string }}
 */
function parseFrontMatter(content) {
  if (typeof content !== "string") return { attributes: {}, body: "" };

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { attributes: {}, body: content };
  }

  const yamlStr = match[1];
  const body = content.slice(match[0].length);

  try {
    const data = yaml.load(yamlStr);
    return {
      attributes: (data && typeof data === "object" && !Array.isArray(data)) ? data : {},
      body,
    };
  } catch {
    return { attributes: {}, body: content };
  }
}

/**
 * Build YAML front matter string from attributes object, then append body.
 * Known keys are ordered first; extra keys follow alphabetically.
 * @param {Object} attributes
 * @param {string} body
 * @returns {string} Full document content with YAML front matter + body
 */
function buildFrontMatter(attributes, body) {
  const knownKeys = ["title", "type", "tags", "connections", "sources", "last_updated", "status"];
  const written = new Set();
  const lines = [];

  for (const k of knownKeys) {
    const v = attributes[k];
    if (v === undefined || v === null || v === "") continue;
    written.add(k);
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      const items = v.map(i => String(i).includes(" ") ? `"${i}"` : String(i)).join(", ");
      lines.push(`${k}: [${items}]`);
    } else if (typeof v === "string" && /[:\-\[\]]/.test(v)) {
      lines.push(`${k}: "${v}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }

  // Extra keys (not in known set)
  for (const k of Object.keys(attributes).sort()) {
    if (written.has(k)) continue;
    const v = attributes[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.join(", ")}]`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }

  if (lines.length === 0) return body || "";
  return `---\n${lines.join("\n")}\n---\n${body || ""}`;
}

module.exports = { parseFrontMatter, buildFrontMatter };
