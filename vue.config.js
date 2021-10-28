const configureAPI = require("./src/server/Configure");

module.exports = {
  devServer: {
    before: configureAPI,
  },
};