/**
 * IoT platform service layer.
 * Wraps all IoT API calls with token injection and response normalization.
 */
const axios = require("axios");
const { openDb } = require("../db");
const { getIotToken } = require("./iotToken");

function getIotBaseUrl() {
  const db = openDb();
  const settings = db.prepare("SELECT iot_api_base_url FROM system_settings WHERE id = 1").get();
  // Strip trailing slash so axios baseURL + path doesn't produce double slashes
  return (settings?.iot_api_base_url || "").replace(/\/+$/, "");
}

function buildClient() {
  const baseURL = getIotBaseUrl();
  const instance = axios.create({ baseURL, timeout: 10_000 });

  instance.interceptors.request.use(async (config) => {
    const token = await getIotToken();
    config.headers["token"] = token;
    return config;
  });

  return instance;
}

// Normalize IoT platform response to internal format
// IoT returns { code: 0, msg: "string", data: {...} }
function normalizeResponse(iotRes) {
  return iotRes.data;
}

async function iotGet(path, params) {
  const client = buildClient();
  const res = await client.get(path, { params });
  return normalizeResponse(res);
}

async function iotPost(path, data) {
  const client = buildClient();
  const bodyStr = JSON.stringify(data);
  console.log("[IoT] POST", path, "body:", bodyStr.substring(0, 400));
  try {
    const res = await client.post(path, data, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    console.log("[IoT] response:", JSON.stringify(res.data).substring(0, 300));
    return normalizeResponse(res);
  } catch (e) {
    const reqBody = e.config?.data ? JSON.stringify(e.config.data).substring(0, 400) : 'unknown';
    const detail = e.response?.data ? JSON.stringify(e.response.data).substring(0, 500) : e.message;
    console.error("[IoT] POST error:", path, "reqBody:", reqBody, "res:", detail);
    throw e;
  }
}

// ----- Card -----
async function getCardInfo(cardNo) {
  return iotPost("/v1/external/card/getCardInfo", { cardNo });
}

async function getCardInfoBatch(cardNos) {
  return iotPost("/v1/external/card/getCardInfoBatch", { cardNos });
}

async function disableCard(cardNo) {
  return iotPost("/v1/external/card/disable", { cardNo });
}

async function enableCard(cardNo) {
  return iotPost("/v1/external/card/enabled", { cardNo });
}

// ----- Balance -----
async function getAmount() {
  return iotPost("/v1/external/customer/getAmount", {});
}

module.exports = {
  getCardInfo,
  getCardInfoBatch,
  disableCard,
  enableCard,
  getAmount,
};