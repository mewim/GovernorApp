const express = require("express");
const router = express.Router();
const mongoUtil = require("./MongoUtil");
const COLLECTION = "datadictionaries";

router.get("/:uuids", async (req, res) => {
  const queryUUIDs = req.params.uuids;
  const queryUUIDsArray = queryUUIDs.split(",").map((u) => u.trim());
  const db = await mongoUtil.getDb();
  const found = await db
    .collection(COLLECTION)
    .find({
      resource_id: { $in: queryUUIDsArray },
    })
    .toArray();
  if (found.length === 0) {
    return res.sendStatus(404);
  }
  let result;
  if (found.length === 1) {
    result = { fields: found[0].fields };
    return res.send(result);
  }

  // Merge descriptions for all fields and values
  const foundHash = {};
  for (let currentRecord of found) {
    for (let f of currentRecord.fields) {
      if (!f.field_name) {
        continue;
      }
      if (!foundHash[f.field_name]) {
        foundHash[f.field_name] = {
          field_name: f.field_name,
          field_desc: new Set(),
          values: {},
        };
      }
      if (f.field_desc) {
        foundHash[f.field_name].field_desc.add(f.field_desc);
      }
      if (f.values && f.values.length > 0) {
        for (let v of f.values) {
          if (!v.value_name || !v.value_desc) {
            continue;
          }
          if (!foundHash[f.field_name].values[v.value_name]) {
            foundHash[f.field_name].values[v.value_name] = {
              value_name: v.value_name,
              value_desc: new Set(),
            };
          }
          if (v.value_desc) {
            foundHash[f.field_name].values[v.value_name].value_desc.add(
              v.value_desc
            );
          }
        }
      }
    }
  }
  result = {
    fields: Object.values(foundHash).map((currentField) => {
      currentField.field_desc =
        currentField.field_desc.size > 0
          ? [...currentField.field_desc].join(" ")
          : null;
      currentField.values = Object.values(currentField.values);
      for (let v of currentField.values) {
        v.value_desc = [...v.value_desc].join(" ");
      }
      return currentField;
    }),
  };
  return res.send(result);
});

module.exports = router;
