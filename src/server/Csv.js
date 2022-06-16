const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const path = require("path");
const { createReadStream } = require("fs");
const { spawn } = require("child_process");
const COLLECTION = "inferredstats";
const csvPaser = require("csv-parser");
const csvStringify = require("csv-stringify/sync").stringify;

const CSV_BASE_PATH = path.join(__dirname, "..", "..", "data", "files");
const PYTHON_ENCODING_CONVERTER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "EncodingConverter.py"
);

router.post("/:uuid", async (req, res) => {
  const db = await mongoUtil.getDb();
  const uuid = req.params.uuid;
  const found = await db.collection(COLLECTION).findOne({ uuid });
  const rows = req.body.rows;

  if (!found) {
    return res.sendStatus(404);
  }
  const encoding = found.encoding;
  const pythonEncodingConverter = spawn("python3", [
    PYTHON_ENCODING_CONVERTER_PATH,
    encoding,
  ]);
  pythonEncodingConverter.stdin.on("error", () => {
    // ignore error on SIGKILL of the Python process so we can quit early
    return;
  });
  const stream = createReadStream(path.join(CSV_BASE_PATH, `${uuid}.csv`));
  stream.pipe(pythonEncodingConverter.stdin);
  res.setHeader("content-type", "text/csv");
  if (!rows) {
    return pythonEncodingConverter.stdout.pipe(res);
  }
  if (rows.length === 0) {
    return res.send("");
  }

  let i = 0;
  const lastLine = Math.max.apply(Math, rows);
  const skipLines = Math.min.apply(Math, rows) - 1;
  const paserOptions = { headers: false };
  if (skipLines > 0) {
    paserOptions.skipLines = skipLines;
    i = skipLines;
  }
  const rowsSet = new Set(rows);

  pythonEncodingConverter.stdout
    .pipe(csvPaser(paserOptions))
    .on("data", (data) => {
      if (!rowsSet.has(i)) {
        ++i;
        return;
      }
      const stringified = csvStringify([Object.values(data)]);
      if (!res.destroyed) {
        res.write(stringified);
      }
      if (i === lastLine) {
        if (!res.destroyed) {
          res.end();
        }
        try {
          pythonEncodingConverter.stdout.pause();
          pythonEncodingConverter.kill("SIGKILL");
        } catch (e) {
          // continue anyway
        }
      }
      ++i;
    });
});

module.exports = router;
