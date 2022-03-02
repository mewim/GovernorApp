const express = require("express");
const api = require("./API");
const path = require("path");

const app = express();
const PORT = 8000;
app.use(express.json());
app.use("/api", api);
const distPath = path.join(__dirname, "..", "..", "dist");
app.use("/", express.static(distPath, { maxAge: 31536000 }));

app.listen(PORT, () => {
  console.log("Deployed server started on port:", PORT);
});

process.on("SIGINT", function () {
  console.log("Shutting down from SIGINT (Ctrl-C)...");
  process.exit(0);
});
