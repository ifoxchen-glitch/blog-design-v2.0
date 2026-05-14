/**
 * IoT Card handlers.
 * All card data is persisted locally in SQLite (iot_cards table).
 * Reads/writes from local DB; enable/disable are proxied to the IoT platform.
 */
const { openDb } = require("../../../db");
const { nowIso } = require("../../../utils");
const { getCardInfo, getCardInfoBatch, disableCard, enableCard, getAmount } = require("../../../modules/iotService");

function mapCard(raw) {
  // IoT platform uses 'iccid' as the primary identifier, not 'cardNo'
  return {
    cardNo:        raw.cardNo || raw.iccid,
    msisdn:        raw.msisdn,
    imsi:          raw.imsi,
    iccid:         raw.iccid,
    operator:      raw.operator,
    cardType:      raw.type,
    comboName:     raw.comboName,
    comboResidue:  parseFloat(raw.comboResidue || "0"),
    comboUsed:     parseFloat(raw.comboUsed || "0"),
    comboTotal:    parseFloat(raw.comboTotal || "0"),
    status:        raw.status,
    gprsState:     raw.gprsState,
    onOffStatus:   raw.onOffStatus,
    activatedState: raw.activatedState,
    realPosition:  raw.realPosition || null,
    activationTime: raw.activationTime || null,
    endTime:       raw.endTime || null,
  };
}

// GET /api/v2/admin/iot/cards
async function listCards(req, res) {
  const db = openDb();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "20", 10)));
  const keyword = String(req.query.keyword || "").trim() || null;
  const status = String(req.query.status || "").trim() || null;
  const operator = String(req.query.operator || "").trim() || null;

  const conditions = ["1=1"];
  const params = [];
  if (keyword) {
    conditions.push("(card_no LIKE ? OR msisdn LIKE ? OR iccid LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (status) conditions.push("status = ?"), params.push(status);
  if (operator) conditions.push("operator = ?"), params.push(operator);

  const where = conditions.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS c FROM iot_cards WHERE ${where}`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(`SELECT * FROM iot_cards WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  const items = rows.map((r) => ({
    cardNo:        r.card_no,
    msisdn:        r.msisdn,
    imsi:          r.imsi,
    iccid:         r.iccid,
    operator:      r.operator,
    cardType:      r.card_type,
    comboName:     r.combo_name,
    comboResidue:  r.combo_residue,
    comboUsed:     r.combo_used,
    comboTotal:    r.combo_total,
    status:        r.status,
    gprsState:     r.gprs_state,
    onOffStatus:   r.on_off_status,
    activatedState: r.activated_state,
    realPosition:  r.real_position,
    activationTime: r.activation_time,
    endTime:       r.end_time,
  }));

  return res.status(200).json({ code: 200, message: "success", data: { items, total, page, pageSize } });
}

// GET /api/v2/admin/iot/cards/:cardNo
async function getCard(req, res) {
  const { cardNo } = req.params;
  const db = openDb();
  const row = db.prepare(`SELECT * FROM iot_cards WHERE card_no = ?`).get(cardNo);
  if (!row) return res.status(404).json({ code: 404, message: "Card not found" });

  const data = {
    cardNo:        row.card_no,
    msisdn:        row.msisdn,
    imsi:          row.imsi,
    iccid:         row.iccid,
    operator:      row.operator,
    cardType:      row.card_type,
    comboName:     row.combo_name,
    comboResidue:  row.combo_residue,
    comboUsed:     row.combo_used,
    comboTotal:    row.combo_total,
    status:        row.status,
    gprsState:     row.gprs_state,
    onOffStatus:   row.on_off_status,
    activatedState: row.activated_state,
    realPosition:  row.real_position,
    activationTime: row.activation_time,
    endTime:       row.end_time,
  };
  return res.status(200).json({ code: 200, message: "success", data });
}

// POST /api/v2/admin/iot/cards/sync
async function syncCards(req, res) {
  const db = openDb();
  const now = nowIso();

  // Read all card numbers from local DB to batch query
  const rows = db.prepare(`SELECT card_no FROM iot_cards`).all();
  if (rows.length === 0) {
    return res.status(200).json({ code: 200, message: "No cards to sync", data: { cardCount: 0 } });
  }

  const cardNos = rows.map((r) => r.card_no);
  let result;
  try {
    result = await getCardInfoBatch(cardNos);
  } catch (e) {
    db.prepare(`INSERT INTO iot_sync_logs (synced_at, card_count, result) VALUES (?, 0, ?)`).run(now, String(e.message));
    return res.status(503).json({ code: 503, message: "IoT platform error: " + e.message });
  }

  const allCards = Array.isArray(result.data) ? result.data : [];
  // Filter out cards without an identifier (iccid or cardNo) to satisfy NOT NULL constraint
  const cards = allCards.filter((c) => c?.iccid || c?.cardNo);
  const upsert = db.prepare(`
    INSERT INTO iot_cards (card_no, msisdn, imsi, iccid, operator, card_type, combo_name,
      combo_residue, combo_used, combo_total, status, gprs_state, on_off_status,
      activated_state, real_position, activation_time, end_time, created_at, updated_at)
    VALUES (@card_no, @msisdn, @imsi, @iccid, @operator, @card_type, @combo_name,
      @combo_residue, @combo_used, @combo_total, @status, @gprs_state, @on_off_status,
      @activated_state, @real_position, @activation_time, @end_time, @created_at, @updated_at)
    ON CONFLICT(card_no) DO UPDATE SET
      msisdn=excluded.msisdn, imsi=excluded.imsi, iccid=excluded.iccid,
      operator=excluded.operator, card_type=excluded.card_type, combo_name=excluded.combo_name,
      combo_residue=excluded.combo_residue, combo_used=excluded.combo_used,
      combo_total=excluded.combo_total, status=excluded.status,
      gprs_state=excluded.gprs_state, on_off_status=excluded.on_off_status,
      activated_state=excluded.activated_state, real_position=excluded.real_position,
      activation_time=excluded.activation_time, end_time=excluded.end_time,
      updated_at=excluded.updated_at
  `);

  const upsertMany = db.transaction((cards) => {
    for (const c of cards) {
      const mapped = mapCard(c);
      upsert.run({
        card_no:        mapped.cardNo,
        msisdn:         mapped.msisdn,
        imsi:           mapped.imsi,
        iccid:          mapped.iccid,
        operator:       mapped.operator,
        card_type:      mapped.cardType,
        combo_name:     mapped.comboName,
        combo_residue:  mapped.comboResidue,
        combo_used:     mapped.comboUsed,
        combo_total:    mapped.comboTotal,
        status:         mapped.status,
        gprs_state:     mapped.gprsState,
        on_off_status:  mapped.onOffStatus,
        activated_state: mapped.activatedState,
        real_position:  mapped.realPosition,
        activation_time: mapped.activationTime,
        end_time:       mapped.endTime,
        created_at:     now,
        updated_at:     now,
      });
    }
  });

  upsertMany(cards);
  db.prepare(`INSERT INTO iot_sync_logs (synced_at, card_count, result) VALUES (?, ?, 'ok')`).run(now, cards.length);

  return res.status(200).json({ code: 200, message: "success", data: { cardCount: cards.length } });
}

// POST /api/v2/admin/iot/cards/batch
async function batchCards(req, res) {
  const { cardNos } = req.body;
  if (!Array.isArray(cardNos) || cardNos.length === 0) {
    return res.status(400).json({ code: 400, message: "cardNos must be a non-empty array (max 1000)" });
  }
  if (cardNos.length > 1000) {
    return res.status(400).json({ code: 400, message: "Maximum 1000 cards per batch query" });
  }

  let result;
  try {
    result = await getCardInfoBatch(cardNos);
  } catch (e) {
    return res.status(503).json({ code: 503, message: "IoT platform error: " + e.message });
  }

  console.log("[IoT] batchCards raw response:", JSON.stringify(result).substring(0, 800));

  const db = openDb();
  const now = nowIso();
  // opsli-boot may wrap list in result.data.records or result.data.list
  const rawList =
    Array.isArray(result.data) ? result.data :
    Array.isArray(result.data?.records) ? result.data.records :
    Array.isArray(result.data?.list) ? result.data.list :
    [];
  const allCards = rawList;
  // Filter out cards without an identifier (iccid or cardNo) to satisfy NOT NULL constraint
  const cards = allCards.filter((c) => c?.iccid || c?.cardNo);
  const upsert = db.prepare(`
    INSERT INTO iot_cards (card_no, msisdn, imsi, iccid, operator, card_type, combo_name,
      combo_residue, combo_used, combo_total, status, gprs_state, on_off_status,
      activated_state, real_position, activation_time, end_time, created_at, updated_at)
    VALUES (@card_no, @msisdn, @imsi, @iccid, @operator, @card_type, @combo_name,
      @combo_residue, @combo_used, @combo_total, @status, @gprs_state, @on_off_status,
      @activated_state, @real_position, @activation_time, @end_time, @created_at, @updated_at)
    ON CONFLICT(card_no) DO UPDATE SET
      msisdn=excluded.msisdn, imsi=excluded.imsi, iccid=excluded.iccid,
      operator=excluded.operator, card_type=excluded.card_type, combo_name=excluded.combo_name,
      combo_residue=excluded.combo_residue, combo_used=excluded.combo_used,
      combo_total=excluded.combo_total, status=excluded.status,
      gprs_state=excluded.gprs_state, on_off_status=excluded.on_off_status,
      activated_state=excluded.activated_state, real_position=excluded.real_position,
      activation_time=excluded.activation_time, end_time=excluded.end_time,
      updated_at=excluded.updated_at
  `);

  const upsertMany = db.transaction((cards) => {
    for (const c of cards) {
      const mapped = mapCard(c);
      upsert.run({
        card_no:        mapped.cardNo,
        msisdn:         mapped.msisdn,
        imsi:           mapped.imsi,
        iccid:          mapped.iccid,
        operator:       mapped.operator,
        card_type:      mapped.cardType,
        combo_name:     mapped.comboName,
        combo_residue:  mapped.comboResidue,
        combo_used:     mapped.comboUsed,
        combo_total:    mapped.comboTotal,
        status:         mapped.status,
        gprs_state:     mapped.gprsState,
        on_off_status:  mapped.onOffStatus,
        activated_state: mapped.activatedState,
        real_position:  mapped.realPosition,
        activation_time: mapped.activationTime,
        end_time:       mapped.endTime,
        created_at:     now,
        updated_at:     now,
      });
    }
  });

  upsertMany(cards);

  return res.status(200).json({
    code: 200,
    message: "success",
    data: { items: cards.map(mapCard), total: cards.length },
  });
}

// GET /api/v2/admin/iot/cards/balance
async function getBalance(req, res) {
  try {
    const result = await getAmount();
    return res.status(200).json({
      code: 200,
      message: "success",
      data: { amount: result.data?.amount ?? "0" },
    });
  } catch (e) {
    return res.status(503).json({ code: 503, message: "Failed to query balance: " + e.message });
  }
}

// PUT /api/v2/admin/iot/cards/:cardNo/disable
async function disableCardHandler(req, res) {
  const { cardNo } = req.params;
  try {
    const result = await disableCard(cardNo);
    if (result.code !== 0) {
      return res.status(400).json({ code: result.code, message: result.msg || "Disable failed" });
    }
    return res.status(200).json({ code: 200, message: result.msg || "Card disabled", data: { cardNo } });
  } catch (e) {
    return res.status(503).json({ code: 503, message: "IoT platform error: " + e.message });
  }
}

// PUT /api/v2/admin/iot/cards/:cardNo/enable
async function enableCardHandler(req, res) {
  const { cardNo } = req.params;
  try {
    const result = await enableCard(cardNo);
    if (result.code !== 0) {
      return res.status(400).json({ code: result.code, message: result.msg || "Enable failed" });
    }
    return res.status(200).json({ code: 200, message: result.msg || "Card enabled", data: { cardNo } });
  } catch (e) {
    return res.status(503).json({ code: 503, message: "IoT platform error: " + e.message });
  }
}

module.exports = {
  listCards,
  getCard,
  syncCards,
  batchCards,
  getBalance,
  disableCard: disableCardHandler,
  enableCard: enableCardHandler,
};