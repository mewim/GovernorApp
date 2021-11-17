const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const path = require("path");
const { createReadStream } = require("fs");
const { spawn } = require("child_process");
const COLLECTION = "inferredstats";

const CSV_BASE_PATH = path.join(__dirname, "..", "..", "data", "files");
const PYTHON_ENCODING_CONVERTER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "EncodingConverter.py"
);

router.get("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuid = req.params.uuid;
  const found = await db.collection(COLLECTION).findOne({ uuid });
  if (!found) {
    return res.sendStatus(404);
  }
  const encoding = found.encoding;
  const pythonEncodingConverter = spawn("python3", [
    PYTHON_ENCODING_CONVERTER_PATH,
    encoding,
  ]);
  const stream = createReadStream(path.join(CSV_BASE_PATH, `${uuid}.csv`));
  stream.pipe(pythonEncodingConverter.stdin);
  res.setHeader("content-type", "text/csv");
  pythonEncodingConverter.stdout.pipe(res);
});

module.exports = router;
