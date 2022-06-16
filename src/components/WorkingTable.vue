<template>
  <div class="working-table-outer-container">
    <working-table-description
      :histories="histories"
      :logs="logs"
      :selectedColumns="selectedColumns"
      :columns="columns"
      :keywords="keywords"
      :focusedComponentIndex="focusedComponentIndex"
      v-if="histories.length > 0"
      ref="workingTableDescription"
    />
    <div class="working-table-inner-container" ref="tableContainer">
      <div class="table-pagination" v-if="histories.length > 0">
        <div v-if="isPaginationLoading">
          <b-spinner small></b-spinner>
          <span>Loading Pagination...</span>
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
        :event-custom-option="eventCustomOption"
        :sort-option="sortOption"
        row-key-field-name="rowKey"
        ref="table"
      />
      <div class="working-table-empty" v-if="histories.length === 0">
        The working table is currently empty. You can add rows to it by opening
        a file and click on "Add to Working Table" from the right panel.
      </div>
    </div>
    <div
      class="table-tooltip tooltip b-tooltip bs-tooltip-bottom"
      ref="tableToolTip"
      v-if="isEllipsisEnabled"
      v-show="tooltipVisible"
    >
      <div class="tooltip-inner">
        {{ tooltipText }}
      </div>
    </div>
  </div>
</template>

<script>
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";
import TableColorManger from "../TableColorManager";
import axios from "axios";
import { createPopper } from "@popperjs/core";
const TABLE_ID = "__table_id";
const NULL_TEXT = "NULL";
export default {
  data() {
    const IS_ELLIPSIS_ENABLED = true;
    return {
      pageIndex: 1,
      pageSize: 25,
      totalCount: 0,
      focusedComponentIndex: null,
      tooltipVisible: false,
      tooltipText: "",
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
      cellTableMap: {},
      histories: [],
      logs: [],
      keywords: [],
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
      isEllipsisEnabled: IS_ELLIPSIS_ENABLED,
      eventCustomOption: IS_ELLIPSIS_ENABLED
        ? {
            bodyCellEvents: ({ row, column }) => {
              return {
                mouseenter: (event) => {
                  this.mouseEnterCell(event, row, column);
                },
                mouseleave: (event) => {
                  this.mouseLeaveCell(event, row, column);
                },
              };
            },
          }
        : {},
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
        return this.selectedColumns.indexOf(c.title) >= 0;
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
      const cellTableMap = {};
      (await DuckDB.getFullTable(this.viewName, this.pageIndex, this.pageSize))
        .toArray()
        .map((d) => d.toJSON())
        .forEach((d, i) => {
          const tableIds = d[TABLE_ID].split(",");
          d[TABLE_ID] = tableIds;
          for (let k in d) {
            if (k === TABLE_ID) {
              continue;
            }
            const value = d[k];
            d[k] = /^[;\s]*$/.test(value) || !value ? NULL_TEXT : value;
            for (let tableId of tableIds) {
              if (
                this.columnsMapping[tableId] &&
                k in this.columnsMapping[tableId].mappedToColumnIndex
              ) {
                if (!cellTableMap[i]) {
                  cellTableMap[i] = {};
                }
                cellTableMap[i][k] = tableId;
                break;
              }
            }
          }
          d.rowKey = i;
          this.tableData.push(d);
          this.cellTableMap = cellTableMap;
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
            this.addSelectedColumn(c.title);
          }
        });
      });
    },
    reloadColumns() {
      const columns = [];
      const columnTitles = new Set();
      for (let k in this.workingTableColumns) {
        const tables = new Set();
        for (let tableId in this.columnsMapping) {
          if (
            this.columnsMapping[tableId] &&
            k in this.columnsMapping[tableId].mappedToColumnIndex &&
            this.columnsMapping[tableId].mappedToColumnIndex[k] !== null
          ) {
            tables.add(tableId);
          }
        }
        if (columnTitles.has(this.workingTableColumns[k].name)) {
          continue;
        }
        columns.push({
          field: k,
          key: k,
          title: this.workingTableColumns[k].name,
          width: 300,
          ellipsis: this.isEllipsisEnabled
            ? {
                showTitle: false,
              }
            : undefined,
          sortBy: this.sortConfig.key === k ? this.sortConfig.order : "",
          type: this.workingTableColumns[k].type,
          renderBodyCell: this.renderBodyCell,
          tables: Array.from(tables),
        });
        columnTitles.add(this.workingTableColumns[k].name);
      }
      this.columns = columns;
    },
    renderBodyCell({ row, column }, h) {
      const style = {};
      const value = row[column.key];
      const tableId = this.cellTableMap[row.rowKey][column.key];
      if (this.isColorEnabled && value !== NULL_TEXT) {
        const color = TableColorManger.getColor(tableId);
        style.color = color;
      }
      return h("span", { style }, value);
    },
    async reloadData(preventReloadColumns = false) {
      let focusedIds;
      if (!isNaN(parseInt(this.focusedComponentIndex))) {
        const history = this.histories[this.focusedComponentIndex];
        focusedIds = new Set([history.table.id]);
        if (history.joinedTables) {
          for (let id in history.joinedTables) {
            focusedIds.add(id);
          }
        }
      }
      this.isPaginationLoading = true;
      console.time("Full reload");
      if (!this.histories || this.histories.length === 0) {
        await this.resetTable();
        this.isPaginationLoading = false;
        return;
      }
      const { viewName, columnsMapping, workingTableColumns } =
        await DuckDB.createWorkingTable(
          this.histories,
          this.keywords,
          this.sortConfig,
          focusedIds
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
      this.selectedColumns = this.selectedColumns.filter((c) => {
        return this.columns.find((c2) => c2.title === c);
      });
      this.$refs.workingTableDescription.syncSelectedColumns();
      console.timeEnd("Full reload");
    },
    async reloadCount() {
      console.time("Reloading count");
      if (this.pageIndex === 1 && this.tableData.length < this.pageSize) {
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
      this.logs.push({
        type: "keyword",
        keyword: newKeyWordText,
        time: new Date(),
      });
    },
    async removeKeyword(i, byIndex = true) {
      if (!byIndex) {
        i = this.keywords.indexOf(i);
      }
      const removedKeyword = this.keywords.splice(i, 1)[0];
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
      for (let j = 0; j < this.logs.length; ++j) {
        const l = this.logs[j];
        if (l.type === "keyword" && l.keyword === removedKeyword) {
          this.logs.splice(j, 1);
          break;
        }
      }
    },
    async resetTable() {
      this.pageIndex = 1;
      this.totalCount = 0;
      this.focusedComponentIndex = null;
      this.columns = [];
      this.columnsMapping = {};
      this.workingTableColumns = {};
      this.viewName = null;
      this.tableData = [];
      this.selectedColumns = [];
      this.cellTableMap = {};
      this.histories = [];
      this.logs = [];
      this.keywords = [];
      this.sortConfig = {
        key: null,
        order: null,
        isNumeric: false,
      };
      await DuckDB.resetWorkingTable(true);
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
    async removeTable(t, byId = false) {
      if (byId) {
        t = this.histories.find((h) => h.table.id === t);
      }
      const removedHistory = this.histories.splice(
        this.histories.indexOf(t),
        1
      )[0];
      const removedTableId = removedHistory.table.id;
      this.logs = this.logs
        .map((l) => {
          if (l.type === "join") {
            l.sources = l.sources.filter((s) => s.id !== removedTableId);
          }
          return l;
        })
        .filter((l) => {
          if (l.type === "union" && l.table.id === removedTableId) {
            return false;
          }
          if (l.type === "join" && l.sources.length === 0) {
            return false;
          }
          return true;
        });

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
            targetResource: joinable.target_resource,
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
          this.addSelectedColumn(c.title);
        }
      });
      this.logs.push({
        type: "join",
        column: column.name,
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
      for (let h of this.histories) {
        TableColorManger.addColor(h.table.id, h.table.color);
        if (h.joinedTables) {
          for (let j in h.joinedTables) {
            TableColorManger.addColor(
              j,
              h.joinedTables[j].targetResource.color
            );
          }
        }
      }
      await this.reloadData();
    },
    mouseEnterCell(event, row, column) {
      createPopper(
        event.target.querySelector("span"),
        this.$refs.tableToolTip,
        {
          placement: "bottom",
          modifiers: [
            {
              name: "flip",
              options: {
                fallbackPlacements: ["top"],
              },
            },
            {
              name: "offset",
              options: {
                offset: [0, 0],
              },
            },
          ],
        }
      );
      const value = row[column.key];
      this.tooltipText = value;
      this.tooltipVisible = true;
    },
    mouseLeaveCell() {
      this.tooltipVisible = false;
      this.tooltipText = "";
    },
    async undoJoinLog(log) {
      const sourcesSet = new Set(log.sources.map((s) => s.id));
      for (let h of this.histories) {
        if (sourcesSet.has(h.table.id)) {
          if (h.joinedTables && h.joinedTables[log.table.id]) {
            h.joinedTables[log.table.id].columns = h.joinedTables[
              log.table.id
            ].columns.filter((c) => c !== log.column);
            if (h.joinedTables[log.table.id].columns.length === 0) {
              delete h.joinedTables[log.table.id];
            }
            if (Object.keys(h.joinedTables).length === 0) {
              delete h.joinedTables;
            }
          }
        }
      }
      this.loadingPromise = this.reloadData();
      await this.loadingPromise;
      this.loadingPromise = null;
      this.logs = this.logs.filter((l) => l !== log);
    },
    async undoLog(log) {
      switch (log.type) {
        case "join":
          await this.undoJoinLog(log);
          break;
        case "keyword":
          this.removeKeyword(log.keyword, false);
          break;
        case "union":
          this.removeTable(log.table.id, true);
          break;
        default:
          break;
      }
    },
    async focusComponent(i) {
      if (this.focusedComponentIndex === i) {
        this.focusedComponentIndex = null;
      } else {
        this.focusedComponentIndex = i;
      }
      this.pageIndex = 1;
      this.loadingPromise = this.reloadData(true);
      await this.loadingPromise;
      this.loadingPromise = null;
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
.table-tooltip {
  position: absolute;
}
</style>
