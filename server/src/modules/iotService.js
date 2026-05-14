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
  const res = await client.post(path, data);
  return normalizeResponse(res);
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