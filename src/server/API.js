const express = require("express");
const router = express.Router();

const search = require("./Search");
const inferredstats = require("./InferredStats");
const csv = require("./Csv");

router.use("/search", search);
router.use("/inferredstats", inferredstats);
router.use("/csv", csv);

router.use((_, res) => {
  return res.sendStatus(501);
});

module.exports = router;
