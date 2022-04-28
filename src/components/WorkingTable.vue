<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :selectedColumns="selectedColumns"
      :columns="columns"
      :keywords="keywords"
      v-if="histories.length > 0"
    />
    <div
      class="working-table-inner-container"
      ref="tableContainer"
      v-show="histories.length > 0"
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
        v-if="tableData.length > 0"
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :cell-style-option="cellStyleOption"
        :tableData="tableData"
        :columns="visibleColumns"
        row-key-field-name="rowKey"
        ref="table"
      />
    </div>
    <div class="working-table-empty" v-if="histories.length === 0">
      The working table is currently empty. You can add rows to it by opening a
      file and click on "Add to Working Table" from the right panel.
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
      tableData: [],
      allData: [],
      inferredstats: null,
      loadingPromise: null,
      selectedColumns: [],
      cellStyleOption: {},
      histories: [],
      keywords: [],
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
    loadDataForCurrentPage() {
      this.tableData = this.allData.slice(
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
    async reloadData() {
      this.allData = [];
      this.columns = [];
      const columns = {};
      const columnsSet = new Set(this.columns.map((c) => c.key));
      this.selectedColumns = this.selectedColumns.filter((c) => {
        return columnsSet.has(c);
      });
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
        for (let i = 0; i < tableData.length; ++i) {
          const row = tableData[i].toJSON();
          const rowDict = { rowKey: String(i) };
          metadata.resourceStats.schema.fields.forEach((f, j) => {
            rowDict[f.name] = row[j];
          });
          this.allData.push(rowDict);
        }
        console.timeEnd(`Post-process ${metadata.table.id}`);
      }
      for (let columnName in columns) {
        this.columns.push({
          field: columnName,
          key: columnName,
          title: columnName,
          tables: columns[columnName],
          width: 300,
          ellipsis: true,
        });
      }
      this.totalCount = this.allData.length;
      selectedColumnsSet.forEach((c) => {
        this.selectedColumns.push(c);
      });
      this.loadDataForCurrentPage();
    },
    async addNewKeyword(newKeyWordText) {
      this.keywords.push(newKeyWordText);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
    },
    async removeKeyword(i) {
      this.keywords.splice(i, 1);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
    },
    async resetTable() {
      this.pageIndex = 1;
      this.totalCount = 0;
      this.columns.splice(0);
      this.tableData.splice(0);
      this.inferredstats = null;
      (this.loadingPromise = null), this.selectedColumns.splice(0);
      this.histories.splice(0);
      this.dataviewRefreshDelay = null;
    },
    addSelectedColumn(item) {
      this.selectedColumns.push(item);
    },
    removeSelectedColumn(item) {
      this.selectedColumns.splice(this.selectedColumns.indexOf(item), 1);
    },
    async removeTable(t) {
      this.histories.splice(this.histories.indexOf(t), 1);
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
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
