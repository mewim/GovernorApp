const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "setoverlapresults";
const METADATA_COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const metrics = req.query.metrics ? req.query.metrics : "jaccard";
  const limit = !isNaN(req.query.limit) ? Number(req.query.limit) : 100;

  const uuid = req.params.uuid;

  const sourceInferredstats = await db
    .collection(INFERREDSTATS_COLLECTION)
    .findOne({ uuid });
  if (!sourceInferredstats) {
    return res.sendStatus(404);
  }
  const found = (
    await db
      .collection(COLLECTION)
      .find({ "pair.uuid": uuid, metrics })
      .project({ _id: 0 })
      .sort({ score: -1 })
      .limit(limit)
      .toArray()
  ).map((r) => {
    r.target = r.pair.filter((t) => t.uuid !== uuid)[0];
    r.source = r.pair.filter((t) => t.uuid === uuid)[0];
    delete r.pair;
    return r;
  });
  const targetIds = found.map((f) => f.target.uuid);

  const targetStatsHash = {};
  (
    await db
      .collection(INFERREDSTATS_COLLECTION)
      .find({
        uuid: { $in: targetIds },
      })
      .toArray()
  ).forEach((t) => {
    targetStatsHash[t.uuid] = t;
  });
  const targetIdsSet = new Set(targetIds);
  const matchedResources = (
    await db
      .collection(METADATA_COLLECTION)
      .find({ "resources.id": { $in: targetIds } })
      .project({ resources: true })
      .toArray()
  ).map((r) => {
    r.resources = r.resources.filter((rr) => targetIdsSet.has(rr.id));
    return r;
  });
  const targetNamesHash = {};
  matchedResources.forEach((t) => {
    t.resources.forEach((tr) => {
      targetNamesHash[tr.id] = tr.name;
    });
  });
  const results = [];
  found.forEach((f) => {
    results.push({
      target: {
        name: targetNamesHash[f.target.uuid],
        uuid: f.target.uuid,
        column: {
          index: f.target.index,
          inferred_schema:
            targetStatsHash[f.target.uuid].schema.fields[f.target.index],
        },
      },
      source: {
        column: {
          index: f.source.index,
          inferred_schema: sourceInferredstats.schema.fields[f.source.index],
        },
      },
    });
  });
  return res.send(results);
});

module.exports = router;
