const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "setoverlapresults";
const METADATA_COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";
const INFERREDCOLUMNSTATS_COLLECTION = "inferredcolumnstats";

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const metrics = req.query.metrics ? req.query.metrics : "jaccard";

  const scoreCutoff = !isNaN(req.query.score_cutoff)
    ? Number(req.query.score_cutoff)
    : 0.5;
  const uniquenessCutoff = !isNaN(req.query.uniqueness_cutoff)
    ? Number(req.query.uniqueness_cutoff)
    : 0.5;
  const uuid = req.params.uuid;
  const sourceDatasetId = (
    await db.collection(METADATA_COLLECTION).findOne(
      {
        "resources.id": uuid,
      },
      { id: true }
    )
  ).id;

  const almostKeyColumns = (
    await db
      .collection(INFERREDCOLUMNSTATS_COLLECTION)
      .find({
        uuid,
        uniqueness_score: { $gte: uniquenessCutoff },
      })
      .toArray()
  ).map((c) => c.index);
  const almostKeyColumnSet = new Set(almostKeyColumns);

  const sourceInferredstats = await db
    .collection(INFERREDSTATS_COLLECTION)
    .findOne({ uuid });
  if (!sourceInferredstats) {
    return res.sendStatus(404);
  }
  const found = (
    await db
      .collection(COLLECTION)
      .find({
        "pair.uuid": uuid,
        metrics,
        score: { $gte: scoreCutoff },
        "pair.index": { $in: almostKeyColumns },
      })
      .project({ _id: 0 })
      .sort({ score: -1 })
      .toArray()
  )
    .map((r) => {
      r.target = r.pair.filter((t) => t.uuid !== uuid)[0];
      r.source = r.pair.filter((t) => t.uuid === uuid)[0];
      delete r.pair;
      return r;
    })
    .filter((t) => almostKeyColumnSet.has(t.source.index));
  const targetIds = found.map((f) => f.target.uuid);

  const sourceSchemaString = JSON.stringify(
    sourceInferredstats.schema.fields.map((f) => f.name)
  );
  const targetStatsHash = {};
  (
    await db
      .collection(INFERREDSTATS_COLLECTION)
      .find({
        uuid: { $in: targetIds },
      })
      .toArray()
  ).forEach((t) => {
    if (
      JSON.stringify(t.schema.fields.map((f) => f.name)) === sourceSchemaString
    ) {
      return;
    }
    targetStatsHash[t.uuid] = t;
  });
  // If there are multiple joinable columns for the same table id, we take the
  // one with highest score
  const resultsTableIdHash = {};
  for (const f of found) {
    if (!resultsTableIdHash[f.target.uuid]) {
      resultsTableIdHash[f.target.uuid] = f;
    } else if (f.score > resultsTableIdHash[f.target.uuid].score) {
      resultsTableIdHash[f.target.uuid] = f;
    }
  }

  const resultsHash = {};
  for (const f of Object.values(resultsTableIdHash)) {
    const index = f.source.index;
    if (!resultsHash[index]) {
      resultsHash[index] = [];
    }
    const target = {
      uuid: f.target.uuid,
      index: f.target.index,
      score: f.score,
    };
    if (!targetStatsHash[target.uuid]) {
      continue;
    }
    const targetStats =
      targetStatsHash[f.target.uuid].schema.fields[f.target.index];
    target.schema = {
      field_name: targetStats.name,
      field_type: targetStats.type,
    };
    resultsHash[index].push(target);
  }
  let results = [];
  for (const index in resultsHash) {
    results.push({
      index: parseInt(index),
      targets: resultsHash[index],
    });
  }
  const uuidSet = new Set();
  results.forEach((f) => {
    f.targets.forEach((t) => {
      uuidSet.add(t.uuid);
    });
  });
  const resourceIds = [...uuidSet];
  let resources = await db
    .collection(METADATA_COLLECTION)
    .aggregate([
      { $match: { "resources.id": { $in: resourceIds }, id: sourceDatasetId } },
      { $unwind: "$resources" },
      { $match: { "resources.id": { $in: resourceIds } } },
      { $project: { _id: false, resource: "$resources" } },
    ])
    .toArray();
  resources = resources.map((r) => r.resource);
  const resourceStats = Object.values(targetStatsHash);
  const resourceIdsWithinDataset = new Set(resources.map((r) => r.id));
  results.forEach((r) => {
    r.targets = r.targets.filter((t) => resourceIdsWithinDataset.has(t.uuid));
  });
  results = results.filter((r) => r.targets.length > 0);
  return res.send({ results, resources, resourceStats });
});

module.exports = router;
