const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const handlers = require("./conversationsHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(__dirname, "..", "..", "..", "public", "uploads", "chat", req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listConversations);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createConversation);
router.get("/:id", jwtAuth, requirePermission("kb:list"), handlers.getConversation);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateConversation);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteConversation);
router.post("/:id/messages", jwtAuth, requirePermission("kb:create"), handlers.sendMessage);
router.get("/:id/messages/stream", jwtAuth, requirePermission("kb:create"), handlers.sendMessageStream);
router.post("/:id/compare", jwtAuth, requirePermission("kb:create"), handlers.compareModels);
router.post("/:id/save-to-kb", jwtAuth, requirePermission("kb:create"), handlers.saveToKb);
router.post("/:id/messages/:idx/regenerate", jwtAuth, requirePermission("kb:create"), handlers.regenerateMessage);
router.post("/:id/attachments", jwtAuth, requirePermission("kb:create"), upload.single("file"), handlers.uploadAttachment);

module.exports = router;
