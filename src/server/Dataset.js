const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "metadata";
const INFERREDSTATS_COLLECTION = "inferredstats";

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const csvOnly = req.query.csv_only;

  const uuid = req.params.uuid;
  const found = await db.collection(COLLECTION).findOne({ id: uuid });

  if (!found) {
    return res.sendStatus(404);
  }
  if (csvOnly === "true" || csvOnly === "1") {
    const resourceIds = found.resources.map((r) => r.id);
    const matchedResources = await db
      .collection(INFERREDSTATS_COLLECTION)
      .find({
        uuid: {
          $in: resourceIds,
        },
      })
      .project({ uuid: 1 })
      .toArray();

    const matchedResourcesSet = new Set(matchedResources.map((r) => r.uuid));
    found.resources = found.resources.filter((r) =>
      matchedResourcesSet.has(r.id)
    );
  }
  return res.send(found);
});

router.get("/", async (req, res) => {
  const db = await mongoUtil.getDb();
  const resourceId = req.query.resource_id;
  const found = await db
    .collection(COLLECTION)
    .findOne({ "resources.id": resourceId });

  if (!found) {
    return res.sendStatus(404);
  }

  return res.send(found);
});

module.exports = router;
