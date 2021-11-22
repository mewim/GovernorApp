const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "inferredstats";

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuid = req.params.uuid;
  const found = await db.collection(COLLECTION).findOne({ uuid });
  if (!found) {
    return res.sendStatus(404);
  }
  return res.send(found);
});

module.exports = router;
