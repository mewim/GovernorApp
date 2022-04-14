const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "sameschemagroups";
const METADATA_COLLECTION = "metadata";

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();

  const found = await db
    .collection(COLLECTION)
    .findOne({ uuids: req.params.uuid });
  if (!found) {
    return res.send([]);
  }
  const targetIds = found.uuids.filter((u) => u !== req.params.uuid);
  const targetIdsSet = new Set(targetIds);
  const matchedResources = (
    await db
      .collection(METADATA_COLLECTION)
      .find({ "resources.id": { $in: targetIds } })
      .toArray()
  ).map((r) => {
    r.resources = r.resources.filter((rr) => targetIdsSet.has(rr.id));
    return r;
  });
  return res.send(matchedResources);
});

module.exports = router;
