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
    imei:          raw.imei,
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
  const region = String(req.query.region || "").trim() || null;
  const combo = String(req.query.combo || "").trim() || null;
  const sortKey = String(req.query.sortKey || "").trim() || null;
  const sortOrder = String(req.query.sortOrder || "").trim() || 'desc';

  const conditions = ["1=1"];
  const params = [];
  if (keyword) {
    conditions.push("(card_no LIKE ? OR msisdn LIKE ? OR iccid LIKE ?)");
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (status) conditions.push("status = ?"), params.push(status);
  if (operator) conditions.push("operator = ?"), params.push(operator);
  if (region) conditions.push("real_position LIKE ?"), params.push(`%${region}%`);
  if (combo) conditions.push("combo_name LIKE ?"), params.push(`%${combo}%`);

  const where = conditions.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS c FROM iot_cards WHERE ${where}`).get(...params).c;
  const offset = (page - 1) * pageSize;

  // Sorting
  const allowedSortKeys = ['card_no', 'combo_used', 'combo_residue', 'combo_total', 'end_time', 'real_position', 'combo_name'];
  const orderBy = allowedSortKeys.includes(sortKey)
    ? `${sortKey} ${sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC'}`
    : 'id DESC';

  const rows = db
    .prepare(`SELECT * FROM iot_cards WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  const items = rows.map((r) => ({
    cardNo:        r.card_no,
    msisdn:        r.msisdn,
    imsi:          r.imsi,
    iccid:         r.iccid,
    imei:          r.imei || null,
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

  // Also fetch the latest raw JSON from the last sync
  const rawRow = db.prepare(`SELECT raw_json, synced_at FROM iot_card_raw WHERE card_no = ?`).get(cardNo);

  const data = {
    cardNo:        row.card_no,
    msisdn:        row.msisdn,
    imsi:          row.imsi,
    iccid:         row.iccid,
    imei:          row.imei || null,
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
    rawJson:       rawRow?.raw_json ? JSON.parse(rawRow.raw_json) : null,
    syncedAt:      rawRow?.synced_at || null,
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

  console.log(`[IoT] syncCards: ${rows.length} cards in local DB`);

  const cardNos = rows.map((r) => String(r.card_no));

  // Raw JSON upsert — stores the full API response for each card
  const upsertRaw = db.prepare(`
    INSERT INTO iot_card_raw (card_no, raw_json, synced_at)
    VALUES (@card_no, @raw_json, @synced_at)
    ON CONFLICT(card_no) DO UPDATE SET raw_json=excluded.raw_json, synced_at=excluded.synced_at
  `);

  // Query each card individually to avoid IoT platform DB corruption errors
  // from hitting a single bad row in batch mode
  const upsert = db.prepare(`
    INSERT INTO iot_cards (card_no, msisdn, imsi, iccid, imei, operator, card_type, combo_name,
      combo_residue, combo_used, combo_total, status, gprs_state, on_off_status,
      activated_state, real_position, activation_time, end_time, created_at, updated_at)
    VALUES (@card_no, @msisdn, @imsi, @iccid, @imei, @operator, @card_type, @combo_name,
      @combo_residue, @combo_used, @combo_total, @status, @gprs_state, @on_off_status,
      @activated_state, @real_position, @activation_time, @end_time, @created_at, @updated_at)
    ON CONFLICT(card_no) DO UPDATE SET
      msisdn=excluded.msisdn, imsi=excluded.imsi, iccid=excluded.iccid, imei=excluded.imei,
      operator=excluded.operator, card_type=excluded.card_type, combo_name=excluded.combo_name,
      combo_residue=excluded.combo_residue, combo_used=excluded.combo_used,
      combo_total=excluded.combo_total, status=excluded.status,
      gprs_state=excluded.gprs_state, on_off_status=excluded.on_off_status,
      activated_state=excluded.activated_state, real_position=excluded.real_position,
      activation_time=excluded.activation_time, end_time=excluded.end_time,
      updated_at=excluded.updated_at
  `);

  let successCount = 0;
  let failCount = 0;
  for (const cardNo of cardNos) {
    try {
      const result = await getCardInfo(cardNo);
      const cards = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      const card = cards.find((c) => c?.iccid || c?.cardNo);
      if (card) {
        const mapped = mapCard(card);
        upsert.run({
          card_no:        mapped.cardNo,
          msisdn:         mapped.msisdn,
          imsi:           mapped.imsi,
          iccid:          mapped.iccid,
          imei:           mapped.imei || null,
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
        // Save raw JSON for detail display
        upsertRaw.run({ card_no: mapped.cardNo, raw_json: JSON.stringify(result.data), synced_at: now });
        successCount++;
      }
    } catch (e) {
      failCount++;
      console.error(`[IoT] syncCards: failed to fetch card ${cardNo}:`, e.response?.data || e.message);
    }
  }

  db.prepare(`INSERT INTO iot_sync_logs (synced_at, card_count, result) VALUES (?, ?, ?)`).run(now, successCount, failCount > 0 ? `fail:${failCount}` : 'ok');

  return res.status(200).json({ code: 200, message: "success", data: { cardCount: successCount, failCount } });
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
    INSERT INTO iot_cards (card_no, msisdn, imsi, iccid, imei, operator, card_type, combo_name,
      combo_residue, combo_used, combo_total, status, gprs_state, on_off_status,
      activated_state, real_position, activation_time, end_time, created_at, updated_at)
    VALUES (@card_no, @msisdn, @imsi, @iccid, @imei, @operator, @card_type, @combo_name,
      @combo_residue, @combo_used, @combo_total, @status, @gprs_state, @on_off_status,
      @activated_state, @real_position, @activation_time, @end_time, @created_at, @updated_at)
    ON CONFLICT(card_no) DO UPDATE SET
      msisdn=excluded.msisdn, imsi=excluded.imsi, iccid=excluded.iccid, imei=excluded.imei,
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
        imei:           mapped.imei || null,
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

// GET /api/v2/admin/iot/cards/stats
async function getStats(req, res) {
  const db = openDb();

  const total = db.prepare("SELECT COUNT(*) AS c FROM iot_cards").get().c;
  const online = db.prepare("SELECT COUNT(*) AS c FROM iot_cards WHERE gprs_state LIKE '1%'").get().c;
  const offline = db.prepare("SELECT COUNT(*) AS c FROM iot_cards WHERE gprs_state LIKE '2%'").get().c;
  const stopped = db.prepare("SELECT COUNT(*) AS c FROM iot_cards WHERE gprs_state LIKE '3%'").get().c;
  const separated = db.prepare("SELECT COUNT(*) AS c FROM iot_cards WHERE gprs_state LIKE '4%'").get().c;

  const gprsStateDist = db.prepare(`
    SELECT ROUND(CAST(gprs_state AS REAL)) AS state, COUNT(*) AS count
    FROM iot_cards WHERE gprs_state IS NOT NULL
    GROUP BY state
    ORDER BY count DESC
  `).all();

  const usage = db.prepare(`
    SELECT COALESCE(SUM(combo_used), 0) AS totalUsed,
           COALESCE(SUM(combo_total), 0) AS totalTotal,
           COALESCE(SUM(combo_residue), 0) AS totalResidue
    FROM iot_cards
  `).get();

  const operatorDist = db.prepare(`
    SELECT operator, COUNT(*) AS count FROM iot_cards GROUP BY operator
  `).all();

  const regionDist = db.prepare(`
    SELECT real_position AS region, COUNT(*) AS count
    FROM iot_cards
    WHERE real_position IS NOT NULL AND real_position != ''
    GROUP BY real_position
    ORDER BY count DESC
    LIMIT 10
  `).all();

  const comboDist = db.prepare(`
    SELECT combo_name AS combo, COUNT(*) AS count
    FROM iot_cards
    WHERE combo_name IS NOT NULL AND combo_name != ''
    GROUP BY combo_name
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Recent 24h hourly usage trend from snapshots
  const trend = db.prepare(`
    SELECT strftime('%H', recorded_at) AS hour,
           SUM(combo_used) AS totalUsed
    FROM iot_card_snapshots
    WHERE recorded_at >= datetime('now', '-1 day')
    GROUP BY hour
    ORDER BY hour
  `).all();

  // Ensure numeric values
  const ensureNum = (v) => (typeof v === 'number' ? v : parseFloat(v || '0'));

  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      total,
      online,
      offline,
      stopped,
      separated,
      totalUsed: ensureNum(usage.totalUsed),
      totalTotal: ensureNum(usage.totalTotal),
      totalResidue: ensureNum(usage.totalResidue),
      operatorDist: operatorDist.map(d => ({ operator: String(d.operator), count: d.count })),
      regionDist,
      comboDist,
      gprsStateDist: gprsStateDist.map(d => ({ state: String(d.state), count: d.count })),
      trend: trend.map(t => ({ hour: String(t.hour), totalUsed: ensureNum(t.totalUsed) })),
    },
  });
}

// DELETE /api/v2/admin/iot/cards/:cardNo
async function deleteCardHandler(req, res) {
  const { cardNo } = req.params;
  const db = openDb();
  const row = db.prepare("SELECT * FROM iot_cards WHERE card_no = ?").get(cardNo);
  if (!row) {
    return res.status(404).json({ code: 404, message: "Card not found" });
  }
  db.prepare("DELETE FROM iot_cards WHERE card_no = ?").run(cardNo);
  db.prepare("DELETE FROM iot_card_snapshots WHERE card_no = ?").run(cardNo);
  return res.status(200).json({ code: 200, message: "Card deleted", data: { cardNo } });
}

// GET /api/v2/admin/iot/cards/:cardNo/history
async function getCardHistory(req, res) {
  const { cardNo } = req.params;
  const precision = String(req.query.precision || 'hour').trim(); // 'hour' | 'day' | 'week'
  const db = openDb();

  let sql;
  if (precision === 'day') {
    sql = `
      SELECT date(recorded_at) AS label,
             AVG(combo_used) AS avgUsed,
             MAX(combo_used) AS maxUsed,
             MIN(combo_used) AS minUsed
      FROM iot_card_snapshots
      WHERE card_no = ? AND recorded_at >= datetime('now', '-30 days')
      GROUP BY date(recorded_at)
      ORDER BY label
    `;
  } else if (precision === 'week') {
    sql = `
      SELECT strftime('%Y-W%W', recorded_at) AS label,
             AVG(combo_used) AS avgUsed,
             MAX(combo_used) AS maxUsed,
             MIN(combo_used) AS minUsed
      FROM iot_card_snapshots
      WHERE card_no = ? AND recorded_at >= datetime('now', '-90 days')
      GROUP BY strftime('%Y-%W', recorded_at)
      ORDER BY label
    `;
  } else {
    // hour - last 24h
    sql = `
      SELECT strftime('%Y-%m-%d %H:00', recorded_at) AS label,
             combo_used AS used,
             combo_residue AS residue,
             combo_total AS total
      FROM iot_card_snapshots
      WHERE card_no = ? AND recorded_at >= datetime('now', '-1 day')
      ORDER BY label
    `;
  }

  const rows = db.prepare(sql).all(cardNo);
  return res.status(200).json({ code: 200, message: "success", data: { items: rows, precision } });
}

// GET /api/v2/admin/iot/cards/usage-by-region
// 返回过去 24h 每小时各区域流量用量
function getUsageByRegion(req, res) {
  const db = openDb();
  // recorded_at 存的是 UTC，转换为 Asia/Shanghai (UTC+8)
  const rows = db.prepare(`
    WITH ranked AS (
      SELECT s.card_no, c.real_position AS region,
             s.combo_used, s.recorded_at,
             LAG(s.combo_used) OVER (
               PARTITION BY s.card_no ORDER BY s.recorded_at
             ) AS prev_used
      FROM iot_card_snapshots s
      JOIN iot_cards c ON s.card_no = c.card_no
      WHERE datetime(s.recorded_at, '+8 hours') >= datetime('now', '+8 hours', '-1 day')
        AND c.real_position IS NOT NULL AND c.real_position != ''
    )
    SELECT strftime('%Y-%m-%d %H:00', datetime(recorded_at, '+8 hours')) AS hour,
           region,
           ROUND(SUM(combo_used - COALESCE(prev_used, 0)), 3) AS usage_mb
    FROM ranked
    WHERE prev_used IS NOT NULL AND (combo_used - prev_used) >= 0
    GROUP BY hour, region
    ORDER BY hour, usage_mb DESC
  `).all();

  const hours = Array.from(hourSet).sort();
  const regionLabels = Object.keys(regionMap).sort();
  const series = regionLabels.map(region => ({
    name: region,
    data: hours.map(h => Math.round((regionMap[region][h] || 0) * 100) / 100),
  }));

  // Also include a total per hour line
  const totals = hours.map(h =>
    series.reduce((sum, s) => sum + (s.data[hours.indexOf(h)] || 0), 0)
  );

  res.json({ code: 200, data: { hours, regions: regionLabels, series, totals } });
}

// Snapshot all cards for hourly usage tracking
function snapshotCards() {
  const db = openDb();
  const now = nowIso();
  const rows = db.prepare("SELECT card_no, combo_used, combo_residue, combo_total FROM iot_cards").all();
  const insert = db.prepare(`
    INSERT INTO iot_card_snapshots (card_no, combo_used, combo_residue, combo_total, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(r.card_no, r.combo_used || 0, r.combo_residue || 0, r.combo_total || 0, now);
    }
  });
  insertMany(rows);
  console.log(`[IoT] Snapshotted ${rows.length} cards at ${now}`);
  return rows.length;
}

module.exports = {
  listCards,
  getCard,
  syncCards,
  batchCards,
  getBalance,
  getStats,
  getUsageByRegion,
  getCardHistory,
  snapshotCards,
  deleteCard: deleteCardHandler,
  disableCard: disableCardHandler,
  enableCard: enableCardHandler,
};