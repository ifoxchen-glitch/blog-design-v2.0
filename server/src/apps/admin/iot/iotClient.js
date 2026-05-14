/**
 * IoT Platform API Client
 * Manages appId/appSecret, auto-refreshes token every 14 minutes.
 */

const https = require("https");
const http = require("http");
const { optional } = require("../../env");

let tokenCache = null; // { token, expireTime, fetchedAt }

const IOT_API_BASE_URL = optional("IOT_API_BASE_URL", "");
const IOT_APP_ID = optional("IOT_APP_ID", "");
const IOT_APP_SECRET = optional("IOT_APP_SECRET", "");

// Token validity: 15 minutes, refresh at 14 minutes
const TOKEN_TTL_MS = 14 * 60 * 1000;

function getTokenInfo() {
  return tokenCache;
}

async function login() {
  const ts = Date.now();
  const body = JSON.stringify({ appId: IOT_APP_ID, appSecret: IOT_APP_SECRET, ts });

  const parsedUrl = new URL(IOT_API_BASE_URL + "/auth/login");
  const isHttps = parsedUrl.protocol === "https:";
  const mod = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.code !== 200 || !json.data?.accessToken) {
              return reject(new Error(json.msg || "IoT login failed"));
            }
            tokenCache = {
              token: json.data.accessToken,
              expireTime: json.data.expireTime,
              fetchedAt: Date.now(),
            };
            resolve(tokenCache);
          } catch (e) {
            reject(new Error("Invalid IoT login response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy());
    req.write(body);
    req.end();
  });
}

async function ensureToken() {
  if (!tokenCache) return login();
  const elapsed = Date.now() - tokenCache.fetchedAt;
  if (elapsed >= TOKEN_TTL_MS) return login();
  return tokenCache;
}

/**
 * Fetch from IoT platform with current token.
 * @param {string} endpoint — e.g. "/v1/external/card/getCardInfo"
 * @param {object} params — request body params
 * @param {string} [method='POST']
 */
async function fetchIot(endpoint, params, method = "POST") {
  const { token } = await ensureToken();
  const body = JSON.stringify(params);

  const parsedUrl = new URL(IOT_API_BASE_URL + endpoint);
  const isHttps = parsedUrl.protocol === "https:";
  const mod = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          token,
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid IoT response JSON"));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy());
    req.write(body);
    req.end();
  });
}

module.exports = { fetchIot, ensureToken, login, getTokenInfo };