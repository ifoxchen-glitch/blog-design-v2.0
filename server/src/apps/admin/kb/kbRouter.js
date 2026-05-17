var syncSourcesRouter = require('./syncSourcesRouter');

const express = require("express");
const documentsRouter = require("./documentsRouter");
const publishRouter = require("./publishRouter");
const canvasesRouter = require("./canvasesRouter");
const syncRouter = require("./syncRouter");

const router = express.Router();
router.use('/sync-sources', syncSourcesRouter);

router.use("/documents", documentsRouter);
router.use("/canvases", canvasesRouter);
router.use("/", publishRouter);
router.use("/", syncRouter);

module.exports = router;
