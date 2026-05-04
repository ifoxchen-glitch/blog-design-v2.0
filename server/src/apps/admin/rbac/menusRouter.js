const express = require("express");
const handlers = require("./menuHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("menu:manage"), handlers.listMenus);
router.get("/:id", jwtAuth, requirePermission("menu:manage"), handlers.getMenu);
router.post("/", jwtAuth, requirePermission("menu:manage"), handlers.createMenu);
router.put("/:id", jwtAuth, requirePermission("menu:manage"), handlers.updateMenu);
router.delete("/:id", jwtAuth, requirePermission("menu:manage"), handlers.deleteMenu);
router.post("/reorder", jwtAuth, requirePermission("menu:manage"), handlers.reorderMenus);

module.exports = router;
