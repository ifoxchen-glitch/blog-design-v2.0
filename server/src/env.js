function required(name, fallback) {
  const v = process.env[name];
  if (!v && fallback === undefined) throw new Error(`Missing required env var: ${name}`);
  return v ?? fallback;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v ?? fallback;
}

module.exports = {
  required,
  optional,
};