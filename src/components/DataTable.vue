<template>
  <div class="data-table-outer-container">
    <data-table-description
      :dataset="dataset"
      :resourceStats="resourceStats"
      :resource="resource"
      :keywords="keywords"
      :selectedFields="selectedFields"
    />
    <div class="data-table-inner-container" ref="tableContainer">
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
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :columns="visiableColumns ? visiableColumns : columns"
        :table-data="tableData"
        row-key-field-name="rowKey"
        :cell-style-option="cellStyleOption"
        ref="table"
      />
    </div>
  </div>
</template>

<script>
import axios from "axios";
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
      visiableColumns: [],
      tableData: [],
      keywords: [],
      inferredstats: null,
      loadingPromise: null,
      selectedFields: [],
      cellStyleOption: {},
      viewId: null,
      dataviewRefreshDelay: null,
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
            this.$nextTick(() => {
              this.loadDataForCurrentPage();
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
  computed: {},
  methods: {
    async joinTable(metadata) {
      try {
        console.log(metadata);
        console.time("Load target table");
        const sourceColumnName = metadata.source.column.inferred_schema.name;
        const targetId = metadata.target.uuid;
        const targetColumnName = metadata.target.column.inferred_schema.name;
        await DuckDB.loadParquet(targetId);
        const joinViewResult = await DuckDB.createJoinedView(
          this.tableId,
          sourceColumnName,
          targetId,
          targetColumnName
        );
        this.viewId = joinViewResult.viewName;
        this.totalCount = joinViewResult.totalCount;
        this.pageIndex = 1;

        await this.loadDataForCurrentPage();
      } catch (err) {
        alert("Cannot perform the join", err);
      }
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
        this.columns.push({
          field: String(i),
          key: String(i),
          title: f.name,
          width: 300,
          ellipsis: {
            showTitle: true,
          },
        });
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
      console.time("DuckDB Load");
      const totalCount = await DuckDB.loadParquet(this.tableId);
      console.timeEnd("DuckDB Load");
      this.totalCount = totalCount;
      await this.createDataView();
      this.loadingPromise = this.loadDataForCurrentPage();
      await this.loadingPromise;
    },
    async createDataView() {
      if (this.keywords.length > 0 || this.selectedFields.length > 0) {
        const viewResult = await DuckDB.createDataTableView(
          this.tableId,
          this.keywords,
          this.selectedFields
        );
        this.viewId = viewResult.viewName;
        this.totalCount = viewResult.totalCount;
        this.visiableColumns = this.columns.filter(
          (_, i) => this.selectedFields.indexOf(i) >= 0
        );
      } else {
        this.viewId = "";
      }
    },
    refreshDataView() {
      clearTimeout(this.dataviewRefreshDelay);
      this.dataviewRefreshDelay = setTimeout(async () => {
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
      }, 300);
    },
    async loadDataForCurrentPage() {
      this.tableData.splice(0);
      const tableId = this.viewId ? this.viewId : this.tableId;
      console.time(`DuckDB Query ${tableId}`);
      const arrowTable = await DuckDB.getFullTable(
        tableId,
        this.pageIndex,
        this.pageSize
      );
      console.timeEnd(`DuckDB Query ${tableId}`);

      console.time(`Post-process ${tableId}`);
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: r.row ? r.row[0] : i };
        const rowObject = r.toJSON();
        console.log(rowObject);
        for (let j = 0; j < this.columns.length; ++j) {
          let fieldName, rawValue;
          try {
            const field = this.columns[j];
            fieldName = field.field;
            rawValue = rowObject[j];
          } catch (err) {
            continue;
          }
          rowDict[fieldName] = rawValue;
        }
        this.tableData.push(rowDict);
      });
      console.timeEnd(`Post-process ${tableId}`);
      this.loadingPromise = null;
    },

    addSelectedField(fieldIndex) {
      this.selectedFields.push(fieldIndex);
      this.refreshDataView();
    },
    removeSelectedField(fieldIndex) {
      this.selectedFields.splice(this.selectedFields.indexOf(fieldIndex), 1);
      this.refreshDataView();
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
  flex-direction: row;
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
