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
      from: 0,
      size: 4000,
      query: {
        match: {
          tuple: { query: keyword },
        },
      },
    },
  });
  const documentsMatchedDict = {};
  const splittedKeywords = keyword.split(" ");
  found.body.hits.hits.forEach((b) => {
    const uuid = adddashestouuid(b._source.file_id.split("-").join(""));
    const matchedFields = [];
    for (let k in b._source.tuple) {
      for (let kw of splittedKeywords) {
        if (b._source.tuple[k].includes(kw)) {
          matchedFields.push(k);
          break;
        }
      }
    }
    if (matchedFields.length === 0) {
      return;
    }

    if (!documentsMatchedDict[uuid]) {
      documentsMatchedDict[uuid] = {
        uuid,
        count: 0,
        columns: new Set(),
        matches: [],
      };
    }
    documentsMatchedDict[uuid].count += 1;
    matchedFields.forEach((f) => {
      documentsMatchedDict[uuid].columns.add(f);
      documentsMatchedDict[uuid].matches.push({
        field_name: f,
        row_number: b._source.row_number,
      });
    });
  });
  for (let k in documentsMatchedDict) {
    documentsMatchedDict[k].columns = [...documentsMatchedDict[k].columns];
  }
  const datasets = await db
    .collection("metadata")
    .find({
      "resources.id": { $in: Object.keys(documentsMatchedDict) },
    })
    .toArray();
  const dataSetDict = {};
  for (let d of datasets) {
    if (dataSetDict[d._id]) {
      continue;
    }
    d.resources = d.resources.filter((r) => r.id in documentsMatchedDict);
    for (let r of d.resources) {
      r.matches = documentsMatchedDict[r.id];
    }
    dataSetDict[d._id] = d;
  }
  res.send(Object.values(dataSetDict));
});

module.exports = router;
