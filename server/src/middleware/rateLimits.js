/**
 * Rate limit middleware for production.
 *
 * - loginLimiter  : 10 requests / minute / IP (auth endpoints)
 * - generalLimiter: 300 requests / minute / IP (all other API routes)
 *
 * Uses express-rate-limit with in-memory store (single-process,
 * acceptable for blog-scale traffic).
 */

const rateLimit = require("express-rate-limit");

const MINUTE = 60 * 1000;

/**
 * Strict limiter for login endpoints (prevent brute-force).
 * 10 attempts per minute per IP.
 */
const loginLimiter = rateLimit({
  windowMs: MINUTE,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "请求过于频繁，请 1 分钟后再试" },
});

/**
 * General API limiter.
 * 300 requests per minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: MINUTE,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "请求过于频繁，请稍后再试" },
});

module.exports = { loginLimiter, generalLimiter };
