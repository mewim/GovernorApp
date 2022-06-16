const mongodb = require("mongodb");
const MONGO_URI = "mongodb://127.0.0.1:27017/";

let db;
let mongoClient;

const connectMongo = async () => {
  const client = new mongodb.MongoClient(MONGO_URI, {
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
    db = mongoClient.db("opencanada");
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
