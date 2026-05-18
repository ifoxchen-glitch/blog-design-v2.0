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
 * Uses js-yaml.dump() for proper escaping of special characters.
 * Known keys are ordered first; extra keys follow in their original order.
 * @param {Object} attributes
 * @param {string} body
 * @returns {string} Full document content with YAML front matter + body
 */
function buildFrontMatter(attributes, body) {
  const knownKeys = ["title", "type", "tags", "connections", "sources", "excerpt", "description", "category", "last_updated", "status"];

  // Build ordered attrs object: known keys first, then extra keys
  const orderedAttrs = {};
  const written = new Set();

  for (const k of knownKeys) {
    const v = attributes[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    orderedAttrs[k] = v;
    written.add(k);
  }

  // Preserve extra (unknown) keys in their original order
  for (const k of Object.keys(attributes)) {
    if (written.has(k)) continue;
    const v = attributes[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    orderedAttrs[k] = v;
  }

  if (Object.keys(orderedAttrs).length === 0) return body || "";

  const yamlStr = yaml.dump(orderedAttrs, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  return `---\n${yamlStr}---\n${body || ""}`;
}

module.exports = { parseFrontMatter, buildFrontMatter };
