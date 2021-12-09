const express = require("express");
const router = express.Router();
const elasticclient = require("@elastic/elasticsearch").Client;
const adddashestouuid = require("add-dashes-to-uuid");
const mongoUtil = require("./MongoUtil");
const axios = require("axios");

const client = new elasticclient({
  node: "http://localhost:9200",
  auth: {
    bearer: "token",
  },
});

router.get("/metadata", async (req, res) => {
  const db = await mongoUtil.getDb();
  const q = req.query.q;
  if (!q) {
    return res.sendStatus(400);
  }
  let openCanadaResults;
  try {
    const apiRes = await axios.get(
      "https://open.canada.ca/data/api/action/package_search",
      {
        params: {
          q,
          rows: 500,
        },
      }
    );
    openCanadaResults = apiRes.data.result.results.map((r) => r.id);
  } catch (err) {
    return req.sendStatus(500);
  }
  const resourceIds = await db
    .collection("metadata")
    .aggregate([
      {
        $match: {
          id: {
            $in: openCanadaResults,
          },
        },
      },
      {
        $unwind: {
          path: "$resources",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: false,
          uuid: "$resources.id",
        },
      },
      {
        $lookup: {
          from: "inferredstats",
          localField: "uuid",
          foreignField: "uuid",
          as: "stats",
        },
      },
      {
        $match: {
          $expr: {
            $gt: [
              {
                $size: "$stats",
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          uuid: "$uuid",
        },
      },
    ])
    .toArray();
  const datasets = await db
    .collection("metadata")
    .find({
      "resources.id": { $in: resourceIds.map((r) => r.uuid) },
    })
    .toArray();

  const dataSetDict = {};
  for (let d of datasets) {
    if (dataSetDict[d._id]) {
      continue;
    }
    for (let r of d.resources) {
      r.matches = {
        uuid: r.id,
        count: 0,
        columns: [],
        matches: [],
      };
    }
    dataSetDict[d._id] = d;
  }
  return res.send(Object.values(dataSetDict));
});

router.get("/", async (req, res) => {
  const db = await mongoUtil.getDb();
  const keyword = req.query.q;
  if (!keyword) {
    return res.sendStatus(400);
  }
  const splittedKeywords = keyword.split(" ");
  const must = [];
  splittedKeywords.forEach((k) => {
    must.push({ term: { tuple: k } });
  });

  const found = await client.search({
    index: "tuples",
    body: {
      from: 0,
      size: 4000,

      query: {
        bool: {
          should: [
            { match: { tuple: keyword } },
            {
              bool: {
                must,
              },
            },
          ],
        },
      },
    },
  });
  const documentsMatchedDict = {};
  found.body.hits.hits.forEach((b) => {
    const uuid = adddashestouuid(b._source.file_id.split("-").join(""));
    const matchedFields = [];
    for (let k in b._source.tuple) {
      if (b._source.tuple[k] === keyword) {
        matchedFields.push(k);
        continue;
      }
      for (let kw of splittedKeywords) {
        if (b._source.tuple[k] === kw) {
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
