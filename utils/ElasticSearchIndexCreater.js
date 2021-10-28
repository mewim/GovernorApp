const ElasticClient = require("@elastic/elasticsearch").Client;

const client = new ElasticClient({
  node: "http://localhost:9200",
  auth: {
    bearer: "token",
  },
});

(async () => {
  await client.indices.create({ index: "tuples" });
  await client.indices.create({ index: "processed" });
})();
