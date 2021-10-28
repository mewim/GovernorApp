const express = require("express");
const router = express.Router();

const search = require("./Search");

router.use("/search", search);

router.use((_, res) => {
  return res.sendStatus(501);
});

module.exports = router;
