const express = require("express");
const api = require("./API");
const path = require("path");
module.exports = (app) => {
  app.use(express.json({ limit: "16mb" }));
  app.use("/api", api);
  const filesPath = path.join(__dirname, "..", "..", "data", "files");
  app.use("/files", express.static(filesPath));
};
