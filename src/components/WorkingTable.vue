<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :selectedColumns="selectedColumns"
      :columns="columns"
    />
    <div class="working-table-inner-container" ref="tableContainer">
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
      uniqueRowNumbers: [],
      columns: [],
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
            this.$nextTick(() => {
              setTimeout(() => {
                this.loadDataForCurrentPage();
              }, 50);
            });
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
    addSelectedColumn(item) {
      this.selectedColumns.push(String(item));
    },
    removeSelectedColumn(item) {
      this.selectedColumns.splice(
        this.selectedColumns.indexOf(String(item)),
        1
      );
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
