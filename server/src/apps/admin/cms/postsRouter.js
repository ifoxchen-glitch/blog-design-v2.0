const express = require("express");
const handlers = require("./postHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("post:list"), handlers.listPosts);
router.get("/:id", jwtAuth, requirePermission("post:list"), handlers.getPost);
router.post("/", jwtAuth, requirePermission("post:create"), handlers.createPost);
router.put("/:id", jwtAuth, requirePermission("post:update"), handlers.updatePost);
router.delete("/:id", jwtAuth, requirePermission("post:delete"), handlers.deletePost);
router.post("/:id/publish", jwtAuth, requirePermission("post:publish"), handlers.publishPost);
router.post("/:id/unpublish", jwtAuth, requirePermission("post:publish"), handlers.unpublishPost);

module.exports = router;
