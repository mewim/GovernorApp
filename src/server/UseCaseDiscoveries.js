const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "usecasediscoveries";
const METADATA_COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";

router.get("/count", async (req, res) => {
  const db = await mongoUtil.getDb();
  const count = await db.collection(COLLECTION).countDocuments();
  res.send({ count: count });
});

router.get("/", async (req, res) => {
  const skip = Number.parseInt(req.query.skip);
  const limit = Number.parseInt(req.query.limit);
  if (!Number.isInteger(skip) || skip < 0) {
    return res.sendStatus(400);
  }
  if (!Number.isInteger(limit) || limit < 0) {
    return res.sendStatus(400);
  }
  const db = await mongoUtil.getDb();
  const found = await db
    .collection(COLLECTION)
    .find({})
    .skip(skip)
    .limit(limit)
    .toArray();
  const uuidSet = new Set();
  for (const item of found) {
    for (const joinPlan of item.union) {
      uuidSet.add(joinPlan.join.query_uuid);
      uuidSet.add(joinPlan.join.target_uuid);
    }
  }
  const uuids = Array.from(uuidSet);
  const metadata = await db
    .collection(METADATA_COLLECTION)
    .find({
      "resources.id": { $in: uuids },
    })
    .toArray();
  const inferredstats = await db
    .collection(INFERREDSTATS_COLLECTION)
    .find({ uuid: { $in: uuids } })
    .toArray();
  return res.send({ plans: found, metadata, inferredstats });
});

module.exports = router;
