const FsPromises = require("fs/promises");
const Fs = require("fs");
const CsvParser = require("csv-parser");
const Mkdirp = require("mkdirp");
const Path = require("path");
const Axios = require("axios");
const Underscore = require("underscore");

const CSV_PATH = "../data/metadata.csv";
const JSON_DIR = "../data/json/";
const FILES_DIR = "../data/files/";
const JSON_SUFFIX = ".json";
const COL_NAME = "id_s";
const NUMBER_OF_THREADS = 10;

const FORMATS_OF_INTEREST = new Set([
  "CSV",
  "XLS",
  // "XML",
  // "SQLITE",
  // "JSON",
  // "JSONL",
  "XLSL",
]);

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

const generateFilesList = async (uuids) => {
  const files = [];
  for (uuid of uuids) {
    const fileName = uuid + JSON_SUFFIX;
    const filePath = Path.join(JSON_DIR, fileName);
    const data = JSON.parse(await FsPromises.readFile(filePath));
    const resources = data.resources;
    for (r of resources) {
      if (!FORMATS_OF_INTEREST.has(r.format.toUpperCase())) {
        continue;
      }
      if (!r.id || !r.url) {
        continue;
      }
      files.push({ id: r.id, url: r.url, format: r.format.toLowerCase() });
    }
  }
  return files;
};

const filterFilesList = async (filesList) => {
  const filtered = [];
  for (metadata of filesList) {
    const fileName = `${metadata.id}.${metadata.format}`;
    const filePath = Path.join(FILES_DIR, fileName);
    const fileExists = await FsPromises.access(filePath, Fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (fileExists) {
      continue;
    }
    filtered.push(metadata);
  }
  return filtered;
};

const downloadFile = async (metadata) => {
  const fileName = `${metadata.id}.${metadata.format}`;
  const filePath = Path.join(FILES_DIR, fileName);
  try {
    const res = await Axios({
      method: "get",
      url: metadata.url,
      responseType: "stream",
    });
    const writer = Fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      let e;
      writer.on("error", (err) => {
        e = err;
        writer.close();
        return reject(err);
      });
      writer.on("close", () => {
        if (!e) {
          return resolve(true);
        }
      });
    });
  } catch (_) {}
};

(async () => {
  await Mkdirp(JSON_DIR);
  await Mkdirp(FILES_DIR);
  const uuids = await extractUUIDs();
  console.log(uuids.length, "UUIDs extracted");
  const fileList = await generateFilesList(uuids);
  console.log(
    fileList.length,
    "URLs for",
    JSON.stringify([...FORMATS_OF_INTEREST]),
    "formats extracted"
  );
  const filtered = await filterFilesList(fileList);
  const shuffled = Underscore.shuffle(filtered);
  console.log(shuffled.length, "files not downloaded");
  while (shuffled.length > 0) {
    const promises = [];
    for (let i = 0; i < NUMBER_OF_THREADS; ++i) {
      const curr = shuffled.pop();
      if (curr) {
        promises.push(downloadFile(curr));
      }
    }
    await Promise.all(promises);
    console.log(
      filtered.length - shuffled.length,
      "/",
      filtered.length,
      "files downloaded"
    );
  }
  process.exit(0);
})();
