const mongodb = require("mongodb");
const MONGO_URI =
  "mongodb://localhost";

let db;
let mongoClient;

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

const getDb = async () => {
  if (!db) {
    mongoClient = await connectMongo();
    db = mongoClient.db("spotify");
    process.on("SIGTERM", () => {
      disconnect();
    });
    process.on("SIGINT", () => {
      disconnect();
    });
  }
  return db;
};

const disconnect = () => {
  mongoClient.close();
  console.log("MongoDB connection closed");
};
module.exports = {
  connectMongo,
  getDb,
};