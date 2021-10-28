const FsPromises = require("fs/promises");
const Path = require("path");
const ChildProcess = require("child_process");

const FILES_DIR = "../data/files/";
const NUMBER_OF_THREADS = 16;

const getFileInfo = (path) => {
  return new Promise((resolve, reject) => {
    ChildProcess.execFile("file", [path], (err, stdout) => {
      const output = stdout.toLowerCase().split(":")[1];
      if (err) {
        return reject(err);
      }
      if (output.includes("html")) {
        return resolve("html");
      }
      if (output.includes("csv")) {
        return resolve("csv");
      }
      if (output.includes("text")) {
        return resolve("txt");
      }
      if (output.includes("zip")) {
        return resolve("zip");
      }
      if (output.includes("composite document")) {
        return resolve("xls");
      }
      if (output.includes("excel")) {
        return resolve("xlsx");
      }
      return resolve(null);
    });
  });
};

const changeFileExt = (path, ext) => {
  if (!ext) {
    console.log(path, "cannot be identified, its extension will be removed");
  }
  const oldExt = Path.extname(path);
  const pathWithoutExt = oldExt ? path.split(oldExt)[0] : path;
  const newPath = ext ? [pathWithoutExt, ext].join(".") : pathWithoutExt;
  if (path === newPath) {
    return;
  }
  return FsPromises.rename(path, newPath);
};

(async () => {
  const files = await FsPromises.readdir(FILES_DIR);
  while (files.length > 0) {
    const promises = [];
    for (let i = 0; i < NUMBER_OF_THREADS; ++i) {
      const f = files.pop();
      if (!f) {
        break;
      }
      const p = Path.join(FILES_DIR, f);
      promises.push(getFileInfo(p).then((ext) => changeFileExt(p, ext)));
    }
    await Promise.all(promises);
  }
  console.log("All done");
  process.exit(0);
})();
