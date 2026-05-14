/**
 * IoT platform service layer.
 * Wraps all IoT API calls with token injection and response normalization.
 */
const axios = require("axios");
const { optional } = require("../env");
const { getIotToken } = require("./iotToken");

function buildClient() {
  const baseURL = optional("IOT_API_BASE_URL") || "";
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

// ----- Auth -----
async function fetchToken() {
  const baseUrl = optional("IOT_API_BASE_URL");
  const appId = optional("IOT_APP_ID");
  const appSecret = optional("IOT_APP_SECRET");
  if (!baseUrl || !appId || !appSecret) {
    throw new Error("IOT platform credentials not configured");
  }
  const res = await axios.post(`${baseUrl}/auth/login`, {
    appId,
    appSecret,
    ts: Date.now(),
  });
  return res.headers["token"];
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