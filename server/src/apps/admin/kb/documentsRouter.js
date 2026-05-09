const express = require("express");
const handlers = require("./documentHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listDocuments);
router.get("/categories", jwtAuth, requirePermission("kb:list"), handlers.listCategories);
router.get("/graph", jwtAuth, requirePermission("kb:list"), handlers.getKbGraph);
router.get("/:id", jwtAuth, requirePermission("kb:list"), handlers.getDocument);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createDocument);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateDocument);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteDocument);

module.exports = router;
