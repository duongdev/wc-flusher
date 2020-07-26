const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "db.json");

const getDb = async (name) => {
  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, { encoding: "utf-8" }));
    return db[name];
  } catch (e) {}
  return null;
};

const setDb = async (update) => {
  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, { encoding: "utf-8" }));
  } catch (e) {}
  fs.writeFileSync(DB_PATH, JSON.stringify({ ...db, ...update }));
};

module.exports = { getDb, setDb };
