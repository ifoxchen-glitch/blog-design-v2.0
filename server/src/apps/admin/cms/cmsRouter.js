const express = require("express");
const handlers = require("./cmsHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

// 全库导出/导入：仅超管可用（rbacSeed 没把 cms:export/cms:import 给 content_admin）。
router.get("/export", jwtAuth, requirePermission("cms:export"), handlers.exportData);
router.post("/import", jwtAuth, requirePermission("cms:import"), handlers.importData);

module.exports = router;
