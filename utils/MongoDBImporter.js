const mongodb = require("mongodb");
const fs = require("fs/promises");
const path = require("path");

const JSON_DIR = path.join(__dirname, "../data/json/");

const connectMongo = async (uri) => {
  const client = new mongodb.MongoClient(uri, {
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected successfully to MongoDB");
    return client;
  } catch (err) {
    console.log("Cannot connect to MongoDB", err);
  }
};

(async () => {
  const config = JSON.parse(
    await fs.readFile(path.join(__dirname, "../app.config.json"))
  );
  const mongoUri = config.mongodb.uri;

  console.log("Connecting to MongoDB...");
  const mongoClient = await connectMongo(mongoUri);
  const db = mongoClient.db(config.mongodb.collection);

  const files = await fs.readdir(JSON_DIR);
  for (let f of files) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(JSON_DIR, f)));
      await db.collection("metadata").insertOne(json);
    } catch (err) {
      // ignore error
    }
  }

  console.log("All done");

  mongoClient.close();
  console.log("Disconnected from MongoDB");
  process.exit(0);
})();
