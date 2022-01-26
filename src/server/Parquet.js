const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const path = require("path");
const { spawn } = require("child_process");
const COLLECTION = "inferredstats";

const CSV_BASE_PATH = path.join(__dirname, "..", "..", "data", "files");
const PYTHON_PARQUET_CONVERTER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "CSVToParquetConverter.py"
);

router.get("/:uuid.parquet", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuid = req.params.uuid;
  const found = await db.collection(COLLECTION).findOne({ uuid });

  if (!found) {
    return res.sendStatus(404);
  }
  const encoding = found.encoding;
  const header = found.header;
  const parquetConverter = spawn("python3", [
    PYTHON_PARQUET_CONVERTER_PATH,
    path.join(CSV_BASE_PATH, `${uuid}.csv`),
    encoding,
    header,
  ]);
  parquetConverter.stdin.on("error", () => {
    // ignore error on SIGKILL of the Python process so we can quit early
    return;
  });
  res.setHeader("content-type", "application/octet-stream");
  res.set('cache-control', 'public, max-age=31536000')
  return parquetConverter.stdout.pipe(res);
});

module.exports = router;
