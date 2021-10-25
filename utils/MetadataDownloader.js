const Axios = require("axios");
const FsPromises = require("fs/promises");
const Fs = require("fs");
const CsvParser = require("csv-parser");
const Mkdirp = require("mkdirp");
const Path = require("path");

const CSV_PATH = "../data/metadata.csv";
const JSON_DIR = "../data/json/";
const JSON_SUFFIX = ".json";
const URL_PREFIX = "https://open.canada.ca/data/api/action/package_show?id=";
const COL_NAME = "id_s";

const extractUUIDs = async () => {
  const uuids = await new Promise((resolve, _) => {
    const results = [];
    Fs.createReadStream(CSV_PATH)
      .pipe(CsvParser())
      .on("data", (data) => results.push(data[COL_NAME]))
      .on("end", () => {
        return resolve(results);
      });
  });
  return uuids;
};

const filterUUIDs = async (uuids) => {
  const filtered = [];
  for (uuid of uuids) {
    const fileName = uuid + JSON_SUFFIX;
    const filePath = Path.join(JSON_DIR, fileName);
    const fileExists = await FsPromises.access(filePath, Fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (fileExists) {
      continue;
    }
    filtered.push(uuid);
  }
  return filtered;
};

const downloadJSON = async (uuid) => {
  const fileName = uuid + JSON_SUFFIX;
  const filePath = Path.join(JSON_DIR, fileName);
  try {
    const res = await Axios.get(URL_PREFIX + uuid);
    const data = res.data;
    if (data.success) {
      await FsPromises.writeFile(filePath, JSON.stringify(data.result));
    }
  } catch (_) {}
};

(async () => {
  await Mkdirp(JSON_DIR);
  const uuids = await extractUUIDs();
  console.log(uuids.length, "UUIDs extracted");
  const filtered = await filterUUIDs(uuids);
  console.log(filtered.length, "UUIDs not processed");

  for (let i = 0; i < filtered.length; ++i) {
    await downloadJSON(filtered[i]);
    console.log(i + 1, "/", filtered.length, "UUIDs processed");
  }
  process.exit(0);
})();
