const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "sameschemagroups";
const METADATA_COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";

router.get("/count", async (_, res) => {
  const db = await mongoUtil.getDb();
  const count = await db.collection(COLLECTION).countDocuments();
  res.send({ count: count });
});

router.get("/usecases", async (req, res) => {
  const db = await mongoUtil.getDb();
  const skip = Number.parseInt(req.query.skip);
  const limit = Number.parseInt(req.query.limit);
  if (!Number.isInteger(skip) || skip < 0) {
    return res.sendStatus(400);
  }
  if (!Number.isInteger(limit) || limit < 0) {
    return res.sendStatus(400);
  }

  const found = await db
    .collection(COLLECTION)
    .aggregate([
      { $project: { union: "$uuids", _id: false, size: { $size: "$uuids" } } },
      { $sort: { size: -1 } },
      { $skip: skip },
      { $limit: limit },
    ])
    .toArray();
  const uuidSet = new Set();
  for (const item of found) {
    for (const uuid of item.union) {
      uuidSet.add(uuid);
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

router.get("/:uuids", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuidArray = req.params.uuids.split(",");
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
