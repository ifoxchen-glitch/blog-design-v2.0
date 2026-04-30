const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");

// Conservative allowlist suitable for blog posts rendered from Markdown.
const SANITIZE_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "del",
    "code",
    "pre",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    code: ["class"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

function renderMarkdownToSafeHtml(markdown) {
  const raw = marked.parse(String(markdown ?? ""), {
    gfm: true,
    breaks: false,
  });
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}

module.exports = {
  renderMarkdownToSafeHtml,
};

