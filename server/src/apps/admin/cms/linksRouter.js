const express = require("express");
const handlers = require("./linkHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("link:list"), handlers.listLinks);
router.post("/", jwtAuth, requirePermission("link:create"), handlers.createLink);
router.post("/reorder", jwtAuth, requirePermission("link:update"), handlers.reorderLinks);
router.put("/:id", jwtAuth, requirePermission("link:update"), handlers.updateLink);
router.delete("/:id", jwtAuth, requirePermission("link:delete"), handlers.deleteLink);

module.exports = router;
