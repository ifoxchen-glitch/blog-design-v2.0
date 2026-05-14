const express = require("express");
const {
  listCards,
  getCard,
  syncCards,
  batchCards,
  getBalance,
  getStats,
  disableCard,
  enableCard,
} = require("./cardHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/",              jwtAuth, requirePermission("iot:card:list"),   listCards);
router.get("/balance",      jwtAuth, requirePermission("iot:card:list"),   getBalance);
router.get("/stats",        jwtAuth, requirePermission("iot:card:list"),   getStats);
router.post("/sync",        jwtAuth, requirePermission("iot:card:list"),   syncCards);
router.post("/batch",       jwtAuth, requirePermission("iot:card:list"),   batchCards);
router.get("/:cardNo",      jwtAuth, requirePermission("iot:card:query"),  getCard);
router.put("/:cardNo/disable", jwtAuth, requirePermission("iot:card:disable"), disableCard);
router.put("/:cardNo/enable",  jwtAuth, requirePermission("iot:card:enable"),  enableCard);

module.exports = router;