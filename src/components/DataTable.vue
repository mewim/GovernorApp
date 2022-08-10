<template>
  <div class="data-table-outer-container">
    <data-table-description
      :dataset="dataset"
      :resourceStats="resourceStats"
      :resource="resource"
      :keywords="keywords"
      :selectedFields="selectedFields"
      :dataDictionary="dataDictionary"
      :settings="settings"
      :unionedTableFields="unionedTableFields"
    />
    <div class="data-table-inner-container" ref="tableContainer">
      <div class="table-pagination">
        <div v-if="isLoading">
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
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :columns="visibleColumns ? visibleColumns : columns"
        :event-custom-option="eventCustomOption"
        :table-data="tableData"
        row-key-field-name="rowKey"
        :cell-style-option="cellStyleOption"
        :sort-option="sortOption"
        ref="table"
      />
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
      @ok="handleDuckdbErrorModalOk"
    >
      <p>
        Sorry, the operation failed due to an error. The current table will be
        closed automatically.
      </p>
      <p class="duckdb-error-message">
        Error message: {{ duckDBErrorMessage }}
      </p>
    </b-modal>
  </div>
</template>

<script>
import axios from "axios";
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";
import { createPopper } from "@popperjs/core";
import TableColorManager from "../TableColorManager";
import Common from "../Common";

const FIRST_TABLE_NAME = "T1";
const NULL_TEXT = "NULL";
const ROW_ID = "__row_id";

export default {
  data() {
    const IS_ELLIPSIS_ENABLED = true;
    return {
      pageIndex: 1,
      pageSize: 25,
      totalCount: 0,
      virtualScrollOption: {
        enable: true,
      },
      isColorEnabled: false,
      isLoading: false,
      isInitialLoading: true,
      visibleColumns: [],
      tableData: [],
      keywords: [],
      inferredstats: null,
      loadingPromise: null,
      selectedFields: [],
      cellStyleOption: {},
      viewId: null,
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
        bodyCellEvents: IS_ELLIPSIS_ENABLED
          ? ({ row, column }) => {
              return {
                mouseenter: (event) => {
                  this.mouseEnterCell(event, row, column);
                },
                mouseleave: () => {
                  this.mouseLeaveCell();
                },
              };
            }
          : undefined,
        headerCellEvents: ({ column }) => {
          return {
            mouseenter: (event) => {
              this.mouseEnterHeader(event, column);
            },
            mouseleave: () => {
              this.mouseLeaveCell();
            },
          };
        },
      },
      tooltipVisible: false,
      tooltipText: "",
      dataDictionary: null,
      duckDBErrorMessage: "",
    };
  },
  props: {
    height: Number,
    resource: Object,
    dataset: Object,
    resourceStats: Object,
    unionedTableFields: Array,
    tableId: String,
    keyword: String,
    selectedCell: Object,
    isActive: Boolean,
    settings: {
      type: Object,
      required: true,
    },
  },
  watch: {
    resource: {
      immediate: true,
      handler: function () {
        this.loadingPromise = this.reloadData();
      },
    },
    keyword: {
      immediate: true,
      handler: function (newValue) {
        if (!newValue) {
          return;
        }
        if (this.keywords.indexOf(newValue) === -1) {
          this.keywords.push(newValue);
          if (!this.isInitialLoading) {
            this.reloadData();
          }
        }
      },
    },
    selectedCell: {
      immediate: true,
      handler: async function (newValue) {
        if (this.isInitialLoading) {
          return;
        }
        this.loadingPromise = this.jumpToCell(newValue);
        await this.loadingPromise;
        this.loadingPromise = null;
      },
    },
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
    "settings.filterLogic": {
      handler: function () {
        this.refreshDataView();
      },
    },
  },
  computed: {
    columns: function () {
      const results = [];
      if (!this.inferredstats) {
        return results;
      }
      this.inferredstats.schema.fields.forEach((f, i) => {
        const key = `${FIRST_TABLE_NAME}-${i}`;
        results.push({
          field: key,
          key: key,
          title: f.name,
          width: 300,
          align: "left",
          ellipsis: this.isEllipsisEnabled
            ? {
                showTitle: false,
              }
            : undefined,
          sortBy:
            parseInt(this.sortConfig.key) === i ? this.sortConfig.order : "",
        });
      });

      results.forEach((r) => {
        r.renderBodyCell = ({ row, column }, h) => {
          const style = {};
          const text = row[column.field].value;

          if (this.isColorEnabled) {
            const color = text
              ? this.resource.color
              : TableColorManager.nullColor;
            style.color = color;
          }
          if (row[column.field].isHighlighted) {
            style.fontWeight = "bold";
          }
          return h("span", { style }, text ? text : NULL_TEXT);
        };
      });
      return results;
    },
  },
  methods: {
    forceRerender() {
      this.$nextTick(() => {
        // Hack to trigger rerender when the view is changed
        const backup = this.tableData.slice();
        this.tableData.splice(0);
        backup.forEach((b) => this.tableData.push(b));
      });
    },
    toggleColor() {
      this.isColorEnabled = !this.isColorEnabled;
      this.forceRerender();
    },
    addNewKeyword(newKeyWordText) {
      this.keywords.push(newKeyWordText);
      this.refreshDataView();
    },
    removeKeyword(i) {
      this.keywords.splice(i, 1);
      this.refreshDataView();
    },
    pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
      this.loadingPromise = this.loadDataForCurrentPage();
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.loadingPromise = this.loadDataForCurrentPage();
    },
    async reloadData() {
      this.isLoading = true;
      this.columns.splice(0);
      this.selectedFields.splice(0);
      if (!this.tableId) {
        return;
      }
      this.inferredstats = {};
      this.inferredstats = await axios
        .get(`/api/inferredstats/${this.tableId}`)
        .then((res) => res.data);
      if (this.isInitialLoading && !this.keyword) {
        let topColumnIndexes;
        await axios
          .get(`/api/inferredcolumnstats/${this.tableId}/topuniquecolumns`)
          .then((res) => {
            topColumnIndexes = new Set(res.data);
          })
          .catch(() => {
            topColumnIndexes = new Set();
          });
        this.inferredstats.schema.fields.forEach((_, i) => {
          if (topColumnIndexes && topColumnIndexes.has(i)) {
            this.selectedFields.push(i);
          }
        });
      }
      this.dataDictionary = await axios
        .get(`api/datadictionaries/${this.tableId}`, {})
        .then((res) => res.data)
        .catch(() => {});
      console.time("DuckDB Load");
      try {
        await DuckDB.loadParquet(this.tableId);
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
      console.timeEnd("DuckDB Load");
      await this.createDataView();
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      await this.reloadCount();
      if (this.isInitialLoading && this.selectedCell) {
        this.loadingPromise = this.jumpToCell(this.selectedCell);
        await this.loadingPromise;
        this.loadingPromise = null;
      }
      this.isLoading = false;
      this.isInitialLoading = false;
    },
    async createDataView() {
      let viewResult;
      const keywords =
        this.settings.filterLogic === "and"
          ? this.keywords.length > 0
            ? [this.keywords.join(" ")]
            : []
          : this.keywords;
      try {
        viewResult = await DuckDB.createDataTableView(
          this.tableId,
          keywords,
          null,
          this.sortConfig.key && this.sortConfig.order ? this.sortConfig : null
        );
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
      this.viewId = viewResult;
      this.totalCount = 0;
    },
    filterColumns() {
      this.visibleColumns = this.columns.filter((column) => {
        const split = column.key.split("-");
        const i = parseInt(split[1]);
        return this.selectedFields.indexOf(i) >= 0;
      });
    },
    async sortChange(params) {
      let key, order;
      for (let k in params) {
        if (params[k]) {
          key = k;
          order = params[k];
          break;
        }
      }
      this.sortConfig = {
        key: null,
        order: null,
        isNumeric: false,
      };
      this.columns.forEach((c, i) => {
        if (key === c.key) {
          this.sortConfig.key = String(i);
          this.sortConfig.order = order;
          this.sortConfig.isNumeric = new Set(["integer", "number"]).has(
            this.resourceStats.schema.fields[i].type
          );
        }
      });
      this.refreshDataView();
    },
    async refreshDataView() {
      this.isLoading = true;
      if (this.loadingPromise) {
        await this.loadingPromise;
      }
      this.loadingPromise = this.createDataView();
      await this.loadingPromise;
      if ((this.pageIndex - 1) * this.pageSize > this.totalCount) {
        this.pageIndex = 1;
      }
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      this.isLoading = true;
      await this.reloadCount();
      this.isLoading = false;
    },
    async reloadCount() {
      if (this.pageIndex === 1 && this.tableData.length < this.pageSize) {
        this.totalCount = this.tableData.length;
      } else {
        try {
          this.totalCount = await DuckDB.getTotalCount(this.viewId);
        } catch (err) {
          this.handleDuckDBError(err);
          return;
        }
      }
    },
    async loadDataForCurrentPage() {
      const keywords = this.keywords
        .map((k) => k.toLowerCase().split(" "))
        .flat();
      this.tableData.splice(0);
      const tableId = this.viewId;
      console.time(`DuckDB Query ${tableId}`);
      let arrowTable;
      try {
        arrowTable = await DuckDB.getFullTable(
          tableId,
          this.pageIndex,
          this.pageSize
        );
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
      console.timeEnd(`DuckDB Query ${tableId}`);
      console.time(`Post-process ${tableId}`);
      const columnsToEnable = new Set();
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: i };
        const rowObject = r.toJSON();
        Object.keys(rowObject).forEach((k) => {
          rowDict[k] = { value: rowObject[k] };
          if (k !== ROW_ID) {
            keywords.forEach((kw) => {
              if (rowDict[k].value.toLowerCase().includes(kw)) {
                columnsToEnable.add(k);
                rowDict[k].isHighlighted = true;
              }
            });
          }
        });
        this.tableData.push(rowDict);
      });
      const selectedFields = new Set(this.selectedFields);
      this.columns.forEach((c, i) => {
        if (columnsToEnable.has(c.key)) {
          selectedFields.add(i);
        }
      });
      this.selectedFields = Array.from(selectedFields);
      this.filterColumns();
      console.timeEnd(`Post-process ${tableId}`);
      this.loadingPromise = null;
    },
    addSelectedField(item) {
      this.selectedFields.push(item.index);
      this.filterColumns();
    },
    removeSelectedField(item) {
      this.selectedFields.splice(this.selectedFields.indexOf(item.index), 1);
      this.filterColumns();
    },
    async addToWorkingTable() {
      this.$parent.$refs.workingTable.addData(
        {
          table: this.resource,
          dataset: this.dataset,
          resourceStats: this.resourceStats,
        },
        this.visibleColumns.map((c) => c.title)
      );
    },
    async dumpCsv() {
      this.loadingPromise = DuckDB.dumpCsv(
        this.viewId ? this.viewId : this.tableId,
        this.visibleColumns.map((c) => c.title),
        this.visibleColumns.map((c) => c.key),
        this.resource.name
      );
      try {
        await this.loadingPromise;
        this.loadingPromise = null;
      } catch (err) {
        this.handleDuckDBError(err);
        return;
      }
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
    getColumnDescription: function (name, delimiter = "<br/>") {
      return Common.getColumnDescription(this.dataDictionary, name, delimiter);
    },
    async jumpToCell(cellPosition) {
      let offset = await DuckDB.getDataTableRowIdOffset(
        this.viewId,
        cellPosition.rowId
      );
      if (Number.isNaN(parseInt(offset))) {
        // If row is not found, it might be filtered out, so we clear filter
        // and try again
        this.keywords = [];
        await this.createDataView();
        this.totalCount = await DuckDB.getTotalCount(this.viewId);
        offset = await DuckDB.getDataTableRowIdOffset(
          this.viewId,
          cellPosition.rowId
        );
        // If still not found, we cannot jump to the cell
        if (Number.isNaN(parseInt(offset))) {
          this.forceRerender();
          return;
        }
      }
      let pageIndex = Math.floor(offset / this.pageSize) + 1;
      if (pageIndex === 0) {
        pageIndex = 1;
      }
      const indexOnPage = offset % this.pageSize;
      this.pageIndex = pageIndex;
      if (this.selectedFields.indexOf(cellPosition.columnIndex) === -1) {
        this.selectedFields.push(cellPosition.columnIndex);
      }
      await this.loadDataForCurrentPage();
      this.$refs.table.setHighlightRow({
        rowKey: indexOnPage,
      });
      this.$refs.table.setCellSelection({
        rowKey: indexOnPage,
        colKey: this.columns[cellPosition.columnIndex].key,
      });
    },
    handleDuckDBError(err) {
      this.isLoading = false;
      this.loadingPromise = null;
      this.duckDBErrorMessage = err.message;
      this.$refs.duckdbErrorModal.show();
    },
    handleDuckdbErrorModalOk() {
      this.$refs.duckdbErrorModal.hide();
      this.$parent.closeResource(this.tableId);
    },
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$refs.tableContainer,
      name: "wave",
    });
    if (this.loadingPromise) {
      this.loadingInstance.show();
    }
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
.data-table-outer-container {
  height: 100%;
  display: flex;
  flex-direction: row-reverse;
  .data-table-inner-container {
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
