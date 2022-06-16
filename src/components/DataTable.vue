<template>
  <div class="data-table-outer-container">
    <data-table-description
      :dataset="dataset"
      :resourceStats="resourceStats"
      :resource="resource"
      :keywords="keywords"
      :selectedFields="selectedFields"
      :dataDictionary="dataDictionary"
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
  </div>
</template>

<script>
import axios from "axios";
import { VeLoading } from "vue-easytable";
import DuckDB from "../DuckDB";
import { createPopper } from "@popperjs/core";

const FIRST_TABLE_NAME = "T1";

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
    };
  },
  props: {
    height: Number,
    resource: Object,
    dataset: Object,
    resourceStats: Object,
    tableId: String,
    keyword: String,
    isActive: Boolean,
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
        this.keywords.splice(0, this.keywords.length);
        if (!newValue) {
          return;
        }
        this.keywords.push(newValue);
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
          if (this.isColorEnabled) {
            const color = this.resource.color;
            style.color = color;
          }
          const text = row[column.field];
          return h("span", { style }, text);
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
      this.inferredstats.schema.fields.forEach((f, i) => {
        if (!this.keyword) {
          this.selectedFields.push(i);
        } else {
          this.resource.matches.columns.forEach((c) => {
            if (c === f.name) {
              this.selectedFields.push(i);
            }
          });
        }
      });
      this.dataDictionary = await axios
        .get(`api/datadictionaries/${this.tableId}`, {})
        .then((res) => res.data)
        .catch(() => {});
      console.time("DuckDB Load");
      await DuckDB.loadParquet(this.tableId);
      console.timeEnd("DuckDB Load");
      await this.createDataView();
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
      await this.reloadCount();
      this.isLoading = false;
    },
    async createDataView() {
      const viewResult = await DuckDB.createDataTableView(
        this.tableId,
        this.keywords,
        null,
        this.sortConfig.key && this.sortConfig.order ? this.sortConfig : null
      );
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
        this.totalCount = await DuckDB.getTotalCount(this.viewId);
      }
    },
    async loadDataForCurrentPage() {
      const keywords = this.keywords
        .map((k) => k.toLowerCase().split(" "))
        .flat();
      this.tableData.splice(0);
      const tableId = this.viewId;
      console.time(`DuckDB Query ${tableId}`);
      const arrowTable = await DuckDB.getFullTable(
        tableId,
        this.pageIndex,
        this.pageSize
      );
      console.timeEnd(`DuckDB Query ${tableId}`);
      console.time(`Post-process ${tableId}`);
      const columnsToEnable = new Set();
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: i };
        const rowObject = r.toJSON();
        Object.keys(rowObject).forEach((k) => {
          rowDict[k] = rowObject[k];
          keywords.forEach((kw) => {
            if (rowDict[k].toLowerCase().includes(kw)) {
              columnsToEnable.add(k);
            }
          });
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
        this.visibleColumns.map((c) => c.key)
      );
      await this.loadingPromise;
      this.loadingPromise = null;
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

    mouseEnterHeader(event, column) {
      if (!this.dataDictionary) {
        return;
      }
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
      const NO_DESCRIPTION = "(No description available)";
      if (!this.dataDictionary.fields) {
        return NO_DESCRIPTION;
      }
      const field = this.dataDictionary.fields.find(
        (f) => f.field_name === name
      );
      if (!field) {
        return NO_DESCRIPTION;
      }
      const descriptionText = [];
      if (field.field_desc) {
        descriptionText.push(field.field_desc);
      }
      if (field.values && field.values.length > 0) {
        if (descriptionText.length > 0) {
          descriptionText.push("");
        }
        descriptionText.push("Possible values:");
        field.values.forEach((v) => {
          descriptionText.push(`- ${v.value_name}: ${v.value_desc}`);
        });
      }
      return descriptionText.join(delimiter);
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
