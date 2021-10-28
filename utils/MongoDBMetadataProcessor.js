const mongodb = require("mongodb");
const fs = require("fs/promises");
const path = require("path");

const JSON_DIR = "../data/json/";
const MONGO_URI = "mongodb://127.0.0.1:27017/";

const connectMongo = async () => {
  const client = new mongodb.MongoClient(MONGO_URI, {
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

const main = async () => {
  console.log("Connecting to MongoDB...");
  const mongoClient = await connectMongo();
  const db = mongoClient.db("opencanada");

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
};

main();
