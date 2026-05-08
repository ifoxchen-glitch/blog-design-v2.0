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

module.exports = { parseFrontMatter };
