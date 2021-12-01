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

router.post("/", async (req, res) => {
  res.setHeader("content-type", "text/html; charset=UTF-8");

  const uuid = req.body.uuid;
  const field = req.body.field;

  const pythonPlotter = spawn("python3", [PYTHON_PLOTTER_PATH, uuid, field]);
  return pythonPlotter.stdout.pipe(res);
});

module.exports = router;
