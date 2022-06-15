<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :logs="logs"
      :selectedColumns="selectedColumns"
      :columns="columns"
      :keywords="keywords"
      v-if="histories.length > 0"
      ref="workingTableDescription"
    />
    <div class="working-table-inner-container" ref="tableContainer">
      <div class="table-pagination">
        <div v-if="isPaginationLoading">
          <b-spinner small></b-spinner>
          <span>Loading Pageination...</span>
        </div>
        <ve-pagination
          v-else
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
// import TableColorManger from "../TableColorManager";
import axios from "axios";

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
      columnsMapping: {},
      workingTableColumns: {},
      isColorEnabled: false,
      viewName: null,
      tableData: [],
      loadingPromise: null,
      selectedColumns: [],
      cellStyleOption: {},
      histories: [],
      logs: [],
      keywords: [],
      focusedTableId: null,
      isPaginationLoading: false,
      sortOption: {
        sortChange: (params) => {
          this.sortChange(params);
        },
      },
      sortConfig: {
        key: null,
        order: null,
        isNumeric: false,
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
      const result = this.columns.filter((c) => {
        return this.selectedColumns.indexOf(c.field) >= 0;
      });
      return result;
    },
  },
  methods: {
    async pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      this.loadingPromise = null;
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
      console.time("Load data for page " + this.pageIndex);
      this.tableData.splice(0, this.tableData.length);
      (await DuckDB.getFullTable(this.viewName, this.pageIndex, this.pageSize))
        .toArray()
        .map((d) => d.toJSON())
        .forEach((d, i) => {
          d.rowKey = i;
          this.tableData.push(d);
        });
      console.timeEnd("Load data for page " + this.pageIndex);
    },
    addData(metadata, visibleColumns) {
      this.$parent.toggleWorkingTable();
      if (this.histories.find((h) => h.table.id === metadata.table.id)) {
        return;
      }
      this.histories.push(metadata);
      this.logs.push({
        type: "union",
        table: metadata.table,
        time: new Date(),
      });
      this.$nextTick(async () => {
        this.loadingPromise = this.reloadData();
        await this.loadingPromise;
        this.loadingPromise = null;
        const visibleColumnsSet = new Set(visibleColumns);
        this.columns.forEach((c) => {
          if (visibleColumnsSet.has(c.title)) {
            this.addSelectedColumn(c.field);
          }
        });
      });
    },
    reloadColumns() {
      const columns = [];
      const columnTitles = new Set();
      for (let k in this.workingTableColumns) {
        if (columnTitles.has(this.workingTableColumns[k].name)) {
          continue;
        }
        columns.push({
          field: k,
          key: k,
          title: this.workingTableColumns[k].name,
          width: 300,
          ellipsis: {
            showTitle: true,
          },
          sortBy: this.sortConfig.key === k ? this.sortConfig.order : "",
          type: this.workingTableColumns[k].type,
        });
        columnTitles.add(this.workingTableColumns[k].name);
      }
      this.columns = columns;
    },
    async reloadData(preventReloadColumns = false) {
      this.isPaginationLoading = true;
      console.time("Full reload");
      const { viewName, columnsMapping, workingTableColumns } =
        await DuckDB.createWorkingTable(
          this.histories,
          this.keywords,
          this.sortConfig
        );
      this.viewName = viewName;
      this.columnsMapping = columnsMapping;
      this.workingTableColumns = workingTableColumns;
      if (!preventReloadColumns) {
        this.reloadColumns();
      }
      await this.loadDataForCurrentPage();
      this.reloadCount().then(() => {
        this.isPaginationLoading = false;
      });
      this.$refs.workingTableDescription.syncSelectedColumns();
      console.timeEnd("Full reload");
    },
    async reloadCount() {
      console.time("Reloading count");
      if (this.tableData.length < this.pageSize) {
        this.totalCount = this.tableData.length;
      } else {
        this.totalCount = await DuckDB.getTotalCount(this.viewName);
      }
      console.timeEnd("Reloading count");
    },
    async addNewKeyword(newKeyWordText) {
      this.keywords.push(newKeyWordText);
      this.pageIndex = 1;
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
      this.tableData.splice(0);
      this.selectedColumns.splice(0);
      this.histories.splice(0);
      this.keywords.splice(0);
    },
    addSelectedColumn(item) {
      if (this.selectedColumns.indexOf(item) >= 0) {
        return;
      }
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
      this.pageIndex = 1;
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
    },
    async addColumn(joinables, column) {
      for (let joinable of joinables) {
        const sourceResourceId = joinable.source_resource.id;
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
            sourceKey:
              history.resourceStats.schema.fields[joinable.source_index].name,
            targetKey: joinable.target_field_name,
            targetResourceStats: joinable.target_resourcestats,
            targerResource: joinable.target_resource,
            columns: [],
          };
        }
        if (
          history.joinedTables[targetId].columns.find((c) => c === column.name)
        ) {
          return;
        }
        history.joinedTables[targetId].columns.push(column.name);
      }
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
      this.columns.forEach((c) => {
        if (c.title === column.name) {
          this.addSelectedColumn(c.field);
        }
      });
      this.logs.push({
        type: "join",
        column: column,
        table: joinables[0].target_resource,
        sources: joinables.map((j) => j.source_resource),
        time: new Date(),
      });
    },
    async sortChange(params) {
      let isSortByColumn = false;
      for (let k in params) {
        if (params[k]) {
          this.sortConfig.key = k;
          this.sortConfig.order = params[k];
          this.sortConfig.isNumeric =
            this.workingTableColumns[k].type === "number" ||
            this.workingTableColumns[k].type === "integer";
          isSortByColumn = true;
          break;
        }
      }
      if (!isSortByColumn) {
        this.sortConfig.key = null;
        this.sortConfig.order = null;
        this.sortChange.isNumeric = false;
      }
      this.columns.forEach((c) => {
        c.sortBy = this.sortConfig.key === c.key ? this.sortConfig.order : "";
      });
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async dumpCsv() {
      this.loadingPromise = DuckDB.dumpCsv(
        this.viewId ? this.viewId : this.viewName,
        this.visibleColumns.map((c) => c.title),
        this.visibleColumns.map((c) => c.key)
      );
      await this.loadingPromise;
      this.loadingPromise = null;
    },
    async openSharedTable(id) {
      const result = await axios
        .get(`/api/sharedhistories/${id}`)
        .then((res) => res.data);
      this.histories = result.histories;
      this.keywords = result.keywords;
      this.sortConfig = result.sortConfig;
      this.logs = result.logs;
      this.selectedColumns = result.selectedColumns;
      await this.reloadData();
    },
  },
  async mounted() {
    this.loadingInstance = VeLoading({
      target: this.$refs.tableContainer,
      name: "wave",
    });
    const sharedId = window.location.hash.split("/")[1];
    if (!sharedId) {
      return;
    }
    this.$parent.toggleWorkingTable();
    this.loadingPromise = this.openSharedTable(sharedId);
    await this.loadingPromise;
    this.loadingPromise = null;
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
