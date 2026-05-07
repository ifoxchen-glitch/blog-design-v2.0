const express = require("express");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");
const handlers = require("./syncHandlers");

const router = express.Router();

router.get("/sync/config", jwtAuth, requirePermission("kb:sync"), handlers.getSyncConfig);
router.put("/sync/config", jwtAuth, requirePermission("kb:sync"), handlers.updateSyncConfig);
router.post("/sync/trigger-import", jwtAuth, requirePermission("kb:sync"), handlers.triggerImport);
router.post("/sync/trigger-export", jwtAuth, requirePermission("kb:sync"), handlers.triggerExport);
router.get("/sync/logs", jwtAuth, requirePermission("kb:sync"), handlers.listSyncLogs);
router.get("/sync/status", jwtAuth, requirePermission("kb:sync"), handlers.getSyncStatus);
router.post("/sync/test-filesystem", jwtAuth, requirePermission("kb:sync"), handlers.testFilesystem);
router.get("/sync/remote-files", jwtAuth, requirePermission("kb:sync"), handlers.getRemoteFiles);
router.get("/sync/synced-files", jwtAuth, requirePermission("kb:sync"), handlers.getSyncedFiles);

module.exports = router;
