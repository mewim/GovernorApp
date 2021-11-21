const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const path = require("path");
const { createReadStream } = require("fs");
const { spawn } = require("child_process");
const { createInterface } = require("node:readline/promises");
const COLLECTION = "inferredstats";

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
  const stream = createReadStream(path.join(CSV_BASE_PATH, `${uuid}.csv`));
  stream.pipe(pythonEncodingConverter.stdin);
  res.setHeader("content-type", "text/csv");
  if (!rows) {
    return pythonEncodingConverter.stdout.pipe(res);
  }
  if (rows.length === 0) {
    return res.send("");
  }

  const rl = createInterface({
    input: pythonEncodingConverter.stdout,
    crlfDelay: Infinity,
  });

  const lastLine = Math.max.apply(Math, rows);
  const rowsSet = new Set(rows);
  let i = 0;
  for await (const line of rl) {
    if (!rowsSet.has(i)) {
      ++i;
      continue;
    }
    await new Promise((resolve, reject) => {
      if (res.destroyed) {
        return resolve();
      }
      res.write(line + "\n", (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });

    if (i === lastLine && !res.destroyed) {
      res.end();
    }
    ++i;
  }
  try {
    pythonEncodingConverter.stdout.pause();
    pythonEncodingConverter.kill("SIGKILL");
  } catch (e) {
    // continue anyway
  }
});

module.exports = router;
