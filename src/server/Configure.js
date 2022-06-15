const express = require("express");
const api = require("./API");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");
module.exports = (app) => {
  if (process.env.PROXY_API_REQUESTS) {
    app.use(
      "/api",
      createProxyMiddleware({
        target: "http://waterloo.mew.im:8000/",
        changeOrigin: true,
      })
    );
    app.use(
      "/files",
      createProxyMiddleware({
        target: "http://waterloo.mew.im:8000/",
        changeOrigin: true,
      })
    );
  } else {
    app.use(express.json({ limit: "16mb" }));
    app.use("/api", api);
    const filesPath = path.join(__dirname, "..", "..", "data", "files");
    app.use("/files", express.static(filesPath));
  }
};
