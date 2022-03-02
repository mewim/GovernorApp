const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "keyjoinscores";
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
  const queryMetric = req.query.metrics ? req.query.metrics : "containment";

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
  return res.send(found);
});

module.exports = router;
