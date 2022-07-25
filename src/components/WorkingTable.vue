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
      <div class="working-table-alert-container">
        <b-alert
          :show="dismissCountDown"
          fade
          variant="primary"
          @dismiss-count-down="countDownChanged"
        >
          <span style="font-size: large">
            <b-icon icon="check2" />
            &nbsp;
            <span>
              {{ alertMessage }}
            </span>
          </span>
        </b-alert>
      </div>
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
      <div class="tooltip-inner" v-html="tooltipText"></div>
    </div>

    <b-modal
      title="Error"
      ok-only
      hide-header-close
      ref="duckdbErrorModal"
      size="lg"
    >
      <p>
        Sorry, the operation failed due to an error. The working table is reset
        automatically.
      </p>
      <p class="duckdb-error-message">
        Error message: {{ duckDBErrorMessage }}
      </p>
    </b-modal>
    <working-table-provenance-modal
      :isLoading="provenanceModalInformation.isLoading"
      :dataset="provenanceModalInformation.dataset"
      :table="provenanceModalInformation.table"
      :resourceStats="provenanceModalInformation.resourceStats"
      :positions="provenanceModalInformation.positions"
      ref="workingTableProvenanceModal"
      @modal-closed="provenanceModalClosed()"
    />
  </div>
</template>

<script>
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";
import TableColorManager from "../TableColorManager";
import axios from "axios";
import { createPopper } from "@popperjs/core";
import ExcelColumnName from "excel-column-name";
import Common from "../Common";
const TABLE_ID = "__table_id";
const ROW_ID = "__row_id";
const NULL_TEXT = "NULL";
const DEFAULT_COUNT_DOWN = 3.5;
const UNFILLED_TEXT = "UNFILLED";

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
      cellStyleOption: {
        headerCellClass: () => {
          return "working-table-cell-pointer";
        },
        bodyCellClass: () => {
          if (this.provenanceModalEnabled) {
            return "working-table-cell-pointer";
          }
          return "";
        },
      },
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
      eventCustomOption: {
        bodyCellEvents: ({ row, column }) => {
          return {
            mouseenter: IS_ELLIPSIS_ENABLED
              ? (event) => {
                  this.mouseEnterCell(event, row, column);
                }
              : undefined,
            mouseleave: IS_ELLIPSIS_ENABLED
              ? () => {
                  this.mouseLeaveCell();
                }
              : undefined,
            click: () => {
              if (this.provenanceModalEnabled) {
                this.cellClicked(row, column);
              }
            },
          };
        },
        headerCellEvents: ({ column }) => {
          return {
            mouseenter: (event) => {
              this.mouseEnterHeader(event, column);
            },
            mouseleave: () => {
              this.mouseLeaveCell();
            },
            click: () => {
              this.headerCellClicked(event, column);
            },
          };
        },
      },
      dataDictionary: null,
      dismissCountDown: 0,
      alertMessage: "",
      duckDBErrorMessage: "",
      provenanceModalInformation: {
        isLoading: true,
        dataset: null,
        table: null,
        resourceStats: null,
        positions: [],
      },
      globalColumnFillingSuggestionEnabled: false,
      provenanceModalEnabled: false,
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
      const keywords = this.keywords
        .map((k) => k.toLowerCase().split(" "))
        .flat();
      console.time("Load data for page " + this.pageIndex);
      this.tableData.splice(0, this.tableData.length);
      const columnsToEnable = new Set();
      let duckDBResult;
      try {
        duckDBResult = await DuckDB.getFullTable(
          this.viewName,
          this.pageIndex,
          this.pageSize
        );
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
      duckDBResult
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
            d[k] = {
              value: !value || /^[;\s]*$/.test(value) ? null : value,
            };
            if (k !== ROW_ID && k !== TABLE_ID) {
              keywords.forEach((kw) => {
                if (d[k].value && d[k].value.toLowerCase().includes(kw)) {
                  columnsToEnable.add(k);
                  d[k].isHighlighted = true;
                }
              });
            }
            for (let tableId of tableIds) {
              if (
                this.columnsMapping[tableId] &&
                k in this.columnsMapping[tableId].mappedToColumnIndex
              ) {
                d[k].tableId = tableId;
                break;
              }
            }
          }
          d.rowKey = i;
          this.tableData.push(d);
        });
      columnsToEnable.forEach((c) => {
        if (this.workingTableColumns[c]) {
          this.addSelectedColumn(this.workingTableColumns[c].name);
        }
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
        this.showAlert(`Added rows from table: "${metadata.table.name}" `);
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
          align: "left",
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
      const value = row[column.key].value;
      const tableId = row[column.key].tableId;
      if (this.isColorEnabled) {
        const color =
          value && value !== UNFILLED_TEXT
            ? TableColorManager.getColor(tableId)
            : TableColorManager.nullColor;
        style.color = color;
      }
      if (row[column.key].isHighlighted) {
        style.fontWeight = "bold";
      }
      return h("span", { style }, value ? value : NULL_TEXT);
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
      let viewName, columnsMapping, workingTableColumns;
      try {
        const duckDBResult = await DuckDB.createWorkingTable(
          this.histories,
          this.keywords,
          this.sortConfig,
          focusedIds
        );
        viewName = duckDBResult.viewName;
        columnsMapping = duckDBResult.columnsMapping;
        workingTableColumns = duckDBResult.workingTableColumns;
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
      this.viewName = viewName;
      this.columnsMapping = columnsMapping;
      this.workingTableColumns = workingTableColumns;
      if (!preventReloadColumns) {
        this.reloadColumns();
      }
      const tableIds = Object.keys(this.columnsMapping);
      this.dataDictionary = await axios
        .get(`api/datadictionaries/${tableIds.join(",")}`, {})
        .then((res) => res.data)
        .catch(() => {});
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
        try {
          this.totalCount = await DuckDB.getTotalCount(this.viewName);
        } catch (err) {
          this.handleDuckDBError(err);
          return;
        }
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
      this.showAlert(`Added filter keyword: "${newKeyWordText}" `);
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
      this.showAlert(`Removed filter keyword: "${removedKeyword}" `);
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
      this.histories = [];
      this.logs = [];
      this.keywords = [];
      this.sortConfig = {
        key: null,
        order: null,
        isNumeric: false,
      };
      this.dataDictionary = null;
      this.duckDBErrorMessage = "";
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
      const joinedTablesLength = removedHistory.joinedTables
        ? Object.keys(removedHistory.joinedTables).length
        : 0;
      this.showAlert(
        `Removed table "${removedHistory.table.name}"${
          joinedTablesLength > 0
            ? ` and ${joinedTablesLength} joined tables`
            : ""
        }`
      );
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
    },
    async bulkAddColumns(data, fastMode = true) {
      if (fastMode) {
        const columnSet = new Set();
        for (let d of data) {
          const joinable = d.joinable;
          const column = d.column;
          columnSet.add(column);
          await this.addColumn([joinable], column, true);
        }
        this.loadingPromise = this.reloadData();
        await this.loadingPromise;
        this.loadingPromise = null;
        this.columns.forEach((c) => {
          if (columnSet.has(c.title)) {
            this.addSelectedColumn(c.title);
          }
        });
        this.showAlert(
          `Added ${columnSet.size} column${
            columnSet.size > 1 ? "s" : ""
          } by applying the suggestions`
        );
        // Hack to forcefully trigger rerender
        const historiesTemp = this.histories;
        this.histories = [];
        this.histories = historiesTemp;
        this.$refs.workingTableDescription.$refs.joinableTables.updateFilteredResourcesHash();
      } else {
        for (let d of data) {
          const joinable = d.joinable;
          const column = d.column;
          await this.addColumn([joinable], column);
        }
      }
    },
    async addColumn(joinables, column, skipReloading = false) {
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
      if (!skipReloading) {
        this.loadingPromise = this.reloadData();
        await this.loadingPromise;
        this.loadingPromise = null;
        this.columns.forEach((c) => {
          if (c.title === column.name) {
            this.addSelectedColumn(c.title);
          }
        });
      }
      this.logs.push({
        type: "join",
        column: column.name,
        table: joinables[0].target_resource,
        sources: joinables.map((j) => j.source_resource),
        time: new Date(),
      });

      // Hack to forcefully trigger rerender
      if (!skipReloading) {
        this.showAlert(
          `Added column "${column.name}" from "${joinables[0].target_resource.name}"`
        );
        this.$refs.workingTableDescription.$refs.joinableTables.updateFilteredResourcesHash();
      }
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
        this.visibleColumns.map((c) => c.key),
        "WorkingTable"
      );
      try {
        await this.loadingPromise;
        this.loadingPromise = null;
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
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
        TableColorManager.addColor(h.table.id, h.table.color);
        if (h.joinedTables) {
          for (let j in h.joinedTables) {
            TableColorManager.addColor(
              j,
              h.joinedTables[j].targetResource.color
            );
          }
        }
      }
      await this.reloadData();
    },
    mouseEnterCell(event, row, column) {
      const value = row[column.key].value;
      if (!value) {
        return;
      }
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
                offset: [-50, 0],
              },
            },
          ],
        }
      );
      this.tooltipText = value;
      this.tooltipVisible = true;
    },
    mouseLeaveCell() {
      this.tooltipVisible = false;
      this.tooltipText = "";
    },
    mouseEnterHeader(event, column) {
      createPopper(event.target, this.$refs.tableToolTip, {
        placement: "bottom",
        modifiers: [
          {
            name: "offset",
            options: {
              offset: [-50, 0],
            },
          },
        ],
      });
      this.tooltipText = this.getColumnDescription(column.title);
      this.tooltipVisible = true;
    },
    async getOriginalIndexes(row, column) {
      const tableIds = row[TABLE_ID];
      const value = row[column.key].value;
      if (value === null || value === UNFILLED_TEXT) {
        return;
      }
      let columnIndex, tableId, isMainTable, mainTableId;
      tableIds.forEach((uuid) => {
        const currColumnIndex =
          this.columnsMapping[uuid].mappedToColumnIndex[column.key];
        if (!isNaN(parseInt(currColumnIndex))) {
          columnIndex = currColumnIndex;
          tableId = uuid;
          isMainTable = this.columnsMapping[uuid].isMain;
          return;
        }
      });
      if (!row[ROW_ID]) {
        throw Error(
          "This feature is not avaliable when ROW_ID_ENABLED is set to false"
        );
      }
      const rowId = row[ROW_ID].value;
      const history = this.histories.find(
        (h) =>
          h.table.id === tableId || (h.joinedTables && h.joinedTables[tableId])
      );
      mainTableId = history.table.id;
      if (isMainTable) {
        const inferedStats = history.resourceStats;
        const originalRowIndex = inferedStats.header + 1 + Number(rowId);
        const excelPosition =
          ExcelColumnName.intToExcelCol(columnIndex + 1) + originalRowIndex;
        return {
          table: history.table,
          dataset: history.dataset,
          resourceStats: inferedStats,
          positions: [
            {
              columnIndex,
              rowId,
              originalRowIndex,
              excelPosition,
              value,
            },
          ],
        };
      } else {
        const sourceKey = history.joinedTables[tableId].sourceKey;
        const sourceKeyIndex = history.resourceStats.schema.fields.findIndex(
          (f) => f.name === sourceKey
        );
        const targetKeyIndex = history.joinedTables[
          tableId
        ].targetResourceStats.schema.fields.findIndex(
          (f) => f.name === history.joinedTables[tableId].targetKey
        );
        const inferedStats = history.joinedTables[tableId].targetResourceStats;
        const duckDBResults = await DuckDB.getOriginalRowIdsForJoinedTable(
          mainTableId,
          tableId,
          sourceKeyIndex,
          targetKeyIndex,
          columnIndex,
          rowId
        );
        return {
          table: history.joinedTables[tableId].targetResource,
          dataset: history.dataset,
          resourceStats: inferedStats,
          positions: duckDBResults.map((result) => {
            const rowId = result.rowId;
            const cellValue = result.value;
            const originalRowIndex = inferedStats.header + 1 + Number(rowId);
            const excelPosition =
              ExcelColumnName.intToExcelCol(columnIndex + 1) + originalRowIndex;
            return {
              columnIndex,
              originalRowIndex,
              excelPosition,
              rowId,
              value: cellValue,
            };
          }),
        };
      }
    },
    async cellClicked(row, column) {
      const value = row[column.key].value;
      if (value === null || value === UNFILLED_TEXT) {
        return;
      }
      this.$refs.workingTableProvenanceModal.showModal();
      await this.$nextTick();
      let result;
      try {
        result = await this.getOriginalIndexes(row, column);
        if (!result || result.length === 0) {
          return;
        }
      } catch (err) {
        return;
      }
      this.provenanceModalInformation.isLoading = false;
      this.provenanceModalInformation.positions = result.positions;
      this.provenanceModalInformation.table = result.table;
      this.provenanceModalInformation.dataset = result.dataset;
      this.provenanceModalInformation.resourceStats = result.resourceStats;
    },
    provenanceModalClosed() {
      this.provenanceModalInformation.isLoading = true;
      this.provenanceModalInformation.positions = [];
      this.provenanceModalInformation.table = null;
      this.provenanceModalInformation.dataset = null;
      this.provenanceModalInformation.resourceStats = null;
    },
    headerCellClicked(event, column) {
      // Ignore click on sort icon
      const eventTargetClassName = event.target.className;
      if (
        eventTargetClassName &&
        eventTargetClassName.includes("ve-table-sort")
      ) {
        return;
      }
      this.$refs.workingTableDescription.showColumnComposition(column);
    },
    async undoJoinLog(log) {
      const sourcesSet = new Set(log.sources.map((s) => s.id));
      const columnToDelete = this.columns.find((c) => c.title === log.column);
      // Cancel sorting if it is sorting on the column that is being deleted
      if (columnToDelete.key === this.sortConfig.key) {
        this.sortConfig = {
          key: null,
          order: null,
          isNumeric: false,
        };
      }
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
      let alertMessage;
      this.logs = this.logs.filter((l) => {
        if (l !== log) {
          return true;
        }
        alertMessage = `Removed column "${log.column}" from "${log.table.name}"`;
        return false;
      });
      this.showAlert(alertMessage);
      // Hack to forcefully trigger rerender
      this.$refs.workingTableDescription.$refs.joinableTables.updateFilteredResourcesHash();
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
      this.$refs.workingTableDescription.$refs.joinableTables.updateFilteredResourcesHash();
    },
    async jumpToFirstRow(i) {
      const h = this.histories[i];
      const componentIds = new Set([h.table.id]);
      if (h.joinedTables) {
        for (let id in h.joinedTables) {
          componentIds.add(id);
        }
      }
      this.focusedComponentIndex = null;
      this.sortConfig = {
        key: null,
        order: null,
        isNumeric: false,
      };
      this.$refs.workingTableDescription.$refs.joinableTables.updateFilteredResourcesHash();
      this.loadingPromise = this.reloadData(true);
      await this.loadingPromise;
      this.loadingPromise = DuckDB.getWorkingTableFirstRowOffset(componentIds);
      const offset = await this.loadingPromise;
      if (offset === null) {
        this.loadingPromise = null;
        return;
      }
      let pageIndex = Math.ceil(offset / this.pageSize);
      if (pageIndex === 0) {
        pageIndex = 1;
      }
      const indexOnPage = offset % this.pageSize;
      this.pageIndex = pageIndex;
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      this.loadingPromise = null;
      const rowOnPage = this.tableData[indexOnPage];
      if (rowOnPage && rowOnPage.column_0) {
        this.$refs.table.setHighlightRow({
          rowKey: rowOnPage.rowKey,
        });
      }
    },
    showAlert(message) {
      this.alertMessage = message;
      this.dismissCountDown = DEFAULT_COUNT_DOWN;
    },
    countDownChanged(dismissCountDown) {
      this.dismissCountDown = dismissCountDown;
    },
    getColumnDescription: function (name, delimiter = "<br/>") {
      return Common.getColumnDescription(this.dataDictionary, name, delimiter);
    },
    handleDuckDBError(err) {
      this.isPaginationLoading = false;
      this.loadingPromise = null;
      this.duckDBErrorMessage = err.message;
      this.$refs.duckdbErrorModal.show();
      this.resetTable();
      throw err;
    },
    globalColumnFillingSuggestionEnabledChanged(enabled) {
      this.globalColumnFillingSuggestionEnabled = enabled;
    },
    provenanceModalEnabledChanged(enabled) {
      this.provenanceModalEnabled = enabled;
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
div.working-table-alert-container {
  > div.alert.alert-primary {
    margin-bottom: 0;
    padding: 8px;
  }
}
.table-tooltip {
  position: absolute;
}
.duckdb-error-message {
  color: red;
}
.working-table-cell-pointer {
  cursor: pointer;
}
</style>
