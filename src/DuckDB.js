import * as duckdb from "@duckdb/duckdb-wasm";
import papaparse from "papaparse";
const PGEscape = require("./PGEscape");
const VIEW_PREFIX = "view_";
const FIRST_TABLE_NAME = "T1";
const WORKING_TABLE_NAME = "__work";
const ALIAS_PREFIX = "alias_";
const COLUMN_PREFIX = "column_";
const ROW_ID = "__row_id";
const TABLE_ID = "__table_id";
const GC_ENABLED = true;

class DuckDB {
  constructor() {
    this.db = null;
    this.loadedTables = {};
    this.loadingTablePromises = {};
    this.dataTableViews = new Set();
    this.initializationPromise = this.init();
    this.referenceCounts = {};
    this.workingTableComponents = new Set();
  }

  async init() {
    console.time("DuckDB init");
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
    console.timeEnd("DuckDB init");
  }

  async getDb() {
    if (!this.db) {
      if (!this.dbInitPromise) {
        this.dbInitPromise = this.init();
      }
      await this.dbInitPromise;
      delete this.dbInitPromise;
    }
    return this.db;
  }

  async unloadTable(uuid, conn = null) {
    if (!this.loadedTables[uuid]) {
      return;
    }
    const isConnProvided = !!conn;
    if (!conn) {
      const db = await this.getDb();
      conn = await db.connect();
    }
    try {
      const query = `DROP TABLE IF EXISTS "${uuid}" CASCADE`;
      console.debug(query);
      await conn.query(query);
      delete this.loadedTables[uuid];
    } catch (e) {
      console.debug("Cannot unload table:", uuid);
    }
    if (!isConnProvided) {
      await conn.close();
    }
  }

  async collectGarbage() {
    if (!GC_ENABLED) {
      return;
    }
    const db = await this.getDb();
    const conn = await db.connect();
    for (let uuid in this.referenceCounts) {
      if (this.referenceCounts[uuid] < 1) {
        await this.unloadTable(uuid, conn);
        delete this.referenceCounts[uuid];
      }
    }
    await conn.close();
  }

  async loadParquet(uuid) {
    const db = await this.getDb();
    const conn = await db.connect();
    if (!this.loadedTables[uuid]) {
      if (this.loadingTablePromises[uuid]) {
        await this.loadingTablePromises[uuid];
      } else {
        const url = new URL(`/api/parquet/${uuid}.parquet`, window.location)
          .href;
        this.loadingTablePromises[uuid] = db
          .registerFileURL(`parquet_${uuid}`, url)
          .then(() => {
            const query = `CREATE TABLE "${uuid}" AS SELECT *, ROW_NUMBER() OVER() as "${ROW_ID}" FROM "${url}"`;
            console.debug(query);
            return conn.query(query);
          })
          .then(() => {
            const query = `SELECT COUNT(*) FROM "${uuid}"`;
            console.debug(query);
            return conn.query(query);
          })
          .then((countResult) => {
            const count = countResult.toArray()[0][0][0];
            console.debug(`Loaded parquet file: ${uuid} with ${count} rows`);
            this.loadedTables[uuid] = count;
            return count;
          });
        await this.loadingTablePromises[uuid];
        delete this.loadingTablePromises[uuid];
      }
    }
    await conn.close();
    return this.loadedTables[uuid];
  }

  encodeTableIds(tableIds) {
    const encodedTableIds = [];
    tableIds.forEach((t) => encodedTableIds.push(t));
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
    const query = `SELECT * FROM "${uuid}" ${this.createPaginationSubquery(
      pageIndex,
      pageSize
    )}`;
    console.debug(query);
    const databaseResult = await conn.query(query);
    await conn.close();
    return databaseResult;
  }

  async createDataTableView(uuid, keywords, columnIndexes, sortConfig = null) {
    if (!this.loadedTables[uuid]) {
      await this.loadParquet(uuid);
    }
    await this.dropDataView(uuid, false);
    const db = await this.getDb();
    const conn = await db.connect();
    const viewName = `${VIEW_PREFIX}${uuid}`;
    const columnCountQuery = `SELECT COUNT(*) AS count FROM pragma_table_info('${uuid}') WHERE name != '${ROW_ID}'`;
    console.debug(columnCountQuery);
    const columnCountsResult = await conn.query(columnCountQuery);
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
                const currCondition = `CONTAINS(LOWER("${f}"),${PGEscape(
                  "%L",
                  k
                )})`;
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
    this.incrementReferenceCount(uuid);
    return viewName;
  }

  async createWorkingTable(histories, keywords = null, sortConfig = null) {
    const { workingTableColumns, columnsMapping } =
      this.createColumnMappingForHistories(histories);
    this.createColumnMappingForHistories(histories);
    const withClause = this.createWithClauseForWorkingTable(columnsMapping);
    const isSorted = sortConfig && sortConfig.key;
    const joinCaluses = histories.map((h) =>
      this.createJoinCaluseForHistory(
        h,
        columnsMapping,
        workingTableColumns,
        !isSorted || (keywords && keywords.length > 0)
      )
    );
    const allColumns = Object.keys(workingTableColumns);
    const whereClause =
      keywords && keywords.length > 0
        ? keywords
            .map((currKeywords) => {
              const keywordsSplit = currKeywords.toLowerCase().split(" ");
              const andConditions = [];
              for (let k of keywordsSplit) {
                const orConditions = [];
                for (let f of allColumns) {
                  const currCondition = `CONTAINS(LOWER("${f}"),${PGEscape(
                    "%L",
                    k
                  )})`;
                  orConditions.push(currCondition);
                }
                const currentAndConditions = `(${orConditions.join(" OR ")})`;
                andConditions.push(currentAndConditions);
              }
              const currentAndConditions = `(${andConditions.join(" AND ")})`;
              return `(${currentAndConditions})`;
            })
            .join(" OR ")
        : null;

    let orderByClause;
    if (isSorted) {
      if (sortConfig.isNumeric) {
        orderByClause = `ORDER BY (CASE WHEN "${
          sortConfig.key
        }" SIMILAR TO '[+-]?([0-9]*[.])?[0-9]+' THEN "${
          sortConfig.key
        }"::FLOAT ELSE NULL END) ${
          sortConfig.order === "asc" ? "ASC" : "DESC"
        } NULLS LAST`;
      } else {
        orderByClause = `ORDER BY "${sortConfig.key}" ${
          sortConfig.order === "asc" ? "ASC" : "DESC"
        } NULLS LAST`;
      }
    }
    const unionCaluse = `${withClause} SELECT * FROM (${joinCaluses
      .map((j) => `(${j})`)
      .join(" UNION ALL ")}) ${whereClause ? `WHERE ${whereClause}` : ""} ${
      orderByClause ? orderByClause : ""
    }`;

    const fullQuery = `CREATE VIEW "${WORKING_TABLE_NAME}" AS (${unionCaluse})`;
    // Do not trigger GC right now, because some tables may be reused.
    await this.resetWorkingTable(false);
    const workingTableComponents = new Set();
    await Promise.all(
      Object.keys(columnsMapping).map((id) => this.loadParquet(id))
    );
    for (let h of histories) {
      workingTableComponents.add(h.table.id);
      if (h.joinedTables) {
        for (let j in h.joinedTables) {
          workingTableComponents.add(j);
        }
      }
    }
    const db = await this.getDb();
    const conn = await db.connect();
    console.debug(fullQuery);
    await conn.query(fullQuery);
    await conn.close();
    this.workingTableComponents = workingTableComponents;
    workingTableComponents.forEach((uuid) => {
      this.incrementReferenceCount(uuid);
    });
    await this.collectGarbage();
    return {
      viewName: WORKING_TABLE_NAME,
      columnsMapping,
      workingTableColumns,
    };
  }

  createJoinCaluseForHistory(
    history,
    columnsMapping,
    workingTableColumns,
    orderByRowId = false
  ) {
    const sourceColumnMapping = columnsMapping[history.resourceStats.uuid];
    const joinCaluses = [];
    const joinTargetSet = new Set();
    const tableIds = new Set([history.table.id]);
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
      joinTargetSet.add(joinTargetName);
      const currentJoinClause = `LEFT OUTER JOIN "${targetColumnMapping.alias}" ON "${sourceColumnMapping.alias}"."${joinSourceName}" = "${targetColumnMapping.alias}"."${joinTargetName}"`;
      joinCaluses.push(currentJoinClause);
      tableIds.add(uuid);
    }
    const tableIdsString = [...tableIds].join(",");
    return `SELECT ${Object.keys(workingTableColumns)
      .map((c) => `"${c}"`)
      .join(", ")}, '${tableIdsString}' AS "${TABLE_ID}" FROM "${
      sourceColumnMapping.alias
    }"${joinCaluses.length > 0 ? ` ${joinCaluses.join(" ")}` : ""} ${
      orderByRowId ? `ORDER BY ${ROW_ID}` : ""
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
      const currentWithClause = `"${alias}" AS (SELECT ${projectionString}${
        currentMapping.isMain ? `, "${ROW_ID}"` : ""
      } FROM "${uuid}"${
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
    console.debug(query);
    const result = await conn.query(query);
    const totalCount = result.toArray()[0][0][0];
    await conn.close();
    return totalCount;
  }

  async resetWorkingTable(triggerGc = true) {
    const db = await this.getDb();
    const conn = await db.connect();
    const query = `DROP VIEW IF EXISTS "${WORKING_TABLE_NAME}"`;
    for (let uuid of [...this.workingTableComponents]) {
      await this.decrementReferenceCount(uuid, false);
    }
    this.workingTableComponents = new Set();
    console.debug(query);
    await conn.query(query);
    await conn.close();
    if (triggerGc) {
      await this.collectGarbage();
    }
  }

  async dropDataView(uuid, triggerGc = true) {
    const viewName = `${VIEW_PREFIX}${uuid}`;
    const dropQuery = `DROP VIEW "${viewName}"`;
    console.debug(dropQuery);
    const db = await this.getDb();
    const conn = await db.connect();
    try {
      await conn.query(dropQuery);
      await this.decrementReferenceCount(uuid, triggerGc);
    } catch (e) {
      console.debug(
        `${viewName} does not exist, the reference count will not be decremented`
      );
    } finally {
      await conn.close();
    }
  }

  incrementReferenceCount(uuid) {
    if (!this.referenceCounts[uuid]) {
      this.referenceCounts[uuid] = 0;
    }
    this.referenceCounts[uuid] += 1;
  }

  async decrementReferenceCount(uuid, triggerGc = true) {
    if (!this.referenceCounts[uuid] || this.referenceCounts[uuid] <= 0) {
      return;
    }
    this.referenceCounts[uuid] -= 1;
    if (triggerGc) {
      await this.collectGarbage();
    }
  }

  resolveSchemas(schemas) {
    if (schemas.length === 0) {
      return [];
    }
    if (schemas.length === 1) {
      return schemas[0].map((field) => {
        return {
          name: field.name,
          format: field.format,
          type: field.type,
        };
      });
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
  }

  createColumnMappingForHistories(histories) {
    // In standard mode, if there are multiple columns with the same name, we only use the first one. (Unless the column is used as join key).
    // In this mode, the UI should show an error if the user tries to add a column with the same name to a component.
    const workingTableNameToColumnMap = {};
    const columnsMapping = {};
    const uuidToFieldsMap = {};
    let idx = 0,
      tableCouner = 0;
    histories.forEach((h) => {
      h.resourceStats.schema.fields.forEach((f) => {
        if (!workingTableNameToColumnMap[f.name]) {
          workingTableNameToColumnMap[f.name] = [`${COLUMN_PREFIX}${idx++}`];
        }
      });
      if (!uuidToFieldsMap[h.resourceStats.uuid]) {
        uuidToFieldsMap[h.resourceStats.uuid] = h.resourceStats.schema.fields;
      }
      if (!columnsMapping[h.resourceStats.uuid]) {
        columnsMapping[h.resourceStats.uuid] = {
          isMain: true,
          columnIndexToMapped: [],
          mappedToColumnIndex: {},
          alias: `${ALIAS_PREFIX}${tableCouner++}`,
        };
      }

      for (let uuid in h.joinedTables) {
        const targetKeyIndex = h.joinedTables[
          uuid
        ].targetResourceStats.schema.fields.findIndex(
          (f) => f.name === h.joinedTables[uuid].targetKey
        );
        const columns = new Set(h.joinedTables[uuid].columns);
        const fields = h.joinedTables[
          uuid
        ].targetResourceStats.schema.fields.filter((f, i) => {
          return i === targetKeyIndex || columns.has(f.name);
        });
        fields.forEach((f, i) => {
          if (!workingTableNameToColumnMap[f.name]) {
            workingTableNameToColumnMap[f.name] = [`${COLUMN_PREFIX}${idx++}`];
          } else if (i === targetKeyIndex) {
            workingTableNameToColumnMap[f.name].push(
              `${COLUMN_PREFIX}${idx++}`
            );
          }
        });
        if (!columnsMapping[uuid]) {
          columnsMapping[uuid] = {
            isMain: false,
            columnIndexToMapped: [],
            mappedToColumnIndex: {},
            alias: `${ALIAS_PREFIX}${tableCouner++}`,
            groupByIndex: targetKeyIndex,
          };
        }
        if (!uuidToFieldsMap[uuid]) {
          uuidToFieldsMap[uuid] = fields;
        }
      }
    });
    const workingTableColumnToNameMap = {};
    for (let k in workingTableNameToColumnMap) {
      for (let ci of workingTableNameToColumnMap[k]) {
        workingTableColumnToNameMap[ci] = k;
      }
    }
    histories.forEach((h) => {
      const currWorkingTableNameToColumnMap = JSON.parse(
        JSON.stringify(workingTableNameToColumnMap)
      );
      h.resourceStats.schema.fields.forEach((f, i) => {
        const currentColumnMappedName =
          currWorkingTableNameToColumnMap[f.name].shift();
        columnsMapping[h.resourceStats.uuid].columnIndexToMapped[i] =
          currentColumnMappedName ? currentColumnMappedName : null;
      });
      for (let uuid in h.joinedTables) {
        uuidToFieldsMap[uuid].forEach((f, j) => {
          const currentColumnMappedName =
            currWorkingTableNameToColumnMap[f.name].shift();
          columnsMapping[uuid].columnIndexToMapped[j] = currentColumnMappedName
            ? currentColumnMappedName
            : null;
        });
      }
    });
    const columnNameToSchemaMap = {};
    const workingTableColumns = {};
    for (let uuid in columnsMapping) {
      const currColumnMapping = columnsMapping[uuid];
      const fields = uuidToFieldsMap[uuid];
      currColumnMapping.columnIndexToMapped.forEach((c, i) => {
        if (!c) {
          return;
        }
        workingTableColumns[c] = undefined;
        currColumnMapping.mappedToColumnIndex[c] = i;
        if (!columnNameToSchemaMap[fields[i].name]) {
          columnNameToSchemaMap[fields[i].name] = [];
        }
        columnNameToSchemaMap[fields[i].name].push([fields[i]]);
      });
    }
    for (let cn in columnNameToSchemaMap) {
      columnNameToSchemaMap[cn] = this.resolveSchemas(
        columnNameToSchemaMap[cn]
      )[0];
    }
    for (let c in workingTableColumns) {
      workingTableColumns[c] =
        columnNameToSchemaMap[workingTableColumnToNameMap[c]];
    }

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
      columnsMapping,
    };
  }

  async dumpCsv(tableId, header, columnIndexes = null, chunkSize = 10000) {
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
        let rowValues;
        const jsonRow = r.toJSON();
        if (columnIndexes) {
          const row = {};
          for (const index of columnIndexes) {
            row[index] = jsonRow[index];
          }
          rowValues = Object.values(row);
        } else {
          rowValues = Object.values(jsonRow);
        }
        return rowValues.map((r) => {
          return /^[;\s]*$/.test(r) ? "" : r;
        });
      });
      await writable.write(papaparse.unparse(rows));
      await writable.write("\n");
    }
    writable.close();
  }
}

// Singleton instance
const instance = new DuckDB();
export default instance;
