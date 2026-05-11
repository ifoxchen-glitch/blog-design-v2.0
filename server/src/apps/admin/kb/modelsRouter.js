const express = require("express");
const handlers = require("./modelsHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listModels);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createModel);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateModel);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteModel);
router.post("/:id/test", jwtAuth, requirePermission("kb:list"), handlers.testModel);

module.exports = router;
