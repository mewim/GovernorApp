const express = require("express");
const router = express.Router();
const path = require("path");
const { spawn } = require("child_process");

const PYTHON_PLOTTER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "PlotlyPlotter.py"
);

router.get("/:uuid/:field", async (req, res) => {
  res.setHeader("content-type", "text/html; charset=UTF-8");

  const uuid = req.params.uuid;
  const field = req.params.field;

  const pythonPlotter = spawn("python3", [PYTHON_PLOTTER_PATH, uuid, field]);
  return pythonPlotter.stdout.pipe(res);
});

module.exports = router;
