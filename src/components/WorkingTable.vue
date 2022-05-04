<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :selectedColumns="selectedColumns"
      :columns="columns"
      :keywords="keywords"
      v-if="histories.length > 0"
    />
    <div class="working-table-inner-container" ref="tableContainer">
      <div class="table-pagination" v-show="tableData.length > 0">
        <ve-pagination
          :total="totalCount"
          :page-size-option="[10, 15, 25, 50, 100, 200, 500, 1000]"
          :page-index="pageIndex"
          :page-size="pageSize"
          @on-page-number-change="pageNumberChange"
          @on-page-size-change="pageSizeChange"
        />
      </div>
      <ve-table
        v-if="tableData.length > 0"
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :cell-style-option="cellStyleOption"
        :tableData="tableData"
        :columns="focusedTableId ? focusedColumns : visibleColumns"
        :sort-option="sortOption"
        row-key-field-name="rowKey"
        ref="table"
      />
      <div class="working-table-empty" v-if="histories.length === 0">
        The working table is currently empty. You can add rows to it by opening
        a file and click on "Add to Working Table" from the right panel.
      </div>
    </div>
  </div>
</template>

<script>
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";
import TableColorManger from "../TableColorManager";
const CHUNK_SIZE = 1000;

export default {
  data() {
    return {
      pageIndex: 1,
      pageSize: 25,
      totalCount: 0,
      virtualScrollOption: {
        enable: true,
      },
      columns: [],
      isColorEnabled: false,
      allData: [],
      focusedData: [],
      focusedColumns: [],
      tableData: [],
      sortedAllData: null,
      inferredstats: null,
      loadingPromise: null,
      selectedColumns: [],
      cellStyleOption: {},
      histories: [],
      keywords: [],
      focusedTableId: null,
      sortOption: {
        sortChange: (params) => {
          this.sortChange(params);
        },
      },
      sortConfig: {
        key: null,
        order: null,
      },
    };
  },
  props: {
    isActive: Boolean,
    height: Number,
  },
  watch: {
    isActive: {
      handler: async function (newValue) {
        if (newValue) {
          if (this.loadingPromise) {
            await this.loadingPromise;
          } else {
            // Hack to trigger rerender when the view is changed
            this.forceRerender();
          }
        }
      },
    },
    loadingPromise: {
      handler: function (newValue) {
        if (!this.loadingInstance) {
          return;
        }
        if (newValue) {
          this.loadingInstance.show();
        } else {
          this.loadingInstance.close();
        }
      },
    },
  },
  computed: {
    visibleColumns: function () {
      return this.columns.filter((c) => {
        return this.selectedColumns.indexOf(c.key) >= 0;
      });
    },
  },
  methods: {
    pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
      this.loadingPromise = this.loadDataForCurrentPage();
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.loadingPromise = this.loadDataForCurrentPage();
    },
    forceRerender() {
      this.$nextTick(() => {
        // Hack to trigger rerender when the view is changed
        const backup = this.tableData.slice();
        this.tableData.splice(0);
        backup.forEach((b) => this.tableData.push(b));
      });
    },
    loadDataForCurrentPage() {
      const dataSource = this.focusedTableId
        ? this.focusedData
        : this.sortedAllData
        ? this.sortedAllData
        : this.allData;
      this.tableData = dataSource.slice(
        (this.pageIndex - 1) * this.pageSize,
        this.pageIndex * this.pageSize
      );
    },
    async loadInitialTable() {},
    async addData(metadata) {
      this.$parent.toggleWorkingTable();
      if (this.histories.find((h) => h.table.id === metadata.table.id)) {
        return;
      }
      this.histories.push(metadata);
      this.$nextTick(async () => {
        this.loadingPromise = this.reloadData();
        await this.loadingPromise;
        this.loadingPromise = null;
      });
    },
    async getJoinedTable(tableId, key, resourceStats) {
      console.time(`DuckDB table load ${tableId}`);
      await DuckDB.loadParquet(tableId);
      console.timeEnd(`DuckDB table load ${tableId}`);

      console.time(`DuckDB table copy ${tableId}`);
      const tableData = (await DuckDB.getFullTable(tableId)).toArray();
      console.timeEnd(`DuckDB table copy ${tableId}`);
      console.time(`Hash table data ${tableId}`);
      const hashedTableData = [];
      for (
        let chunkCounter = 0;
        chunkCounter < tableData.length / CHUNK_SIZE;
        ++chunkCounter
      ) {
        const chunk = tableData.slice(
          chunkCounter * CHUNK_SIZE,
          (chunkCounter + 1) * CHUNK_SIZE
        );
        await new Promise((resolve) => {
          window.setTimeout(() => {
            for (let i = 0; i < chunk.length; ++i) {
              const row = tableData[i].toJSON();
              const rowDict = {};
              resourceStats.schema.fields.forEach((f, j) => {
                rowDict[f.name] = row[j];
              });
              if (!hashedTableData[rowDict[key]]) {
                hashedTableData[rowDict[key]] = {};
              }
              for (let k in rowDict) {
                if (k === key) {
                  continue;
                }
                if (!hashedTableData[rowDict[key]][k]) {
                  hashedTableData[rowDict[key]][k] = [];
                }
                hashedTableData[rowDict[key]][k].push(rowDict[k]);
              }
            }
            resolve();
          });
        });
      }
      console.timeEnd(`Hash table data ${tableId}`);
      return hashedTableData;
    },
    async loadFocusedTable() {
      if (!this.focusedTableId) {
        return;
      }
      this.focusedData.splice(0);
      this.focusedColumns.splice(0);
      this.pageIndex = 1;
      const columnSet = new Set();
      const dataSource = this.sortedAllData ? this.sortedAllData : this.allData;
      for (
        let chunkCounter = 0;
        chunkCounter < dataSource.length / CHUNK_SIZE;
        ++chunkCounter
      ) {
        await new Promise((resolve) => {
          window.setTimeout(() => {
            dataSource
              .slice(chunkCounter * CHUNK_SIZE, (chunkCounter + 1) * CHUNK_SIZE)
              .filter((d) => {
                const tableId = d.rowKey.split("_")[0];
                return tableId === this.focusedTableId;
              })
              .forEach((d) => {
                this.focusedData.push(d);
                Object.keys(d).forEach((k) => columnSet.add(k));
              });
            resolve();
          });
        });
      }
      this.focusedColumns = this.columns.filter((c) => {
        return this.selectedColumns.indexOf(c.key) >= 0 && columnSet.has(c.key);
      });
      this.totalCount = this.focusedData.length;
    },
    async focusOnTable(tableId) {
      this.focusedTableId = tableId;
      this.loadingPromise = this.loadFocusedTable();
      await this.loadingPromise;
      this.loadingPromise = null;
      this.loadDataForCurrentPage();
    },
    unfocusOnTable() {
      this.focusedTableId = null;
      this.focusedData.splice(0);
      this.focusedColumns.splice(0);
      this.totalCount = this.allData.length;
      this.loadDataForCurrentPage();
    },
    sortTableData() {
      if (!this.sortConfig.key) {
        this.sortedAllData = null;
        return;
      }
      const columnTypes = [];
      for (let h of this.histories) {
        // First, try to find column key in the base table
        let colunm = h.resourceStats.schema.fields.find(
          (f) => f.name === this.sortConfig.key
        );
        // If not found, try to find it in all joined tables
        if (!colunm) {
          for (let j in h.joinedTables) {
            colunm = h.joinedTables[j].targetResourceStats.schema.fields.find(
              (f) => f.name === this.sortConfig.key
            );
            if (colunm) {
              break;
            }
          }
        }
        if (colunm) {
          columnTypes.push(colunm.type);
        }
      }
      const isNumericalSorting = columnTypes.every(
        (t) => t === "integer" || t === "number"
      );
      this.sortedAllData = [...this.allData].sort((a, b) => {
        const order = this.sortConfig.order === "asc" ? 1 : -1;
        let aValue = a[this.sortConfig.key] ? a[this.sortConfig.key] : "";
        let bValue = b[this.sortConfig.key] ? b[this.sortConfig.key] : "";
        if (typeof aValue !== "string") {
          aValue = aValue.values ? aValue.values.join("; ") : "";
        }
        if (typeof bValue !== "string") {
          bValue = bValue.values ? bValue.values.join("; ") : "";
        }
        return isNumericalSorting
          ? order * (Number(aValue) - Number(bValue))
          : order * aValue.localeCompare(bValue);
      });
    },
    async reloadData() {
      console.time("Full reload");
      this.allData = [];
      this.columns = [];
      const columns = {};

      const selectedColumnsSet = new Set();
      for (let metadata of this.histories) {
        console.time(`DuckDB table copy ${metadata.table.id}`);
        const tableData = (
          await DuckDB.getFullTableWithFilter(metadata.table.id, this.keywords)
        ).toArray();
        console.timeEnd(`DuckDB table copy ${metadata.table.id}`);
        console.time(`Post-process ${metadata.table.id}`);
        metadata.resourceStats.schema.fields.forEach((f) => {
          if (!columns[f.name]) {
            columns[f.name] = [];
          }
          columns[f.name].push(metadata.table.id);
        });
        metadata.visibleColumns.forEach((c) => {
          selectedColumnsSet.add(c);
        });
        const foreignTables = {};
        for (let tableId in metadata.joinedTables) {
          const tableHash = await this.getJoinedTable(
            tableId,
            metadata.joinedTables[tableId].targetKey,
            metadata.joinedTables[tableId].targetResourceStats
          );
          foreignTables[tableId] = tableHash;
          metadata.joinedTables[tableId].columns.forEach((c) => {
            if (!columns[c]) {
              columns[c] = [];
            }
            columns[c].push(tableId);
          });
        }
        for (
          let chunkCounter = 0;
          chunkCounter < tableData.length / CHUNK_SIZE;
          ++chunkCounter
        ) {
          await new Promise((resolve) => {
            window.setTimeout(() => {
              for (
                let i = chunkCounter * CHUNK_SIZE;
                i < (chunkCounter + 1) * CHUNK_SIZE && i < tableData.length;
                ++i
              ) {
                const row = tableData[i].toJSON();
                const rowDict = { rowKey: `${metadata.table.id}_${i}` };
                metadata.resourceStats.schema.fields.forEach((f, j) => {
                  rowDict[f.name] = row[j];
                });
                for (let tableId in metadata.joinedTables) {
                  const foreignTable = foreignTables[tableId];
                  const currentJoinedTable = metadata.joinedTables[tableId];
                  const lookup = rowDict[currentJoinedTable.sourceKey];
                  const foreignRow = foreignTable[lookup];
                  if (!foreignRow) {
                    continue;
                  }
                  currentJoinedTable.columns.forEach((c) => {
                    rowDict[c] = { tableId, values: foreignRow[c] };
                  });
                }
                this.allData.push(rowDict);
              }
              resolve();
            });
          });
        }
        console.timeEnd(`Post-process ${metadata.table.id}`);
      }
      if (!(this.sortConfig.key in columns)) {
        this.sortConfig.key = null;
        this.sortConfig.order = null;
      }

      for (let columnName in columns) {
        this.columns.push({
          field: columnName,
          key: columnName,
          title: columnName,
          tables: columns[columnName],
          width: 500,
          ellipsis: true,
          sortBy:
            this.sortConfig.key === columnName ? this.sortConfig.order : "",
          renderBodyCell: ({ row, column }, h) => {
            const style = {};
            const tableId = row.rowKey.split("_")[0];
            const content = row[column.field];
            let text = content;
            if (typeof content !== "string") {
              text = content ? content.values.join("; ") : "NULL";
            }
            if (this.isColorEnabled && content) {
              style.color = TableColorManger.getColor(
                typeof content === "string" ? tableId : content.tableId
              );
            }
            return h("span", { style }, text);
          },
        });
      }
      this.totalCount = this.allData.length;
      const columnsSet = new Set(this.columns.map((c) => c.key));
      this.selectedColumns = this.selectedColumns.filter((c) => {
        return columnsSet.has(c);
      });
      selectedColumnsSet.forEach((c) => {
        this.selectedColumns.push(c);
      });
      this.sortTableData();
      await this.loadFocusedTable();
      this.loadDataForCurrentPage();
      console.timeEnd("Full reload");
    },
    async addNewKeyword(newKeyWordText) {
      this.keywords.push(newKeyWordText);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async removeKeyword(i) {
      this.keywords.splice(i, 1);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async resetTable() {
      this.pageIndex = 1;
      this.totalCount = 0;
      this.columns.splice(0);
      this.allData.splice(0);
      this.tableData.splice(0);
      this.inferredstats = null;
      (this.loadingPromise = null), this.selectedColumns.splice(0);
      this.histories.splice(0);
      this.focusedTableId = null;
      this.focusedData.splice(0);
      this.focusedColumns.splice(0);
      this.keywords.splice(0);
    },
    addSelectedColumn(item) {
      this.selectedColumns.push(item);
    },
    removeSelectedColumn(item) {
      this.selectedColumns.splice(this.selectedColumns.indexOf(item), 1);
    },
    async removeTable(t) {
      if (t.table.id === this.focusedTableId) {
        this.focusedTableId = null;
      }
      this.histories.splice(this.histories.indexOf(t), 1);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
    },
    async addColumn(sourceResourceId, joinable, column) {
      const history = this.histories.find(
        (h) => h.table.id === sourceResourceId
      );
      if (!history) {
        return;
      }
      if (!history.joinedTables) {
        history.joinedTables = {};
      }
      const targetId = joinable.target_resource.id;
      if (!history.joinedTables[targetId]) {
        history.joinedTables[targetId] = {
          sourceKey: this.columns[joinable.source_index].key,
          targetKey: joinable.target_field_name,
          targetResourceStats: joinable.target_resourcestats,
          targerResource: joinable.target_resource,
          columns: new Set(),
        };
      }
      history.joinedTables[targetId].columns.add(column.name);
      this.selectedColumns.push(column.name);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async sortChange(params) {
      let isSortByColumn = false;
      for (let k in params) {
        if (params[k]) {
          this.sortConfig.key = k;
          this.sortConfig.order = params[k];
          isSortByColumn = true;
          break;
        }
      }
      if (!isSortByColumn) {
        this.sortConfig.key = null;
        this.sortConfig.order = null;
      }
      this.columns.forEach((c) => {
        c.sortBy = this.sortConfig.key === c.key ? this.sortConfig.order : "";
      });
      this.loadingPromise = new Promise((resolve) => {
        window.setTimeout(() => {
          this.sortTableData();
          if (this.focusedTableId) {
            this.loadFocusedTable().then(() => {
              this.loadDataForCurrentPage();
              resolve();
            });
          } else {
            this.loadDataForCurrentPage();
            resolve();
          }
        });
      });
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async dumpCsv() {},
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$refs.tableContainer,
      name: "wave",
    });
  },
  destroyed() {
    this.loadingInstance.destroy();
    this.loadingInstance = null;
  },
};
</script>

<style lang="scss">
.table-body-cell-highlighted {
  color: var(--bs-blue) !important;
}
.working-table-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}
.working-table-outer-container {
  height: 100%;
  display: flex;
  flex-direction: row-reverse;
  .working-table-inner-container {
    .table-pagination {
      border: 1px solid #eee;
      display: flex;
      flex-direction: row;
      flex-grow: 1;
      justify-content: center;
      padding-top: 4px;
      padding-bottom: 4px;
      a.ve-dropdown-dt-selected {
        width: 120px !important;
      }
    }
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    .ve-table {
      overflow-y: overflow;
      width: 100%;
    }
  }
}
</style>
