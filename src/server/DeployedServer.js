const express = require("express");
const api = require("./API");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/api", api);
const distPath = path.join(__dirname, "..", "..", "dist");
app.use("/", express.static(distPath));

app.listen(8080, () => {
  console.log("Deployed server started on port 8080");
});

process.on("SIGINT", function () {
  console.log("Shutting down from SIGINT (Ctrl-C)...");
  process.exit(0);
});
