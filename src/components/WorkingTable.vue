<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :selectedColumns="selectedColumns"
      :columns="columns"
      v-if="!!tableId"
    />
    <div
      class="working-table-inner-container"
      ref="tableContainer"
      v-show="!!tableId"
    >
      <div class="table-pagination">
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
        v-if="!!tableId && tableData.length > 0"
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :cell-style-option="cellStyleOption"
        :tableData="tableData"
        :columns="visibleColumns"
        row-key-field-name="rowKey"
        ref="table"
      />
    </div>
    <div class="working-table-empty" v-if="!tableId">
      The working table is currently empty. You can add rows to it by opening a
      file and click on "Add to Working Table from the right panel."
    </div>
  </div>
</template>

<script>
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";

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
      tableId: null,
      tableData: [],
      inferredstats: null,
      loadingPromise: null,
      selectedColumns: [],
      cellStyleOption: {},
      histories: [],
      dataviewRefreshDelay: null,
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
    async loadDataForCurrentPage() {
      this.tableData.splice(0);
      const tableId = this.tableId;
      if (!tableId) {
        return;
      }
      console.time(`DuckDB Query ${tableId}`);
      const arrowTable = await DuckDB.getFullTable(
        tableId,
        this.pageIndex,
        this.pageSize
      );
      console.timeEnd(`DuckDB Query ${tableId}`);
      console.time(`Post-process ${tableId}`);
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: String(i) };
        const rowObject = r.toJSON();
        Object.keys(rowObject).forEach((k) => {
          const key = k.split("_")[1];
          if (key) {
            rowDict[key] = rowObject[k];
          } else {
            rowDict[k] = rowObject[k];
          }
        });
        this.tableData.push(rowDict);
      });
      console.timeEnd(`Post-process ${tableId}`);
      this.loadingPromise = null;
    },
    async loadInitialTable(table) {
      console.time("Working table creation");
      this.tableId = "Loading";
      const { totalCount, tableName } = await DuckDB.createWorkingTable(
        table.viewId,
        table.baseTable.id
      );
      console.timeEnd("Working table creation");
      this.totalCount = totalCount;
      this.tableId = tableName;
      table.columns.forEach((c, i) => {
        this.columns.push({
          field: String(i),
          key: String(i),
          ellipsis: { showTitle: true },
          title: c.title,
          width: 300,
          renderBodyCell: ({ row, column }, h) => {
            const style = {};
            const tableId = row.TID;
            const table = this.histories.filter(
              (hist) => hist.baseTable.id === tableId
            )[0];
            const originalColumn = table.columns[parseInt(column.key)];
            if (this.isColorEnabled) {
              const color = originalColumn.isJoinedTable
                ? table.joinedTable.resource.color
                : table.baseTable.color;
              style.color = color;
            }
            const text = row[column.field];
            return h("span", { style }, text);
          },
        });
      });
      table.columns.forEach((_, i) => {
        this.selectedColumns.push(String(i));
      });
      this.histories.push(table);
      await this.loadDataForCurrentPage();
    },
    async tryAutoUnion(table) {
      const targetColumns = {};
      const unionColumns = [];
      table.columns.forEach((c) => (targetColumns[c.title] = c));
      for (let i = 0; i < this.columns.length; ++i) {
        const c = this.columns[i];
        if (!targetColumns[c.title]) {
          return false;
        }
        unionColumns.push({
          sourceKey: c.key,
          targetKey: targetColumns[c.title].key,
        });
      }
      this.$nextTick(() => {
        this.$parent.toggleWorkingTable();
      });
      this.loadingPromise = DuckDB.autoUnionWorkingTable(
        table.viewId,
        table.baseTable.id,
        unionColumns
      );
      const { totalCount, tableName } = await this.loadingPromise;
      this.totalCount = totalCount;
      this.tableId = tableName;
      this.histories.push(table);
      await this.loadDataForCurrentPage();
      return true;
    },
    async addData(table) {
      if (!this.tableId) {
        this.$nextTick(() => {
          this.$parent.toggleWorkingTable();
        });
        this.loadingPromise = this.loadInitialTable(table);
      } else {
        const matchedTables = this.histories.filter(
          (f) => f.baseTable.id === table.baseTable.id
        );
        if (matchedTables.length > 0) {
          return { success: false };
        }
        const autoUnionResult = await this.tryAutoUnion(table);
        if (!autoUnionResult) {
          alert("Cannot auto union");
        }
      }
      await this.loadingPromise;
      return { success: true };
    },
    async resetTable() {
      this.pageIndex = 1;
      this.totalCount = 0;
      this.columns.splice(0);
      this.tableId = null;
      this.tableData.splice(0);
      this.inferredstats = null;
      (this.loadingPromise = null), this.selectedColumns.splice(0);
      this.histories.splice(0);
      this.dataviewRefreshDelay = null;
      await DuckDB.resetWorkingTable();
    },
    addSelectedColumn(item) {
      this.selectedColumns.push(String(item));
    },
    removeSelectedColumn(item) {
      this.selectedColumns.splice(
        this.selectedColumns.indexOf(String(item)),
        1
      );
    },
    async removeTable(t) {
      const { totalCount, tableName } = await DuckDB.removeFromWorkingTable(
        t.baseTable.id
      );
      this.totalCount = totalCount;
      this.tableName = tableName;
      this.histories = this.histories.filter(
        (h) => h.baseTable.id !== t.baseTable.id
      );
      if (this.histories.length === 0) {
        await this.resetTable();
      } else {
        await this.loadDataForCurrentPage();
      }
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
    },
    async dumpCsv() {
      this.loadingPromise = DuckDB.dumpCsv(
        this.tableId,
        this.visibleColumns.map((c) => c.title),
        this.visibleColumns.map((c) => `W_${c.key}`)
      );
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    unionTable(unionable) {
      this.histories.push({
        baseTable: unionable,
        filters: [],
        joinedTable: {
          resource: null,
          sourceIndex: null,
          targetIndex: null,
          resourceStats: null,
          selectedFields: [],
        },
      });
    },
    joinTable(joinable, sourceId) {
      for (let i = 0; i < this.histories.length; ++i) {
        const h = this.histories[i];
        if (h.baseTable.id === sourceId) {
          h.joinedTable.resource = joinable.target_resource;
          h.joinedTable.targetIndex = joinable.target_index;
          break;
        }
      }
    },
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
