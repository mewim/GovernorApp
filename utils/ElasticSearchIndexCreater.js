const ElasticClient = require("@elastic/elasticsearch").Client;
const Fs = require("fs/promises");
const Path = require("path");

(async () => {
  const config = JSON.parse(
    await Fs.readFile(Path.join(__dirname, "../app.config.json"))
  );
  const elasticUri = config.elasticsearch.uri;
  const elasticIndex = config.elasticsearch.index;
  const elasticToken = config.elasticsearch.token;
  
  const client = new ElasticClient({
    node: elasticUri,
    auth: {
      bearer: elasticToken,
    },
  });

  try {
    await client.indices.delete({ index: elasticIndex });
  } catch (err) {
    // ignore, index may not exist
  }
  await client.indices.create({
    index: elasticIndex,
    body: {
      mappings: {
        properties: {
          file_id: { type: "text" },
          row_number: { type: "long" },
          tuple: { type: "flattened" },
        },
      },
    },
  });
})();
