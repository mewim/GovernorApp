const ElasticClient = require("@elastic/elasticsearch").Client;

const client = new ElasticClient({
  node: "http://localhost:9200",
  auth: {
    bearer: "token",
  },
});

(async () => {
  await client.indices.delete({ index: "tuples" });
  await client.indices.create({
    index: "tuples",
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
