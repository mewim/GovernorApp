const mongodb = require("mongodb");
const path = require("path");
const fs = require("fs/promises");

let db;
let mongoClient;
let dbName;
let mongoUri;

const connectMongo = async () => {
  if (!mongoUri || !dbName) {
    const config = JSON.parse(
      await fs.readFile(path.join(__dirname, "../../app.config.json"))
    );
    mongoUri = config.mongodb.uri;
    dbName = config.mongodb.db;
  }
  const client = new mongodb.MongoClient(mongoUri, {
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    return client;
  } catch (err) {
    console.log("Cannot connect to MongoDB", err);
  }
};

const getDb = async () => {
  if (!db) {
    mongoClient = await connectMongo();
    db = mongoClient.db(dbName);
    process.on("SIGTERM", () => {
      disconnect();
      console.log("Shutting down from SIGTERM ...");
      process.exit(0);
    });
    process.on("SIGINT", () => {
      disconnect();
      console.log("Shutting down from SIGINT ...");
      process.exit(0);
    });
  }
  return db;
};

const disconnect = () => {
  mongoClient.close();
};
module.exports = {
  connectMongo,
  getDb,
  disconnect,
};
