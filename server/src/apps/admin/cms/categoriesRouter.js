const express = require("express");
const handlers = require("./categoryHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("category:list"), handlers.listCategories);
router.post("/", jwtAuth, requirePermission("category:create"), handlers.createCategory);
router.put("/:id", jwtAuth, requirePermission("category:update"), handlers.updateCategory);
router.delete("/:id", jwtAuth, requirePermission("category:delete"), handlers.deleteCategory);

module.exports = router;
