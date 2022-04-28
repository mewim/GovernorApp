const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "sameschemagroups";
const METADATA_COLLECTION = "metadata";

router.get("/:uuids", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuidArray = req.params.uuids.split(",");
  const uuidSet = new Set(uuidArray);

  const found = await db
    .collection(COLLECTION)
    .findOne({ uuids: { $in: uuidArray } });
  if (!found) {
    return res.send([]);
  }
  const targetIds = found.uuids.filter((u) => !uuidSet.has(u));
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
