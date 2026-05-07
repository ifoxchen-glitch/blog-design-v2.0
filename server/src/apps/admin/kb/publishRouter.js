const express = require("express");
const handlers = require("./publishHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.post("/documents/:id/preview", jwtAuth, requirePermission("kb:list"), handlers.previewDocument);
router.post("/documents/:id/publish", jwtAuth, requirePermission("kb:publish"), handlers.publishDocument);
router.get("/document-posts", jwtAuth, requirePermission("kb:list"), handlers.listDocumentPosts);
router.put("/document-posts/:id", jwtAuth, requirePermission("kb:publish"), handlers.updateDocumentPost);
router.delete("/document-posts/:id", jwtAuth, requirePermission("kb:publish"), handlers.deleteDocumentPost);

module.exports = router;
