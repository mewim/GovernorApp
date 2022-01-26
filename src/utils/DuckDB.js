import * as duckdb from "@duckdb/duckdb-wasm";
// import { Table } from 'apache-arrow';

class DuckDB {
  constructor() {
    this.db = null;
    this.loadedTables = new Set();
  }

  async init() {
    const MANUAL_BUNDLES = {
      mvp: {
        mainModule: "/js/duckdb.wasm",
        mainWorker: "/js/duckdb-browser.worker.js",
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
    window.duckdb = db;
  }

  async getDb() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
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
}

const instance = new DuckDB();
export default instance;
