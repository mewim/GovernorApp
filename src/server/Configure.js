const express = require("express");
const api = require("./API");

module.exports = (app) => {
  app.use(express.json());
  app.use("/api", api);
};