/**
 * IoT Card Handlers
 * All functions query the IoT platform API, upsert results into local SQLite.
 */

const { openDb } = require("../../../db");
const { nowIso, toInt } = require("../../../utils");
const { fetchIot } = require("./iotClient");

function pickCard(row) {
  return {
    id: row.id,
    iccid: row.iccid,
    msisdn: row.msisdn || "",
    imsi: row.imsi || "",
    operator: row.operator || "",
    cardType: row.card_type || "",
    comboName: row.combo_name || "",
    comboResidue: row.combo_residue || 0,
    comboUsed: row.combo_used || 0,
    comboTotal: row.combo_total || 0,
    periodValidity: row.period_validity || "",
    status: row.status || "",
    gprsState: row.gprs_state || "",
    onOffStatus: row.on_off_status || "",
    activatedState: row.activated_state || "",
    realPosition: row.real_position || "",
    activationTime: row.activation_time || "",
    endTime: row.end_time || "",
    remarks: row.remarks || "",
    lastSyncTime: row.last_sync_time || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function upsertCard(cardData, db) {
  const now = nowIso();
  const {
    iccid,
    msisdn = "",
    imsi = "",
    operator = "",
    cardType = "",
    comboName = "",
    comboResidue = 0,
    comboUsed = 0,
    comboTotal = 0,
    periodValidity = "",
    status = "",
    gprsState = "",
    onOffStatus = "",
    activatedState = "",
    realPosition = "",
    activationTime = "",
    endTime = "",
  } = cardData;

  const existing = db.prepare(`SELECT id FROM iot_cards WHERE iccid = ?`).get(iccid);
  if (existing) {
    db.prepare(`
      UPDATE iot_cards SET
        msisdn=?, imsi=?, operator=?, card_type=?, combo_name=?,
        combo_residue=?, combo_used=?, combo_total=?, period_validity=?,
        status=?, gprs_state=?, on_off_status=?, activated_state=?,
        real_position=?, activation_time=?, end_time=?, last_sync_time=?, updated_at=?
      WHERE iccid=?
    `).run(
      msisdn, imsi, operator, cardType, comboName,
      comboResidue, comboUsed, comboTotal, periodValidity,
      status, gprsState, onOffStatus, activatedState,
      realPosition, activationTime, endTime, now, now, iccid
    );
    return db.prepare(`SELECT * FROM iot_cards WHERE iccid=?`).get(iccid);
  } else {
    const info = db.prepare(`
      INSERT INTO iot_cards (
        iccid, msisdn, imsi, operator, card_type, combo_name,
        combo_residue, combo_used, combo_total, period_validity,
        status, gprs_state, on_off_status, activated_state,
        real_position, activation_time, end_time, last_sync_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      iccid, msisdn, imsi, operator, cardType, comboName,
      comboResidue, comboUsed, comboTotal, periodValidity,
      status, gprsState, onOffStatus, activatedState,
      realPosition, activationTime, endTime, now, now, now
    );
    return db.prepare(`SELECT * FROM iot_cards WHERE id=?`).get(info.lastInsertRowid);
  }
}

// GET /api/v2/admin/iot/cards — list local cards with pagination
function listCards(req, res) {
  const db = openDb();
  const page = Math.max(1, toInt(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)));
  const offset = (page - 1) * pageSize;
  const keyword = req.query.keyword || "";

  let where = "";
  let countSql = "SELECT COUNT(*) AS c FROM iot_cards";
  let rowsSql = `SELECT * FROM iot_cards`;
  let params = [];

  if (keyword) {
    where = " WHERE iccid LIKE ? OR msisdn LIKE ? OR imsi LIKE ?";
    const kw = `%${keyword}%`;
    countSql += where;
    rowsSql += where;
    params = [kw, kw, kw];
  }

  rowsSql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  const total = db.prepare(countSql).get(...params)?.c || 0;
  const rows = db.prepare(rowsSql).all(...params, pageSize, offset);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items: rows.map(pickCard), total, page, pageSize },
  });
}

// GET /api/v2/admin/iot/cards/:id — single card detail
function getCard(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const row = db.prepare(`SELECT * FROM iot_cards WHERE id=?`).get(id);
  if (!row) return res.status(404).json({ code: 404, message: "Card not found" });

  return res.status(200).json({ code: 200, message: "success", data: pickCard(row) });
}

// POST /api/v2/admin/iot/card/query — query single card from IoT platform, upsert local
async function queryCard(req, res) {
  const { cardNo } = req.body || {};
  if (!cardNo) return res.status(400).json({ code: 400, message: "cardNo required" });

  try {
    const iotRes = await fetchIot("/v1/external/card/getCardInfo", { cardNo });
    if (iotRes.code !== 0) {
      return res.status(400).json({ code: iotRes.code || 400, message: iotRes.msg || "Query failed" });
    }

    const db = openDb();
    const cardData = iotRes.data || {};
    cardData.iccid = cardNo;
    const row = upsertCard(cardData, db);
    return res.status(200).json({ code: 200, message: "success", data: pickCard(row) });
  } catch (e) {
    console.error("[iot] queryCard error:", e.message);
    return res.status(502).json({ code: 502, message: "IoT platform error: " + e.message });
  }
}

// POST /api/v2/admin/iot/card/batch — batch query, upsert each to local
async function batchQueryCards(req, res) {
  const { cardNos = [] } = req.body || {};
  if (!cardNos.length) return res.status(400).json({ code: 400, message: "cardNos required" });
  if (cardNos.length > 1000) return res.status(400).json({ code: 400, message: "Max 1000 cards per batch" });

  try {
    const iotRes = await fetchIot("/v1/external/card/getCardInfoBatch", { cardNos });
    if (iotRes.code !== 0) {
      return res.status(400).json({ code: iotRes.code || 400, message: iotRes.msg || "Batch query failed" });
    }

    const db = openDb();
    const items = Array.isArray(iotRes.data) ? iotRes.data : [];
    const rows = [];
    const tx = db.transaction(() => {
      for (const cardData of items) {
        rows.push(upsertCard(cardData, db));
      }
    });
    tx();

    return res.status(200).json({ code: 200, message: "success", data: rows.map(pickCard) });
  } catch (e) {
    console.error("[iot] batchQuery error:", e.message);
    return res.status(502).json({ code: 502, message: "IoT platform error: " + e.message });
  }
}

// GET /api/v2/admin/iot/balance — account balance
async function getBalance(req, res) {
  try {
    const iotRes = await fetchIot("/v1/external/customer/getAmount", {});
    if (iotRes.code !== 0) {
      return res.status(400).json({ code: iotRes.code || 400, message: iotRes.msg || "Query failed" });
    }
    const amount = Array.isArray(iotRes.data) ? iotRes.data[0]?.amount : null;
    return res.status(200).json({ code: 200, message: "success", data: { amount } });
  } catch (e) {
    console.error("[iot] getBalance error:", e.message);
    return res.status(502).json({ code: 502, message: "IoT platform error: " + e.message });
  }
}

// POST /api/v2/admin/iot/card/disable — card network disable (断网)
async function disableCard(req, res) {
  const { cardNo } = req.body || {};
  if (!cardNo) return res.status(400).json({ code: 400, message: "cardNo required" });

  try {
    const iotRes = await fetchIot("/v1/external/card/disable", { cardNo });
    if (iotRes.code !== 0) {
      return res.status(400).json({ code: iotRes.code || 400, message: iotRes.msg || "Disable failed" });
    }
    return res.status(200).json({ code: 200, message: "success", data: true });
  } catch (e) {
    console.error("[iot] disableCard error:", e.message);
    return res.status(502).json({ code: 502, message: "IoT platform error: " + e.message });
  }
}

// POST /api/v2/admin/iot/card/enable — card network enable (恢复)
async function enableCard(req, res) {
  const { cardNo } = req.body || {};
  if (!cardNo) return res.status(400).json({ code: 400, message: "cardNo required" });

  try {
    const iotRes = await fetchIot("/v1/external/card/enabled", { cardNo });
    if (iotRes.code !== 0) {
      return res.status(400).json({ code: iotRes.code || 400, message: iotRes.msg || "Enable failed" });
    }
    return res.status(200).json({ code: 200, message: "success", data: true });
  } catch (e) {
    console.error("[iot] enableCard error:", e.message);
    return res.status(502).json({ code: 502, message: "IoT platform error: " + e.message });
  }
}

// PUT /api/v2/admin/iot/card/:id — update card remarks
function updateCard(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare(`SELECT id FROM iot_cards WHERE id=?`).get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Card not found" });

  const { remarks } = req.body || {};
  const now = nowIso();
  db.prepare(`UPDATE iot_cards SET remarks=?, updated_at=? WHERE id=?`).run(remarks || "", now, id);

  const row = db.prepare(`SELECT * FROM iot_cards WHERE id=?`).get(id);
  return res.status(200).json({ code: 200, message: "success", data: pickCard(row) });
}

// DELETE /api/v2/admin/iot/card/:id — remove from local
function deleteCard(req, res) {
  const db = openDb();
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ code: 400, message: "Invalid id" });

  const existing = db.prepare(`SELECT id FROM iot_cards WHERE id=?`).get(id);
  if (!existing) return res.status(404).json({ code: 404, message: "Card not found" });

  db.prepare(`DELETE FROM iot_cards WHERE id=?`).run(id);
  return res.status(200).json({ code: 200, message: "success" });
}

module.exports = {
  listCards,
  getCard,
  queryCard,
  batchQueryCards,
  getBalance,
  disableCard,
  enableCard,
  updateCard,
  deleteCard,
};