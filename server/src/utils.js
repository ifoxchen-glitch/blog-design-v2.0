const slugify = require("slugify");

function nowIso() {
  return new Date().toISOString();
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSlug(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  const slug = slugify(s, { lower: true, strict: true, trim: true });
  // slugify with strict:true strips non-ASCII (e.g. Chinese); fall back to original
  return slug || s.toLowerCase().replace(/\s+/g, "-");
}

function splitTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

module.exports = {
  nowIso,
  toInt,
  normalizeSlug,
  splitTags,
};

