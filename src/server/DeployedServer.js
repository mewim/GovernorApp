const express = require("express");
const api = require("./API");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/api", api);
const filesPath = path.join(__dirname, "..", "..", "data", "files");
app.use("/files", express.static(filesPath));
const distPath = path.join(__dirname, "..", "..", "dist");
app.use("/", express.static(distPath));

app.listen(8000, () => {
  console.log("Deployed server started on port 8000");
});

process.on("SIGINT", function () {
  console.log("Shutting down from SIGINT (Ctrl-C)...");
  process.exit(0);
});
