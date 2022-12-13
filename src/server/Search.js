const express = require("express");
const router = express.Router();
const elasticclient = require("@elastic/elasticsearch").Client;
const adddashestouuid = require("add-dashes-to-uuid");
const mongoUtil = require("./MongoUtil");
const uuid = require("uuid");
const config = require("../../app.config.json");

const client = new elasticclient({
  node: config.elasticsearch.uri,
  auth: {
    bearer: "token",
  },
});

router.get("/metadata", async (req, res) => {
  const db = await mongoUtil.getDb();
  let q = req.query.q;
  if (!q) {
    return res.sendStatus(400);
  }
  let isUUID = false;
  // If the query is a UUID, we use it directly without performing a search
  q = q.trim();
  if (q.length === 32 && /[0-9A-Fa-f]{32}/g.test(q)) {
    q = adddashestouuid(q);
  }
  if (q.length === 36 && uuid.validate(q)) {
    isUUID = true;
    q = q.toLowerCase();
  }
  let metadataResults = [];
  let resourceIdMatch;
  if (!isUUID) {
    const textSearchResult = await db
      .collection("metadata")
      .find(
        {
          $text: {
            $search: q
              .split(/\s+/)
              .map((kw) => `"${kw}"`)
              .join(" "),
          },
        },
        { _id: false, id: true }
      )
      .toArray();
    metadataResults = textSearchResult.map((r) => r.id);
  } else {
    const dbQueryResult = await db.collection("metadata").findOne({
      $or: [{ id: q }, { "resources.id": q }],
    });
    if (dbQueryResult) {
      metadataResults = [dbQueryResult.id];
      for (let resource of dbQueryResult.resources) {
        if (resource.id === q) {
          resourceIdMatch = q;
          break;
        }
      }
    }
  }
  const resourceIds = await db
    .collection("metadata")
    .aggregate([
      {
        $match: {
          id: {
            $in: metadataResults,
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
  const resourceIdsArray = resourceIds.map((r) => r.uuid);
  let resourceIdsSet = new Set(resourceIdsArray);
  if (resourceIdMatch && resourceIdsSet.has(resourceIdMatch)) {
    resourceIdsSet = new Set([resourceIdMatch]);
  }

  const datasets = await db
    .collection("metadata")
    .find({
      "resources.id": { $in: resourceIdsArray },
    })
    .toArray();

  const dataSetDict = {};
  for (let d of datasets) {
    if (dataSetDict[d._id]) {
      continue;
    }
    d.resources = d.resources.filter((r) => resourceIdsSet.has(r.id));
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
  let keyword = req.query.q;
  if (!keyword) {
    return res.sendStatus(400);
  }
  keyword = keyword.toLowerCase().trim();
  const splittedKeywords = keyword.split(" ");
  const must = [];
  splittedKeywords.forEach((k) => {
    must.push({ term: { values: k } });
  });
  const query = {
    bool: {
      should: [
        // { match: { values: keyword } },
        {
          bool: {
            must,
          },
        },
      ],
    },
  };
  // console.log(JSON.stringify(query, null, 2));
  const found = await client.search({
    index: config.elasticsearch.index,
    body: {
      from: 0,
      size: 8000,

      query,
    },
  });
  const documentsMatchedDict = {};
  found.body.hits.hits.forEach((b) => {
    const uuid = adddashestouuid(b._source.file_id.split("-").join(""));
    const matchedFields = [];

    for (let i = 0; i < b._source.values.length; ++i) {
      const k = b._source.fields[i];
      const v = String(b._source.values[i]).toLowerCase();
      if (v.includes(keyword)) {
        matchedFields.push(k);
        continue;
      }
      for (let kw of splittedKeywords) {
        if (v.includes(kw)) {
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
    let matchedCount = 0;
    for (let r of d.resources) {
      r.matches = documentsMatchedDict[r.id];
      matchedCount += r.matches.count;
    }
    d.matched_count = matchedCount;
    dataSetDict[d._id] = d;
  }
  const output = Object.values(dataSetDict).sort(
    (a, b) => b.matched_count - a.matched_count
  );
  res.send(output);
});

module.exports = router;
