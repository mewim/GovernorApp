const ElasticClient = require("@elastic/elasticsearch").Client;
const Fs = require("fs");
const CsvParser = require("csv-parser");
const Path = require("path");

const parseCSV = (path) => {
  return new Promise((resolve, _) => {
    const results = [];
    Fs.createReadStream(path)
      .pipe(CsvParser({ headers: false }))
      .on("data", (data) => results.push(Object.values(data)))
      .on("end", () => {
        return resolve(results);
      });
  });
};

const client = new ElasticClient({
  node: "http://localhost:9200",
  auth: {
    bearer: "token",
  },
});

const path = process.argv[2];
console.log("Processing", path);
if (!path) {
  process.exit(1);
}

const uuid = Path.basename(path, Path.extname(path)).split("-").join("");

(async () => {
  const table = await parseCSV(path);
  const dataset = table.map((r, i) => {
    return { file_id: uuid, row_number: i, tuple: r };
  });
  const found = await client.search({
    index: "processed",
    body: {
      query: {
        match: {
          id: uuid,
        },
      },
    },
  });
  const doc = found.body.hits.hits[0];
  if (doc) {
    console.log("Document has been processed, quitting");
    process.exit(0);
  }
  const body = dataset.flatMap((doc) => [{ index: { _index: "tuples" } }, doc]);
  const { body: bulkResponse } = await client.bulk({ refresh: true, body });
  await client.index({
    index: "processed",
    body: { id: uuid },
  });
})();
