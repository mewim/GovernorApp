import * as duckdb from "@duckdb/duckdb-wasm";
import papaparse from "papaparse";
const SQLEscape = require("sql-escape");
const VIEW_PREFIX = "view_";
const FIRST_TABLE_NAME = "T1";
const SECOND_TABLE_NAME = "T2";
const WORKING_TABLE_NAME = "__work";

class DuckDB {
  constructor() {
    this.db = null;
    this.loadedTables = new Set();
    this.dataTableViews = new Set();
    this.initializationPromise = this.init();
  }

  addJoinedTables(source, sourceColumnIndex, target, targertColumnIndex) {
    this.dataTableViews.add({
      source,
      sourceColumnIndex,
      target,
      targertColumnIndex,
    });
    return [source, target].join("_");
  }

  decodecolumnIndex(columnIndex) {
    const split = columnIndex.split("_");
    return {
      source: split[0],
      sourceColumnIndex: split[1],
      target: split[2],
      targertColumnIndex: split[3],
    };
  }

  async init() {
    if (this.initializationPromise) {
      await this.initializationPromise;
      delete this.initializationPromise;
    }
    const MANUAL_BUNDLES = {
      mvp: {
        mainModule: "/js/duckdb-mvp.wasm",
        mainWorker: "/js/duckdb-browser-mvp.worker.js",
      },
      eh: {
        mainModule: "/js/duckdb-eh.wasm",
        mainWorker: "/js/duckdb-browser-eh.worker.js",
      },
    };
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    // Instantiate the asynchronus version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.db = db;
    window.duckdb = this;
  }

  async getDb() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  async unloadTable(uuid) {
    if (!this.loadedTables.has(uuid)) {
      return;
    }
    const db = await this.getDb();
    const conn = await db.connect();
    const countResult = await conn.query(`SELECT COUNT(*) FROM "${uuid}"`);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return totalCount;
  }

  async loadParquet(uuid) {
    const db = await this.getDb();
    const conn = await db.connect();
    if (!this.loadedTables.has(uuid)) {
      const url = new URL(`/api/parquet/${uuid}.parquet`, window.location).href;
      await db.registerFileURL(`parquet_${uuid}`, url);
      await conn.query(`CREATE TABLE "${uuid}" AS SELECT * FROM "${url}"`);
      this.loadedTables.add(uuid);
    }
    const countResult = await conn.query(`SELECT COUNT(*) FROM "${uuid}"`);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return totalCount;
  }

  createPaginationSubquery(pageIndex, pageSize) {
    if (!(Number.isInteger(pageIndex) && Number.isInteger(pageSize))) {
      return "";
    }
    const offset = (pageIndex - 1) * pageSize;
    return ` OFFSET ${offset} LIMIT ${pageSize}`;
  }

  async getFullTable(uuid, pageIndex, pageSize) {
    const db = await this.getDb();
    const conn = await db.connect();
    const query = `
      SELECT * FROM "${uuid}"
      ${this.createPaginationSubquery(pageIndex, pageSize)}`;

    const databaseResult = await conn.query(query);
    await conn.close();
    return databaseResult;
  }

  async createJoinedView(
    source,
    sourceJoinIndex,
    target,
    targetJoinIndex,
    keywords,
    sourceColumnIndexes,
    targetColumnIndexes
  ) {
    const viewName = `${VIEW_PREFIX}${this.addJoinedTables(
      source,
      sourceJoinIndex,
      target,
      targetJoinIndex
    )}`;
    const db = await this.getDb();
    const conn = await db.connect();
    const sourceColumnCountsResult = await conn.query(
      `SELECT COUNT(*) AS count FROM pragma_table_info('${source}')`
    );
    const sourceColumnCounts = sourceColumnCountsResult.toArray()[0][0][0];
    const targetColumnCountsResult = await conn.query(
      `SELECT COUNT(*) AS count FROM pragma_table_info('${target}')`
    );
    const targetColumnCounts = targetColumnCountsResult.toArray()[0][0][0];

    const allColumns = [];
    for (let i = 0; i < sourceColumnCounts; ++i) {
      allColumns.push({ table: FIRST_TABLE_NAME, index: i });
    }

    for (let i = 0; i < targetColumnCounts; ++i) {
      if (i === targetJoinIndex) {
        continue;
      }
      allColumns.push({ table: SECOND_TABLE_NAME, index: i });
    }
    const allColumnsText = allColumns.map((c) => `${c.table}."${c.index}"`);

    const matchedColumns = [];
    if (sourceColumnIndexes) {
      sourceColumnIndexes.sort((a, b) => a - b);
      sourceColumnIndexes.forEach((s) => {
        matchedColumns.push(
          `${FIRST_TABLE_NAME}."${s}" AS "${FIRST_TABLE_NAME}-${s}"`
        );
      });
    }

    if (targetColumnIndexes) {
      targetColumnIndexes.sort((a, b) => a - b);
      targetColumnIndexes.forEach((s) => {
        if (s !== sourceJoinIndex) {
          matchedColumns.push(
            `${SECOND_TABLE_NAME}."${s}" AS "${SECOND_TABLE_NAME}-${s}"`
          );
        }
      });
    }

    const selectClause =
      matchedColumns.length > 0 ? `${matchedColumns.join(",")}` : "*";

    const whereClause = keywords
      ? keywords
          .map((currKeywords) => {
            const keywordsSplit = currKeywords.split(" ");
            if (keywordsSplit.length > 1) {
              const currentConditions = currKeywords
                .split(" ")
                .map((k) => `('${SQLEscape(k)}' IN (${allColumnsText}))`);
              const currentAndConditions = `(${currentConditions.join(
                " AND "
              )})`;
              return `(${currentAndConditions} OR ('${SQLEscape(
                currKeywords
              )}' IN (${allColumnsText})))`;
            } else {
              return `('${SQLEscape(currKeywords)}' IN (${allColumnsText}))`;
            }
          })
          .join(" OR ")
      : "";

    const query = `CREATE VIEW "${viewName}" AS 
      (
        WITH ${FIRST_TABLE_NAME} AS (SELECT * FROM "${source}"), 
             ${SECOND_TABLE_NAME} AS (SELECT * FROM "${target}") 
            SELECT ${selectClause} FROM ${FIRST_TABLE_NAME} JOIN ${SECOND_TABLE_NAME} ON 
              ${FIRST_TABLE_NAME}."${sourceJoinIndex}"=${SECOND_TABLE_NAME}."${targetJoinIndex}" 
            ${whereClause ? `WHERE ${whereClause}` : ""}
      )`;

    console.debug(query);
    await conn.query(`DROP VIEW IF EXISTS "${VIEW_PREFIX}${source}"`);
    await conn.query(`DROP VIEW IF EXISTS "${viewName}"`);
    await conn.query(query);
    const countQuery = `SELECT COUNT(*) FROM "${viewName}"`;
    const countResult = await conn.query(countQuery);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return {
      totalCount,
      viewName,
    };
  }

  async createDataTableView(uuid, keywords, columnIndexes) {
    if (!this.loadedTables.has(uuid)) {
      await this.loadParquet(uuid);
    }
    const db = await this.getDb();
    const conn = await db.connect();
    const viewName = `${VIEW_PREFIX}${uuid}`;
    await conn.query(`DROP VIEW IF EXISTS "${viewName}"`);
    const columnCountsResult = await conn.query(
      `SELECT COUNT(*) AS count FROM pragma_table_info('${uuid}')`
    );
    const columnCounts = columnCountsResult.toArray()[0][0][0];
    const allColumns = [];
    for (let i = 0; i < columnCounts; ++i) {
      allColumns.push(i);
    }
    const allColumnsText = allColumns.map((c) => `"${c}"`);
    columnIndexes.sort((a, b) => a - b);
    const selectClause = columnIndexes
      ? `${columnIndexes
          .map((c) => `"${c}" AS "${FIRST_TABLE_NAME}-${c}"`)
          .join(",")}`
      : "*";
    const whereClause = keywords
      ? keywords
          .map((currKeywords) => {
            const keywordsSplit = currKeywords.split(" ");
            if (keywordsSplit.length > 1) {
              const currentConditions = currKeywords
                .split(" ")
                .map((k) => `('${SQLEscape(k)}' IN (${allColumnsText}))`);
              const currentAndConditions = `(${currentConditions.join(
                " AND "
              )})`;
              return `(${currentAndConditions} OR ('${SQLEscape(
                currKeywords
              )}' IN (${allColumnsText})))`;
            } else {
              return `('${SQLEscape(currKeywords)}' IN (${allColumnsText}))`;
            }
          })
          .join(" OR ")
      : "";

    const query = `CREATE VIEW "${viewName}" AS SELECT ${selectClause} FROM "${uuid}" ${
      whereClause ? `WHERE ${whereClause}` : ""
    }`;
    console.debug(query);
    await conn.query(query);

    const countQuery = `SELECT COUNT(*) FROM "${viewName}"`;
    const countResult = await conn.query(countQuery);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    this.dataTableViews.add(viewName);
    return {
      totalCount,
      viewName,
    };
  }

  async getTableByRowNumbers(uuid, rowNumbers, pageIndex, pageSize) {
    const db = await this.getDb();
    const conn = await db.connect();
    const rowNumbersText = rowNumbers.map((r) => `'${r}'`).join(",");
    let query = `
      SELECT * FROM (SELECT *, ROW_NUMBER() OVER() AS row FROM "${uuid}") 
      WHERE row in (${rowNumbersText}) 
      ${this.createPaginationSubquery(pageIndex, pageSize)}`;
    const databaseResult = await conn.query(query);
    await conn.close();
    return databaseResult;
  }

  async createWorkingTable(viewId, sourceTableId) {
    const db = await this.getDb();
    const conn = await db.connect();
    const tableName = WORKING_TABLE_NAME;
    await conn.query(`DROP VIEW IF EXISTS "${tableName}"`);
    const columns = await conn.query(
      `SELECT * FROM pragma_table_info('${viewId}')`
    );
    let selectClause = columns
      .toArray()
      .map((c, i) => `"${c.name}" AS "W_${i}"`)
      .join(", ");
    selectClause += `, '${sourceTableId}' AS TID`;
    const query = `CREATE TABLE ${tableName} AS SELECT ${selectClause} FROM "${viewId}"`;
    console.debug(query);
    await conn.query(query);
    const countQuery = `SELECT COUNT(*) FROM "${tableName}"`;
    const countResult = await conn.query(countQuery);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return {
      totalCount,
      tableName,
    };
  }

  async autoUnionWorkingTable(viewId, sourceTableId, unionColumns) {
    const db = await this.getDb();
    const conn = await db.connect();
    const tableName = WORKING_TABLE_NAME;
    let selectClause = unionColumns
      .map((c) => `"${c.targetKey}" AS "W_${c.sourceKey}"`)
      .join(", ");
    selectClause += `, '${sourceTableId}' AS TID`;
    const query = `INSERT INTO ${tableName} SELECT ${selectClause} FROM "${viewId}"`;
    console.debug(query);
    await conn.query(query);
    const countQuery = `SELECT COUNT(*) FROM "${tableName}"`;
    const countResult = await conn.query(countQuery);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return {
      totalCount,
      tableName,
    };
  }

  async removeFromWorkingTable(sourceTableId) {
    const db = await this.getDb();
    const conn = await db.connect();
    const tableName = WORKING_TABLE_NAME;
    const query = `DELETE FROM ${tableName} WHERE TID = '${sourceTableId}'`;
    console.debug(query);
    await conn.query(query);
    const countQuery = `SELECT COUNT(*) FROM "${tableName}"`;
    const countResult = await conn.query(countQuery);
    const totalCount = countResult.toArray()[0][0][0];
    await conn.close();
    return {
      totalCount,
      tableName,
    };
  }

  async getTotalCount(tablId) {
    const db = await this.getDb();
    const conn = await db.connect();
    const query = `SELECT COUNT(*) FROM "${tablId}"`;
    const result = await conn.query(query);
    const totalCount = result.toArray()[0][0][0];
    await conn.close();
    return totalCount;
  }

  async resetWorkingTable() {
    const db = await this.getDb();
    const conn = await db.connect();
    const tableName = WORKING_TABLE_NAME;
    const query = `DROP TABLE IF EXISTS "${tableName}"`;
    await conn.query(query);
    await conn.close();
  }

  async dumpCsv(tableId, header, columnIndexes = null, chunkSize = 10000) {
    console.log(tableId, header, columnIndexes, chunkSize);
    let handle, writable;
    try {
      const options = {
        types: [
          {
            description: "CSV File",
            accept: {
              "text/csv": [".csv"],
            },
          },
        ],
      };
      handle = await window.showSaveFilePicker(options);
      writable = await handle.createWritable();
    } catch (err) {
      console.debug("User cancelled operation or there is an error:", err);
    }
    if (!handle || !writable) {
      return;
    }
    await writable.write(papaparse.unparse([header]));
    await writable.write("\n");
    const totalCount = await this.getTotalCount(tableId);
    for (let i = 0; i < totalCount / chunkSize; ++i) {
      const chunk = await this.getFullTable(tableId, i + 1, chunkSize);
      const rows = chunk.toArray().map((r) => {
        const jsonRow = r.toJSON();
        if (columnIndexes) {
          const row = {};
          for (const index of columnIndexes) {
            row[index] = jsonRow[index];
          }
          return Object.values(row);
        }
        return Object.values(jsonRow);
      });
      await writable.write(papaparse.unparse(rows));
      await writable.write("\n");
    }
    writable.close();
  }
}

const instance = new DuckDB();
export default instance;
