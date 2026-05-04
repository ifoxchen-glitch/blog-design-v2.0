const express = require("express");
const handlers = require("./tagHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("tag:list"), handlers.listTags);
router.post("/", jwtAuth, requirePermission("tag:create"), handlers.createTag);
router.put("/:id", jwtAuth, requirePermission("tag:update"), handlers.updateTag);
router.delete("/:id", jwtAuth, requirePermission("tag:delete"), handlers.deleteTag);

module.exports = router;
