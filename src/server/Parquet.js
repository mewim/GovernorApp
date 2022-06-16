const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const path = require("path");
const { spawn } = require("child_process");
const COLLECTION = "inferredstats";
const fs = require("fs");

const CSV_BASE_PATH = path.join(__dirname, "..", "..", "data", "files");
const PARQUET_CACHE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "parquet_cache"
);
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

  const useNumberIndex = true;

  res.setHeader("content-type", "application/octet-stream");
  res.set("cache-control", "public, max-age=31536000");

  const fileName = `${uuid}${useNumberIndex ? "_num_index" : ""}.parquet`;
  const filePath = path.join(PARQUET_CACHE_PATH, fileName);
  const isFileExists = await new Promise((resolve) => {
    fs.access(filePath, fs.F_OK, (err) => {
      if (err) {
        return resolve(false);
      }
      return resolve(true);
    });
  });
  if (isFileExists) {
    return res.sendFile(filePath);
  }

  const fieldNames = found.schema.fields.map((f) => f.name);
  const encoding = found.encoding;
  const header = found.header;

  const params = [
    PYTHON_PARQUET_CONVERTER_PATH,
    path.join(CSV_BASE_PATH, `${uuid}.csv`),
    encoding,
    header,
  ];
  if (!useNumberIndex) {
    params.push(JSON.stringify(fieldNames));
  }

  const parquetConverter = spawn("python3", params);
  parquetConverter.stderr.pipe(process.stdout);

  parquetConverter.stdin.on("error", () => {
    // ignore error on SIGKILL of the Python process so we can quit early
    return;
  });

  return parquetConverter.stdout.pipe(res);
});

module.exports = router;
