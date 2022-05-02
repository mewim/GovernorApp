const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "keyjoinscores";
const METADATA_COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";

const VALID_METRICS = new Set([
  "jaccard",
  "cosine",
  "containment",
  "containment_min",
  "containment_max",
]);

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const queryId = req.params.uuid;
  const queryIndex = Number.parseInt(req.query.index);
  const queryScore = req.query.min_score
    ? Number.parseFloat(req.query.min_score)
    : 0.7;
  const queryMetric = req.query.metrics ? req.query.metrics : "containment_min";

  if (!queryId) {
    return res.sendStatus(400);
  }
  if (!queryMetric || !VALID_METRICS.has(queryMetric)) {
    return res.sendStatus(400);
  }
  if (!Number.isInteger(queryIndex) && queryIndex < 0) {
    return res.sendStatus(400);
  }
  if (Number.isNaN(queryScore) || queryScore < 0.0 || queryScore > 1.0) {
    return res.sendStatus(400);
  }
  const sourceInferredstats = await db
    .collection(INFERREDSTATS_COLLECTION)
    .findOne({ uuid: queryId });
  if (!sourceInferredstats) {
    return res.sendStatus(404);
  }

  const metricsVariableName = `${queryMetric}_score`;
  const $match = {
    query_uuid: queryId,
  };
  $match[metricsVariableName] = {
    $gte: queryScore,
  };
  if (Number.isInteger(queryIndex)) {
    $match.query_index = queryIndex;
  }
  const pipeline = [
    {
      $match,
    },
    {
      $project: {
        _id: false,
        query_index: "$query_index",
        target: {
          uuid: "$target_uuid",
          index: "$target_index",
          score: `$${metricsVariableName}`,
        },
      },
    },
    {
      $sort: {
        "target.score": -1,
      },
    },
    {
      $lookup: {
        from: "inferredstats",
        let: { target_id: "$target.uuid", target_index: "$target.index" },
        pipeline: [
          { $match: { $expr: { $eq: ["$uuid", "$$target_id"] } } },
          {
            $project: {
              _id: false,
              match: { $arrayElemAt: ["$schema.fields", "$$target_index"] },
            },
          },
        ],
        as: "target.column_information",
      },
    },
    { $unwind: "$target.column_information" },
    {
      $project: {
        _id: false,
        query_index: "$query_index",
        target: {
          uuid: "$target.uuid",
          index: "$target.index",
          score: "$target.score",
          schema: {
            field_name: "$target.column_information.match.name",
            field_type: "$target.column_information.match.type",
          },
        },
      },
    },
    {
      $group: {
        _id: "$query_index",
        targets: {
          $push: "$target",
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
    {
      $project: {
        _id: false,
        index: "$_id",
        targets: "$targets",
      },
    },
  ];
  const found = await db.collection(COLLECTION).aggregate(pipeline).toArray();
  const uuidSet = new Set();
  found.forEach((f) => {
    f.targets.forEach((t) => {
      uuidSet.add(t.uuid);
    });
  });

  // Filter out tables with same schema
  const sourceSchemaString = JSON.stringify(
    sourceInferredstats.schema.fields.map((f) => f.name.toLowerCase()).sort()
  );
  console.log(sourceSchemaString);
  const targetStatsHash = {};
  (
    await db
      .collection(INFERREDSTATS_COLLECTION)
      .find({
        uuid: { $in: [...uuidSet] },
      })
      .toArray()
  ).forEach((t) => {
    const targetSchemaString = JSON.stringify(
      t.schema.fields.map((f) => f.name.toLowerCase()).sort()
    );
    console.log(targetSchemaString, targetSchemaString === sourceSchemaString);
    if (targetSchemaString === sourceSchemaString) {
      uuidSet.delete(t.uuid);
      return;
    }
    targetStatsHash[t.uuid] = t;
  });
  found.forEach((f) => {
    f.targets = f.targets.filter((t) => t.uuid in targetStatsHash);
  });

  const resourceIds = [...uuidSet];
  let resources = await db
    .collection(METADATA_COLLECTION)
    .aggregate([
      { $match: { "resources.id": { $in: resourceIds } } },
      { $unwind: "$resources" },
      { $match: { "resources.id": { $in: resourceIds } } },
      { $project: { _id: false, resource: "$resources" } },
    ])
    .toArray();
  resources = resources.map((r) => r.resource);

  return res.send({
    results: found,
    resources,
    resourceStats: Object.values(targetStatsHash),
  });
});

module.exports = router;
