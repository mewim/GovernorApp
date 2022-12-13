const Fs = require("fs/promises");
const Path = require("path");
const MongoUtil = require("../src/server/MongoUtil");

(async () => {
  const config = JSON.parse(
    await Fs.readFile(Path.join(__dirname, "../app.config.json"))
  );

  console.log("Connecting to MongoDB...");
  const db = await MongoUtil.getDb();
  const metadataCollection = db.collection("metadata");

  console.log("Creating indexes...");
  const metadataIndexFields = config.mongodb.metadataIndexFields;
  await metadataCollection.createIndex(metadataIndexFields, {
    language_override: "dummy",
    name: "text_search_en",
  });
  await metadataCollection.createIndex({ "resources.id": -1 });
  await metadataCollection.createIndex({ "resources.id": 1 });
  await metadataCollection.createIndex({ id: -1 });
  await metadataCollection.createIndex({ id: 1 });
  console.log("Created index for metadata");

  const inferredcolumnstatsCollection = db.collection("inferredcolumnstats");
  await inferredcolumnstatsCollection.createIndex({ uuid: 1, index: 1 });
  console.log("Created index for inferredcolumnstats");

  const inferredhistogramsCollection = db.collection("inferredhistograms");
  await inferredhistogramsCollection.createIndex({ uuid: 1 });
  await inferredhistogramsCollection.createIndex({ uuid: -1 });
  console.log("Created index for inferredhistograms");

  const inferredstatsCollection = db.collection("inferredstats");
  await inferredstatsCollection.createIndex({ uuid: 1 });
  await inferredstatsCollection.createIndex({ uuid: -1 });
  console.log("Created index for inferredstats");

  const keyjoinscoresCollection = db.collection("keyjoinscores");
  await keyjoinscoresCollection.createIndex({
    query_uuid: 1,
    query_index: 1,
  });
  await keyjoinscoresCollection.createIndex({ query_uuid: 1 });
  await keyjoinscoresCollection.createIndex({
    query_uuid: 1,
    target_uuid: 1,
  });
  console.log("Created index for keyjoinscores");

  const sameschemagroupsCollection = db.collection("sameschemagroups");
  await sameschemagroupsCollection.createIndex({ uuids: 1 });
  console.log("Created index for sameschemagroups");

  console.log("All done");
  MongoUtil.disconnect();
  console.log("Disconnected from MongoDB");
  process.exit(0);
})();
