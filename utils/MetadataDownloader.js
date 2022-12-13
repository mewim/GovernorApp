const Axios = require("axios");
const FsPromises = require("fs/promises");
const Mkdirp = require("mkdirp");
const Path = require("path");

const JSON_DIR = Path.join(__dirname, "../data/json/");
const JSON_SUFFIX = ".json";
const BATCH_SIZE = 100;

const downloadMetadata = async (url, offset) => {
  try {
    const res = await Axios.get(`${url}?start=${offset}&rows=${BATCH_SIZE}`);
    const data = res.data;
    if (data.success) {
      return data.result.results;
    }
  } catch (_) {
    // continue regardless of error
  }
};

(async () => {
  const config = JSON.parse(
    await FsPromises.readFile(Path.join(__dirname, "../app.config.json"))
  );
  const apiUrl = config.portal.packageApiUrl;
  await Mkdirp(JSON_DIR);
  let count = 0;
  for (let i = 0; ; i += BATCH_SIZE) {
    const result = await downloadMetadata(apiUrl, i);
    if (result.length === 0) {
      process.exit(0);
    }

    for (let r of result) {
      const uuid = r.id;
      const fileName = uuid + JSON_SUFFIX;
      const filePath = Path.join(JSON_DIR, fileName);
      await FsPromises.writeFile(filePath, JSON.stringify(r));
      count += 1;
    }
    console.log(count, "metadata files downloaded");
  }
})();
