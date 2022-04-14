const express = require("express");
const router = express.Router();

const search = require("./Search");
const inferredstats = require("./InferredStats");
const inferredhistograms = require("./InferredHistograms");
const csv = require("./Csv");
const plotlyplot = require("./PlotlyPlot");
const dataset = require("./Dataset");
const joinable = require("./Joinable");
const unionable = require("./Unionable");
const parquet = require("./Parquet");
const keyjoinscores = require("./KeyJoinScores");
const datadictionaries = require("./DataDictionaries");

router.use("/search", search);
router.use("/inferredstats", inferredstats);
router.use("/inferredhistograms", inferredhistograms);
router.use("/csv", csv);
router.use("/parquet", parquet);
router.use("/plotlyplot", plotlyplot);
router.use("/dataset", dataset);
router.use("/joinable", joinable);
router.use("/keyjoinscores", keyjoinscores);
router.use("/datadictionaries", datadictionaries);
router.use("/unionable", unionable);

router.use((_, res) => {
  return res.sendStatus(501);
});

module.exports = router;
