// One-off helper: verify middleware/jwtAuth.js across 3 scenarios
// Usage (from server/): node scripts/check-jwt-auth.js
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-for-jwtAuth-check-only-do-not-use-in-production";
const jwtAuth = require("../src/middleware/jwtAuth");

let pass = true;
function check(label, ok, detail) {
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${detail ? "  -- " + detail : ""}`);
  if (!ok) pass = false;
}

function run(headers) {
  const req = { headers };
  let statusCode = 0;
  let body = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  jwtAuth(req, res, () => {
    nextCalled = true;
  });
  return { req, statusCode, body, nextCalled };
}

const validPayload = {
  userId: 1,
  username: "admin",
  roles: ["super_admin"],
  type: "admin",
};

const validToken = jwt.sign(validPayload, process.env.JWT_SECRET, { expiresIn: "2h" });
const expiredToken = jwt.sign(validPayload, process.env.JWT_SECRET, { expiresIn: "-1s" });

// 1) no token
{
  const r = run({});
  check("no token -> 401", r.statusCode === 401, `code=${r.body && r.body.code}`);
  check("no token -> next NOT called", !r.nextCalled);
}

// 2) malformed Authorization header
{
  const r = run({ authorization: "Token abc" });
  check("malformed header -> 401", r.statusCode === 401, `msg=${r.body && r.body.message}`);
  check("malformed header -> next NOT called", !r.nextCalled);
}

// 3) expired token
{
  const r = run({ authorization: `Bearer ${expiredToken}` });
  check("expired token -> 401", r.statusCode === 401);
  check("expired token -> message says expired", r.body && r.body.message === "Token expired", `msg=${r.body && r.body.message}`);
  check("expired token -> next NOT called", !r.nextCalled);
}

// 4) invalid signature
{
  const tampered = jwt.sign(validPayload, "wrong-secret", { expiresIn: "2h" });
  const r = run({ authorization: `Bearer ${tampered}` });
  check("invalid signature -> 401", r.statusCode === 401);
  check("invalid signature -> message says invalid", r.body && r.body.message === "Invalid token");
  check("invalid signature -> next NOT called", !r.nextCalled);
}

// 5) wrong type claim
{
  const wrongType = jwt.sign({ ...validPayload, type: "front" }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const r = run({ authorization: `Bearer ${wrongType}` });
  check("wrong type -> 401", r.statusCode === 401);
  check("wrong type -> message says invalid type", r.body && r.body.message === "Invalid token type");
}

// 6) valid token
{
  const r = run({ authorization: `Bearer ${validToken}` });
  check("valid token -> next called", r.nextCalled);
  check("valid token -> no status set", r.statusCode === 0);
  check("valid token -> req.user.userId = 1", r.req.user && r.req.user.userId === 1);
  check("valid token -> req.user.username = admin", r.req.user && r.req.user.username === "admin");
  check("valid token -> req.user.roles = [super_admin]", r.req.user && Array.isArray(r.req.user.roles) && r.req.user.roles[0] === "super_admin");
  check("valid token -> req.user.type = admin", r.req.user && r.req.user.type === "admin");
}

// 7) JWT_SECRET missing -> 500
{
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const r = run({ authorization: `Bearer ${validToken}` });
  check("missing JWT_SECRET -> 500", r.statusCode === 500, `code=${r.body && r.body.code}`);
  process.env.JWT_SECRET = saved;
}

console.log("");
console.log(pass ? "PASS: jwtAuth verified across 3 scenarios (no token / expired / valid) plus edge cases." : "FAIL: see [FAIL] entries above.");
process.exit(pass ? 0 : 1);
