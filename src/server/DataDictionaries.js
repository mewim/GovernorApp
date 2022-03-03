const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const COLLECTION = "datadictionaries";

router.get("/:uuid", async (req, res) => {
  const queryUUID = req.params.uuid;
  const db = await mongoUtil.getDb();
  const found = await db.collection(COLLECTION).findOne({
    resource_id: queryUUID,
  });
  if (!found) {
    return res.sendStatus(404);
  }
  return res.send(found);
});

module.exports = router;
