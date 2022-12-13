const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "sameschemagroups";
const METADATA_COLLECTION = "metadata";

router.get("/count", async (_, res) => {
  const db = await mongoUtil.getDb();
  const count = await db.collection(COLLECTION).countDocuments();
  res.send({ count: count });
});

router.get("/:uuids", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuidArray = req.params.uuids.split(",").map((uuid) => uuid.trim());
  const uuidSet = new Set(uuidArray);

  const found = await db
    .collection(COLLECTION)
    .find({ uuids: { $in: uuidArray } })
    .toArray();
  if (found.length === 0) {
    return res.send([]);
  }
  const allUuids = new Set();
  for (const item of found) {
    for (const uuid of item.uuids) {
      allUuids.add(uuid);
    }
  }
  const targetIds = [...allUuids].filter((u) => !uuidSet.has(u));
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
