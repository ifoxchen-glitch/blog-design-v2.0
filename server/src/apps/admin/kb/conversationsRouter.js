const express = require("express");
const handlers = require("./conversationsHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listConversations);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createConversation);
router.get("/:id", jwtAuth, requirePermission("kb:list"), handlers.getConversation);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateConversation);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteConversation);
router.post("/:id/messages", jwtAuth, requirePermission("kb:create"), handlers.sendMessage);
router.get("/:id/messages/stream", jwtAuth, requirePermission("kb:create"), handlers.sendMessageStream);
router.post("/:id/compare", jwtAuth, requirePermission("kb:create"), handlers.compareModels);
router.post("/:id/save-to-kb", jwtAuth, requirePermission("kb:create"), handlers.saveToKb);

module.exports = router;
