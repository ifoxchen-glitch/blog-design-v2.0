/**
 * IoT platform token manager.
 * Caches the access token returned in response header "token" from POST /auth/login.
 * Auto-refreshes 2 minutes before the 15-minute expiry.
 * Reads credentials from system_settings DB table.
 */
const axios = require("axios");
const { openDb } = require("../db");

let _token = null;
let _expiresAt = null;

function getIotConfig() {
  const db = openDb();
  const settings = db.prepare("SELECT * FROM system_settings WHERE id = 1").get();
  return {
    baseUrl: settings?.iot_api_base_url || "",
    appId: settings?.iot_app_id || "",
    appSecret: settings?.iot_app_secret || "",
  };
}

async function getIotToken() {
  const { baseUrl, appId, appSecret } = getIotConfig();
  if (!baseUrl) {
    throw new Error("IoT platform not configured (set in 系统设置)");
  }
  if (!appId || !appSecret) {
    throw new Error("IoT platform credentials not configured");
  }

  const now = Date.now();
  if (!_token || !_expiresAt || now >= _expiresAt - 120_000) {
    await refreshToken();
  }
  return _token;
}

async function refreshToken() {
  const { baseUrl, appId, appSecret } = getIotConfig();

  const loginUrl = `${baseUrl}/auth/login`;
  console.log("[IoT] Refreshing token from:", loginUrl);
  console.log("[IoT] appId:", appId, "secretLen:", appSecret?.length);

  const res = await axios.post(loginUrl, {
    appId,
    appSecret,
    ts: String(Date.now()),
  });

  console.log("[IoT] auth response status:", res.status);
  console.log("[IoT] auth response data:", JSON.stringify(res.data).substring(0, 500));
  console.log("[IoT] auth response headers token:", res.headers?.token);

  // Try multiple locations: body.data.accessToken, body.data.token, header token
  const token =
    res.data?.data?.accessToken ||
    res.data?.data?.token ||
    res.headers?.token;

  if (!token) {
    throw new Error(
      `IoT platform returned no token. body=${JSON.stringify(res.data).substring(0, 200)}`
    );
  }

  _token = token;
  _expiresAt = Date.now() + 15 * 60 * 1000;
  console.log("[IoT] Token refreshed (len=" + token.length + "), expires at", new Date(_expiresAt).toISOString());
}

async function forceRefresh() {
  _token = null;
  _expiresAt = null;
  return getIotToken();
}

module.exports = { getIotToken, forceRefresh };