<template>
  <div class="working-table-outer-container">
    <working-table-description />
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
        v-if="!!tableId"
        :max-height="height ? height : 10"
        :virtual-scroll-option="virtualScrollOption"
        :cell-style-option="cellStyleOption"
        :tableData="tableData"
        :columns="columns"
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
    const pageSize = 25;
    const tableData = [];
    for (let i = 0; i < pageSize; ++i) {
      tableData.push({});
    }
    return {
      pageIndex: 1,
      pageSize: pageSize,
      totalCount: 0,
      virtualScrollOption: {
        enable: true,
      },
      uniqueRowNumbers: [],
      columns: [],
      tableId: null,
      tableData,
      inferredstats: null,
      loadingPromise: null,
      selectedFields: [],
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
    height: {
      handler: function (newValue) {
        console.log("height", newValue);
      },
    },
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
      console.time(`DuckDB Query ${tableId}`);
      const arrowTable = await DuckDB.getFullTable(
        tableId,
        this.pageIndex,
        this.pageSize
      );
      console.timeEnd(`DuckDB Query ${tableId}`);
      console.time(`Post-process ${tableId}`);
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: i };
        const rowObject = r.toJSON();
        Object.keys(rowObject).forEach((k) => {
          const key = k.split("_")[1];
          if (key) {
            rowDict[key] = rowObject[k];
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
      await this.loadDataForCurrentPage();
    },
    addData(table) {
      this.$nextTick(() => {
        this.$parent.toggleWorkingTable();
        console.log("addData", table);
        if (!this.tableId) {
          this.loadingPromise = this.loadInitialTable(table);
        }
      });
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
