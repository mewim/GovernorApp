const FsPromises = require("fs/promises");
const Fs = require("fs");
const Mkdirp = require("mkdirp");
const Path = require("path");
const Axios = require("axios");
const Underscore = require("underscore");
const PromisePool = require("es6-promise-pool");

const JSON_DIR = Path.join(__dirname, "../data/json/");
const FILES_DIR = Path.join(__dirname, "../data/files/");
const JSON_SUFFIX = ".json";

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
  const results = [];
  const files = await FsPromises.readdir(JSON_DIR);
  for (let file of files) {
    if (!file.endsWith(JSON_SUFFIX)) {
      continue;
    }
    const fileNameWithoutSuffix = file.slice(0, -JSON_SUFFIX.length);
    results.push(fileNameWithoutSuffix);
  }

  return results;
};

const generateFilesList = async (uuids) => {
  const files = [];
  for (let uuid of uuids) {
    const fileName = uuid + JSON_SUFFIX;
    const filePath = Path.join(JSON_DIR, fileName);
    const data = JSON.parse(await FsPromises.readFile(filePath));
    const resources = data.resources;
    for (let r of resources) {
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
  for (let metadata of filesList) {
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
  } catch (_) {
    // skip unaccessible files
  }
};

(async () => {
  const config = JSON.parse(
    await FsPromises.readFile(Path.join(__dirname, "../app.config.json"))
  );
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

  const promiseProducer = () => {
    console.log(
      filtered.length - shuffled.length,
      "/",
      filtered.length,
      "files downloaded"
    );
    if (shuffled.length === 0) {
      return null;
    }
    const curr = shuffled.pop();
    return downloadFile(curr);
  };
  const pool = new PromisePool(
    promiseProducer,
    config.portal.fileDownloaderConcurrency
  );
  await new Promise((resolve, reject) => {
    pool.start().then(
      () => {
        return resolve();
      },
      (err) => {
        return reject(err);
      }
    );
  });
  console.log("All done");
  process.exit(0);
})();
