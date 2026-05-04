const express = require("express");
const handlers = require("./permissionHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("role:assign"), handlers.listPermissions);
router.put("/:id", jwtAuth, requirePermission("role:assign"), handlers.updatePermission);

module.exports = router;
