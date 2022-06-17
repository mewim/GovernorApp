const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "inferredcolumnstats";

router.get("/:uuid/topuniquecolumns", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuid = req.params.uuid;
  let k = parseInt(req.query.k);
  if (isNaN(k)) {
    k = 6;
  }
  const found = (
    await db
      .collection(COLLECTION)
      .find({ uuid })
      .project({ _id: false, index: true, uniqueness_score: true })
      .sort({ uniqueness_score: -1 })
      .limit(k)
      .toArray()
  ).map((x) => x.index);

  return res.send(found);
});

module.exports = router;
