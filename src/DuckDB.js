import * as duckdb from "@duckdb/duckdb-wasm";
import papaparse from "papaparse";
const SQLEscape = require("sql-escape");
const VIEW_PREFIX = "view_";
const FIRST_TABLE_NAME = "T1";
const WORKING_TABLE_NAME = "__work";
const ALIAS_PREFIX = "alias_";
const COLUMN_PREFIX = "column_";

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

  async createDataTableView(uuid, keywords, columnIndexes, sortConfig = null) {
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
    if (!columnIndexes) {
      columnIndexes = allColumns;
    }
    columnIndexes.sort((a, b) => a - b);
    const selectClause = columnIndexes
      ? `${columnIndexes
          .map((c) => `"${c}" AS "${FIRST_TABLE_NAME}-${c}"`)
          .join(",")}`
      : "*";
    let orderByClause;
    if (sortConfig) {
      if (sortConfig.isNumeric) {
        orderByClause = `ORDER BY (CASE WHEN "${
          sortConfig.key
        }" SIMILAR TO '[+-]?([0-9]*[.])?[0-9]+' THEN "${
          sortConfig.key
        }"::FLOAT ELSE NULL END) ${
          sortConfig.order === "asc" ? "ASC" : "DESC"
        } NULLS LAST`;
      } else {
        orderByClause = `ORDER BY "${FIRST_TABLE_NAME}-${sortConfig.key}" ${
          sortConfig.order === "asc" ? "ASC" : "DESC"
        } NULLS LAST`;
      }
    }
    const whereClause = keywords
      ? keywords
          .map((currKeywords) => {
            const keywordsSplit = currKeywords.toLowerCase().split(" ");
            const andConditions = [];
            for (let k of keywordsSplit) {
              const orConditions = [];
              for (let f of allColumns) {
                const currCondition = `CONTAINS(LOWER("${f}"),'${SQLEscape(
                  k
                )}')`;
                orConditions.push(currCondition);
              }
              const currentAndConditions = `(${orConditions.join(" OR ")})`;
              andConditions.push(currentAndConditions);
            }
            const currentAndConditions = `(${andConditions.join(" AND ")})`;
            return `(${currentAndConditions})`;
          })
          .join(" OR ")
      : "";

    const query = `CREATE VIEW "${viewName}" AS SELECT ${selectClause} FROM "${uuid}" ${
      whereClause ? `WHERE ${whereClause}` : ""
    } ${orderByClause ? orderByClause : ""}`;
    console.debug(query);
    await conn.query(query);
    await conn.close();
    this.dataTableViews.add(viewName);
    return viewName;
  }

  async getFullTableWithFilter(uuid, keywords) {
    if (!this.loadedTables.has(uuid)) {
      await this.loadParquet(uuid);
    }
    const db = await this.getDb();
    const conn = await db.connect();
    const columnCountsResult = await conn.query(
      `SELECT COUNT(*) AS count FROM pragma_table_info('${uuid}')`
    );
    const columnCounts = columnCountsResult.toArray()[0][0][0];
    const allColumns = [];
    for (let i = 0; i < columnCounts; ++i) {
      allColumns.push(i);
    }
    const allColumnsText = allColumns.map((c) => `"${c}"`);
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

    const query = `SELECT * FROM "${uuid}" ${
      whereClause ? `WHERE ${whereClause}` : ""
    }`;
    console.debug(query);
    const results = await conn.query(query);
    await conn.close();
    return results;
  }

  async createWorkingTable(histories) {
    const { workingTableColumns, columnsMapping } =
      this.createColumnMappingForHistoriesStrict(histories);
    const withClause = this.createWithClauseForWorkingTable(columnsMapping);
    const joinCaluses = histories.map((h) =>
      this.createJoinCaluseForHistory(h, columnsMapping, workingTableColumns)
    );

    const unionCaluse = `${withClause} SELECT * FROM (${joinCaluses
      .map((j) => `(${j})`)
      .join(" UNION ALL ")})`;
    const fullQuery = `CREATE VIEW "${WORKING_TABLE_NAME}" AS (${unionCaluse})`;
    await this.resetWorkingTable();
    for (let id of Object.keys(columnsMapping)) {
      await this.loadParquet(id);
    }
    const db = await this.getDb();
    const conn = await db.connect();
    console.debug(fullQuery);

    await conn.query(fullQuery);
    await conn.close();
  }

  createWorkingTableQuery(histories) {}

  createJoinCaluseForHistory(history, columnsMapping, workingTableColumns) {
    const sourceColumnMapping = columnsMapping[history.resourceStats.uuid];
    const joinCaluses = [];
    for (let uuid in history.joinedTables) {
      const sourceKey = history.joinedTables[uuid].sourceKey;
      const targetKey = history.joinedTables[uuid].targetKey;
      const targetColumnMapping = columnsMapping[uuid];
      const targetResourceStats =
        history.joinedTables[uuid].targetResourceStats;
      const sourceKeyIndex = history.resourceStats.schema.fields.findIndex(
        (f) => f.name === sourceKey
      );
      const joinSourceName =
        sourceColumnMapping.columnIndexToMapped[sourceKeyIndex];
      const targetKeyIndex = targetResourceStats.schema.fields.findIndex(
        (f) => f.name === targetKey
      );
      const joinTargetName =
        targetColumnMapping.columnIndexToMapped[targetKeyIndex];
      const currentJoinClause = `LEFT JOIN "${targetColumnMapping.alias}" ON "${sourceColumnMapping.alias}"."${joinSourceName}" = "${targetColumnMapping.alias}"."${joinTargetName}"`;
      joinCaluses.push(currentJoinClause);
    }
    return `SELECT ${Object.keys(workingTableColumns)
      .map((c) => `"${c}"`)
      .join(", ")} FROM "${sourceColumnMapping.alias}"${
      joinCaluses.length > 0 ? ` ${joinCaluses.join(" ")}` : ""
    }`;
  }

  createWithClauseForWorkingTable(columnsMapping) {
    const withClause = [];
    for (let uuid in columnsMapping) {
      const currentMapping = columnsMapping[uuid];
      const alias = currentMapping.alias;
      const projections = [];
      for (let column in currentMapping.mappedToColumnIndex) {
        let currentProjection;
        if (currentMapping.isMain) {
          currentProjection = `${
            currentMapping.mappedToColumnIndex[column] !== null
              ? `"${currentMapping.mappedToColumnIndex[column]}"`
              : "NULL"
          } AS "${column}"`;
        } else {
          currentProjection = `${
            currentMapping.mappedToColumnIndex[column] ===
            currentMapping.groupByIndex
              ? `"${currentMapping.mappedToColumnIndex[column]}"`
              : `STRING_AGG("${currentMapping.mappedToColumnIndex[column]}", '; ')`
          } AS "${column}"`;
        }
        projections.push(currentProjection);
      }
      const projectionString = projections.join(", ");
      const currentWithClause = `"${alias}" AS (SELECT ${projectionString} FROM "${uuid}"${
        currentMapping.isMain
          ? ""
          : ` GROUP BY "${currentMapping.groupByIndex}"`
      })`;
      withClause.push(currentWithClause);
    }
    return `WITH ${withClause.join(", ")}`;
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
    const query = `DROP VIEW IF EXISTS "${tableName}"`;
    await conn.query(query);
    await conn.close();
  }

  createColumnMappingForHistoriesStrict(histories) {
    // In strict mode, tables with any difference in schema as treated as different tables
    // If there are multiple columns with same name in different tables, they are treated as different columns
    const schemaToString = (schema) => {
      return schema.fields.map((f) => f.name).join("***");
    };
    const resolveSchemas = (schemas) => {
      if (schemas.length === 0) {
        return [];
      }
      if (schemas.length === 1) {
        return schemas[0];
      }
      const results = schemas[0].map((field) => {
        return {
          name: field.name,
          format: field.format,
          types: new Set(),
        };
      });
      schemas.forEach((s) => {
        s.forEach((field, i) => {
          results[i].types.add(field.type);
        });
      });
      results.forEach((f) => {
        switch (f.types.size) {
          case 1:
            f.type = [...f.types][0];
            break;
          case 2:
            if (f.types.has("integer") && f.types.has("number")) {
              f.type = "number";
            }
            if (f.types.has("array") && f.types.has("object")) {
              f.type = "object";
            }
            if (
              (f.types.has("date") && f.types.has("time")) ||
              (f.types.has("datetime") && f.types.has("time")) ||
              (f.types.has("datetime") && f.types.has("date"))
            ) {
              f.type = "datetime";
            }
            break;
          case 3:
            if (
              f.types.size === 3 &&
              f.types.has("date") &&
              f.types.has("time") &&
              f.types.has("datetime")
            ) {
              f.type = "datetime";
            }
            break;
          default:
            f.type = "string";
            break;
        }
        delete f.types;
      });
      return results;
    };
    const tableGroupsHash = {};
    const columnsMapping = {};
    let tableCouner = 0;
    let schemaCounter = 0;
    histories.forEach((h) => {
      const schemaString = schemaToString(h.resourceStats.schema);
      if (!tableGroupsHash[schemaString]) {
        tableGroupsHash[schemaString] = {
          tables: new Set(),
          schemas: [],
          columns: h.resourceStats.schema.fields.map(
            (_, i) => `${COLUMN_PREFIX}${schemaCounter}_${i}`
          ),
        };
        schemaCounter += 1;
      }
      if (!columnsMapping[h.resourceStats.uuid]) {
        columnsMapping[h.resourceStats.uuid] = {
          isMain: true,
          columnIndexToMapped: [],
          mappedToColumnIndex: {},
          alias: `${ALIAS_PREFIX}${tableCouner++}`,
        };
      }
      tableGroupsHash[schemaString].tables.add(h.resourceStats.uuid);
      tableGroupsHash[schemaString].schemas.push(h.resourceStats.schema.fields);

      for (let uuid in h.joinedTables) {
        const schema = h.joinedTables[uuid].targetResourceStats.schema;
        const targetKeyIndex = schema.fields.findIndex(
          (f) => f.name === h.joinedTables[uuid].targetKey
        );
        h.joinedTables[uuid].targetKey;
        const schemaString = schemaToString(schema);
        if (!tableGroupsHash[schemaString]) {
          tableGroupsHash[schemaString] = {
            tables: new Set(),
            schemas: [],
            columns: schema.fields.map(
              (_, i) => `${COLUMN_PREFIX}${schemaCounter}_${i}`
            ),
          };
          schemaCounter += 1;
        }
        if (!columnsMapping[uuid]) {
          columnsMapping[uuid] = {
            isMain: false,
            columnIndexToMapped: [],
            mappedToColumnIndex: {},
            alias: `${ALIAS_PREFIX}${tableCouner++}`,
            groupByIndex: targetKeyIndex,
          };
        }
        tableGroupsHash[schemaString].tables.add(uuid);
        tableGroupsHash[schemaString].schemas.push(schema.fields);
      }
    });
    const workingTableColumns = {};
    const tableGroups = Object.values(tableGroupsHash);
    tableGroups.forEach((tg) => {
      tg.schema = resolveSchemas(tg.schemas);
      delete tg.schemas;
    });
    tableGroups.forEach((tg) => {
      tg.columns.forEach((c, i) => {
        workingTableColumns[c] = tg.schema[i];
      });
      tg.tables.forEach((uuid) => {
        const currColumnMapping = columnsMapping[uuid];
        tg.columns.forEach((column, i) => {
          currColumnMapping.columnIndexToMapped[i] = column;
          currColumnMapping.mappedToColumnIndex[column] = i;
        });
      });
    });

    // Fill in nulls for missing columns
    const allColumnNames = Object.keys(workingTableColumns);
    histories.forEach((h) => {
      const currColumns = new Set(
        columnsMapping[h.resourceStats.uuid].columnIndexToMapped
      );
      for (let uuid in h.joinedTables) {
        columnsMapping[uuid].columnIndexToMapped.forEach((c) =>
          currColumns.add(c)
        );
      }
      const missingColumns = allColumnNames.filter((c) => !currColumns.has(c));
      missingColumns.forEach((c) => {
        columnsMapping[h.resourceStats.uuid].mappedToColumnIndex[c] = null;
      });
    });
    return {
      workingTableColumns,
      tableGroups,
      columnsMapping,
    };
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
