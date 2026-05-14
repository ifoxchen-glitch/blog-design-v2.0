const express = require("express");
const handlers = require("./iotHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

// GET /api/v2/admin/iot/cards — list local cards (paginated)
router.get("/cards", jwtAuth, requirePermission("iot:list"), handlers.listCards);

// GET /api/v2/admin/iot/cards/:id — single card detail
router.get("/cards/:id", jwtAuth, requirePermission("iot:list"), handlers.getCard);

// POST /api/v2/admin/iot/card/query — query single card from IoT platform, upsert to local
router.post("/card/query", jwtAuth, requirePermission("iot:query"), handlers.queryCard);

// POST /api/v2/admin/iot/card/batch — batch query from IoT platform, upsert to local
router.post("/card/batch", jwtAuth, requirePermission("iot:query"), handlers.batchQueryCards);

// GET /api/v2/admin/iot/balance — query account balance
router.get("/balance", jwtAuth, requirePermission("iot:query"), handlers.getBalance);

// POST /api/v2/admin/iot/card/disable — network disable (断网)
router.post("/card/disable", jwtAuth, requirePermission("iot:manage"), handlers.disableCard);

// POST /api/v2/admin/iot/card/enable — network enable (恢复)
router.post("/card/enable", jwtAuth, requirePermission("iot:manage"), handlers.enableCard);

// PUT /api/v2/admin/iot/card/:id — update card remarks
router.put("/card/:id", jwtAuth, requirePermission("iot:manage"), handlers.updateCard);

// DELETE /api/v2/admin/iot/card/:id — remove card from local
router.delete("/card/:id", jwtAuth, requirePermission("iot:manage"), handlers.deleteCard);

module.exports = router;