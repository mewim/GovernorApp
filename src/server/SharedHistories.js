const express = require("express");
const { ObjectId } = require("mongodb");
const router = express.Router();
const mongoUtil = require("./MongoUtil");

const COLLECTION = "sharedhistories";

router.get("/:_id", async (req, res) => {
  const _id = req.params._id;
  const db = await mongoUtil.getDb();
  try {
    const result = await db
      .collection(COLLECTION)
      .findOne({ _id: ObjectId(_id) });
    return res.send(result);
  } catch (err) {
    return res.sendStatus(404);
  }
});

router.post("/", async (req, res) => {
  const body = req.body;
  const db = await mongoUtil.getDb();
  try {
    const result = await db.collection(COLLECTION).insertOne(body);
    return res.send({ _id: result.insertedId.toString() });
  } catch (err) {
    return res.sendStatus(500);
  }
});
module.exports = router;
