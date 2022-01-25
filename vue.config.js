const path = require("path");
const DUCKDB_DIST = path.dirname(require.resolve("@duckdb/duckdb-wasm"));
const CopyWebpackPlugin = require("copy-webpack-plugin");
const configureAPI = require("./src/server/Configure");

module.exports = {
  devServer: {
    before: configureAPI,
  },
  configureWebpack: {
    plugins: [
      new CopyWebpackPlugin([
        {
          from: DUCKDB_DIST,
          to: "js",
          toType: "dir",
        },
      ]),
    ],
  },
};