const express = require("express");
const handlers = require("./roleHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("role:assign"), handlers.listRoles);
router.get("/:id", jwtAuth, requirePermission("role:assign"), handlers.getRole);
router.post("/", jwtAuth, requirePermission("role:assign"), handlers.createRole);
router.put("/:id", jwtAuth, requirePermission("role:assign"), handlers.updateRole);
router.delete("/:id", jwtAuth, requirePermission("role:assign"), handlers.deleteRole);

module.exports = router;
