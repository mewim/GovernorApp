const ElasticClient = require("@elastic/elasticsearch").Client;
const Fs = require("fs");
const FsPromises = require("fs/promises");
const CsvParser = require("csv-parser");
const Path = require("path");
const ChildProcess = require("child_process");
const MongoUtil = require("../src/server/MongoUtil");
const IconvLite = require("iconv-lite");
const Iconv = require("iconv").Iconv;

const FILE_SIZE_THRESHOLD = 1e9;
const ELASTIC_CHUNK_SIZE = 1000;
const MISSING_VALUES = new Set([
  "",
  "nan",
  "null",
  "n/a",
  "n/d",
  "-",
  "...",
  "(n/a)",
]);

const TRUE_VALUE = new Set(["1", "true"]);
const FALSE_VALUE = new Set(["0", "false"]);

const ERROR_TYPES = {
  FILE_TOO_LARGE: 0,
  PYTHON_FAILED: 1,
  ELASTIC_FAILED: 2,
  PARSER_FAILED: 3,
};

const PYTHON_SCRIPT_PATH = Path.join(__dirname, "CSVInferer.py");
const PYTHON_ENCODING_CONVERTER_PATH = Path.join(
  __dirname,
  "EncodingConverter.py"
);

const parseCSV = (path, encoding) => {
  return new Promise((resolve) => {
    let iconvLite;
    let iconv;
    let pythonEncodingConverter;

    try {
      iconvLite = {
        decoder: IconvLite.decodeStream(encoding),
        encoder: IconvLite.encodeStream("utf8"),
      };
    } catch (err) {
      // continue regardless of error
    }
    if (!iconvLite) {
      try {
        iconv = new Iconv(encoding, "utf-8");
      } catch (err) {
        // continue regardless of error
      }
    }
    if (!iconv) {
      pythonEncodingConverter = ChildProcess.spawn("python3", [
        PYTHON_ENCODING_CONVERTER_PATH,
        encoding,
      ]);
    }
    const results = [];
    let stream = Fs.createReadStream(path);
    if (iconvLite) {
      stream.pipe(iconvLite.decoder).pipe(iconvLite.encoder);
    } else if (iconv) {
      stream.pipe(iconv);
    } else {
      stream.pipe(pythonEncodingConverter.stdin);
      stream = pythonEncodingConverter.stdout;
    }
    stream
      .pipe(CsvParser({ headers: false }))
      .on("data", (data) => results.push(Object.values(data)))
      .on("end", () => {
        return resolve(results);
      });
  });
};

const runPythonInferer = (uuid) => {
  return new Promise((resolve, reject) => {
    ChildProcess.execFile(
      "python3",
      [PYTHON_SCRIPT_PATH, uuid],
      (error, stdout) => {
        if (error) {
          return reject(error);
        }
        return resolve(stdout);
      }
    );
  });
};

const updateJobStats = async (db, uuid, error) => {
  const stats = { uuid, attempted: true, success: !error };
  if (error) {
    stats.error_code = error;
  }
  await db.collection("processedfiles").findOneAndReplace({ uuid }, stats, {
    upsert: true,
  });
};

const client = new ElasticClient({
  node: "http://localhost:9200",
});

const path = process.argv[2];
console.log("Processing", path);
if (!path) {
  process.exit(1);
}

const uuid = Path.basename(path, Path.extname(path));

const closeDbAndExit = () => {
  MongoUtil.disconnect();
  process.exit(0);
};

(async () => {
  const db = await MongoUtil.getDb();

  const fileStats = await FsPromises.stat(path);
  if (fileStats.size > FILE_SIZE_THRESHOLD) {
    updateJobStats(db, uuid, ERROR_TYPES.FILE_TOO_LARGE);
    console.log("File is too large, quitting");
    closeDbAndExit();
  }

  const processed = await db.collection("processedfiles").findOne({ uuid });
  if (processed) {
    console.log("Document has been processed, quitting");
    closeDbAndExit();
  }

  let inferredStats;
  try {
    await runPythonInferer(uuid);
    inferredStats = await db.collection("inferredstats").findOne({ uuid });
  } catch (err) {
    // continue regardless of error
  }
  if (!inferredStats) {
    await updateJobStats(db, uuid, ERROR_TYPES.PYTHON_FAILED);
    console.log("File inference failed, quitting");
    closeDbAndExit();
  }

  let parsedDataset;
  try {
    const table = await parseCSV(path, inferredStats.encoding);
    const dataset = [];
    for (let i = 0; i < table.length; ++i) {
      if (i === inferredStats.header) {
        continue;
      }
      const currentRow = table[i];
      const rowDict = {};
      for (let j = 0; j < currentRow.length; ++j) {
        const field = inferredStats.schema.fields[j];
        const fieldName = field.name;
        const fieldType = field.type;
        const rawValue = currentRow[j];
        if (MISSING_VALUES.has(rawValue.toLowerCase())) {
          rowDict[fieldName] = null;
          continue;
        }
        if (fieldType === "number" || fieldType === "integer") {
          rowDict[fieldName] = Number.parseFloat(rawValue);
        } else if (fieldType === "boolean") {
          if (TRUE_VALUE.has(rawValue.toLowerCase())) {
            rowDict[fieldName] = true;
          } else if (FALSE_VALUE.has(rawValue.toLowerCase())) {
            rowDict[fieldName] = false;
          } else {
            rowDict[fieldName] = null;
          }
        } else {
          rowDict[fieldName] = rawValue;
        }
      }
      dataset.push({ file_id: uuid, row_number: i, tuple: rowDict });
    }
    parsedDataset = dataset;
  } catch (err) {
    // continue regardless of error
  }
  if (!parsedDataset) {
    await updateJobStats(db, uuid, ERROR_TYPES.PARSER_FAILED);
    console.log("File parsing failed, quitting");
    closeDbAndExit();
  }

  try {
    for (let i = 0; i < parsedDataset.length; i += ELASTIC_CHUNK_SIZE) {
      const chunk = parsedDataset.slice(i, i + ELASTIC_CHUNK_SIZE);
      const body = chunk.flatMap((doc) => [
        { index: { _index: "tuples" } },
        doc,
      ]);
      await client.bulk({ refresh: true, body });
    }
  } catch (err) {
    await updateJobStats(db, uuid, ERROR_TYPES.ELASTIC_FAILED);
    console.log("Elasticsearch indexing failed, quitting");
    closeDbAndExit();
  }

  await updateJobStats(db, uuid);
  MongoUtil.disconnect();
})();
