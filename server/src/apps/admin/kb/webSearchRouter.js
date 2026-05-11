const express = require("express");
const handlers = require("./webSearchHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/config", jwtAuth, requirePermission("kb:list"), handlers.getConfig);
router.put("/config", jwtAuth, requirePermission("kb:update"), handlers.updateConfig);
router.get("/search", jwtAuth, requirePermission("kb:list"), handlers.search);

module.exports = router;
