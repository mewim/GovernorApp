const fs = require("fs/promises");
const path = require("path");
const MongoUtil = require("../src/server/MongoUtil");

const JSON_DIR = path.join(__dirname, "../data/json/");

(async () => {
  console.log("Connecting to MongoDB...");
  const db = await MongoUtil.getDb();

  let files;
  try {
    files = await fs.readdir(JSON_DIR);
  } catch (_) {
    files = [];
  }
  for (let f of files) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(JSON_DIR, f)));
      await db.collection("metadata").insertOne(json);
    } catch (err) {
      // ignore error
    }
  }

  console.log("All done");

  MongoUtil.disconnect();
  console.log("Disconnected from MongoDB");
  process.exit(0);
})();
