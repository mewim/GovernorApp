const Axios = require("axios");
const FsPromises = require("fs/promises");
const Fs = require("fs");

const PATH = "../data/metadata.csv";
const URL =
  "https://search.open.canada.ca/en/od/export/?sort=last_modified_tdt+desc&page=1&search_text=&od-search-portal=Open+Data%7COpen+Information";

(async () => {
  const fileExists = await FsPromises.access(PATH, Fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (fileExists) {
    console.log("CSV File exists, quitting...");
    process.exit(0);
  }

  console.log("Downloading CSV metadata from open.canada.ca...");
  const res = await Axios.get(URL);
  const text = res.data;

  console.log("CSV downloaded, size =", text.length);
  await FsPromises.writeFile(PATH, text);
  console.log("CSV saved to", PATH);
  process.exit(0);
})();
