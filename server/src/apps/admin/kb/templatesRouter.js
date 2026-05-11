const express = require("express");
const handlers = require("./templatesHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listTemplates);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createTemplate);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateTemplate);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteTemplate);

module.exports = router;
