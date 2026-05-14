/**
 * IoT platform token manager.
 * Caches the access token returned in response header "token" from POST /auth/login.
 * Auto-refreshes 2 minutes before the 15-minute expiry.
 */
const axios = require("axios");
const { optional } = require("../env");

let _token = null;
let _expiresAt = null;

async function getIotToken() {
  const baseUrl = optional("IOT_API_BASE_URL");
  if (!baseUrl) {
    throw new Error("IOT_API_BASE_URL is not configured");
  }

  const now = Date.now();
  // Refresh if missing or expires within 2 minutes
  if (!_token || !_expiresAt || now >= _expiresAt - 120_000) {
    await refreshToken();
  }
  return _token;
}

async function refreshToken() {
  const axios = require("axios");
  const baseUrl = optional("IOT_API_BASE_URL");
  const appId = optional("IOT_APP_ID");
  const appSecret = optional("IOT_APP_SECRET");

  if (!baseUrl || !appId || !appSecret) {
    throw new Error("IoT platform credentials not configured (IOT_API_BASE_URL, IOT_APP_ID, IOT_APP_SECRET)");
  }

  const res = await axios.post(`${baseUrl}/auth/login`, {
    appId,
    appSecret,
    ts: Date.now(),
  });

  const token = res.headers["token"];
  if (!token) {
    throw new Error("IoT platform returned no token in response header");
  }

  _token = token;
  // Set expiry to now + 15 minutes (per spec)
  _expiresAt = Date.now() + 15 * 60 * 1000;
  console.log("[IoT] Token refreshed, expires at", new Date(_expiresAt).toISOString());
}

async function forceRefresh() {
  _token = null;
  _expiresAt = null;
  return getIotToken();
}

module.exports = { getIotToken, forceRefresh };