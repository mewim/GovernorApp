const express = require("express");
const router = express.Router();
const elasticclient = require("@elastic/elasticsearch").Client;
const adddashestouuid = require("add-dashes-to-uuid");
const mongoUtil = require("./MongoUtil");

const client = new elasticclient({
  node: "http://localhost:9200",
  auth: {
    bearer: "token",
  },
});

router.get("/", async (req, res) => {
  const db = await mongoUtil.getDb();
  const keyword = req.query.q;
  if (!keyword) {
    return res.sendStatus(400);
  }
  const found = await client.search({
    index: "tuples",
    body: {
      query: {
        match: {
          tuple: keyword,
        },
      },
    },
  });
  const fileIdsMap = {};
  const tuples = found.body.hits.hits.map((b) => b._source);
  for (let i = 0; i < tuples.length; ++i) {
    tuples[i].file_id = adddashestouuid(tuples[i].file_id);
    if (!fileIdsMap[tuples[i].file_id]) {
      fileIdsMap[tuples[i].file_id] = {};
    }
    fileIdsMap[tuples[i].file_id][tuples[i].row_number] = tuples[i].tuple;
  }
  const datasets = await db
    .collection("metadata")
    .find({
      "resources.id": { $in: Object.keys(fileIdsMap) },
    })
    .toArray();
  for (let d of datasets) {
    for (let r of d.resources) {
      if (r.id in fileIdsMap) {
        r.tuples = fileIdsMap[r.id];
      }
    }
  }
  res.send(datasets);
});

module.exports = router;
