const express = require("express");
const handlers = require("./canvasHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listCanvases);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createCanvas);
router.get("/:id", jwtAuth, requirePermission("kb:list"), handlers.getCanvas);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateCanvas);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteCanvas);

// Nodes
router.post("/:id/nodes", jwtAuth, requirePermission("kb:update"), handlers.addNode);
router.put("/:id/nodes/:nid", jwtAuth, requirePermission("kb:update"), handlers.updateNode);
router.delete("/:id/nodes/:nid", jwtAuth, requirePermission("kb:update"), handlers.deleteNode);

// Edges
router.post("/:id/edges", jwtAuth, requirePermission("kb:update"), handlers.addEdge);
router.put("/:id/edges/:eid", jwtAuth, requirePermission("kb:update"), handlers.updateEdge);
router.delete("/:id/edges/:eid", jwtAuth, requirePermission("kb:update"), handlers.deleteEdge);

module.exports = router;
