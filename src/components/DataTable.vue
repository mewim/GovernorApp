<template>
  <div class="data-table-outer-container">
    <data-table-description
      :dataset="dataset"
      :resourceStats="resourceStats"
      :resource="resource"
      :searchMetadata="searchMetadata"
    />
    <div class="data-table-inner-container" ref="tableContainer">
      <div class="table-pagination">
        <ve-pagination
          :total="totalCount"
          :page-size-option="[10, 25, 50, 100, 200, 500, 1000]"
          :page-index="pageIndex"
          :page-size="pageSize"
          @on-page-number-change="pageNumberChange"
          @on-page-size-change="pageSizeChange"
        />
      </div>
      <ve-table
        :max-height="height"
        :virtual-scroll-option="virtualScrollOption"
        :columns="columns"
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
      tableData: [],
      inferredstats: null,
      columnHiddenOption: {
        defaultHiddenColumnKeys: [],
      },
      isLoading: true,
      matchedDict: {},
      selectedFields: [],
      showAllRows: true,
      cellStyleOption: {
        bodyCellClass: ({ row, column }) => {
          if (
            this.matchedDict[row.rowKey] &&
            this.matchedDict[row.rowKey][column.field]
          ) {
            return "table-body-cell-highlighted";
          }
        },
      },
      joinedTableId: null,
    };
  },
  props: {
    height: Number,
    resource: Object,
    dataset: Object,
    resourceStats: Object,
    tableId: String,
    searchMetadata: Boolean,
  },
  watch: {
    resource: {
      immediate: true,
      handler: function () {
        this.reloadData();
      },
    },
    selectedFields: {
      handler: function () {
        this.filterColumns();
      },
    },
    showAllRows: {
      handler: function () {
        this.reloadData();
      },
    },
  },
  computed: {
    shouldShowAllRows: function () {
      return this.showAllRows || this.searchMetadata;
    },
  },
  methods: {
    async joinTable(metadata) {
      this.loadingInstance.show();
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
        this.joinedTableId = joinViewResult.viewName;
        this.totalCount = joinViewResult.totalCount;
        this.pageIndex = 1;
        await this.loadDataForCurrentPage();
      } catch (err) {
        alert("Cannot perform the join", err);
      }
      this.loadingInstance.close();
    },
    pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
      this.loadDataForCurrentPage();
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.loadDataForCurrentPage();
    },
    setSelectedFields: function (newValue) {
      this.selectedFields = newValue;
    },
    setShowAllRows: function (newValue) {
      this.showAllRows = newValue;
    },
    filterColumns() {},
    async reloadData() {
      this.isLoading = true;
      if (this.loadingInstance) {
        this.loadingInstance.show();
      }
      this.columns.splice(0);
      this.matchedDict = {};
      if (!this.tableId) {
        return;
      }
      this.inferredstats = {};

      this.inferredstats = await axios
        .get(`/api/inferredstats/${this.tableId}`)
        .then((res) => res.data);
      this.inferredstats.schema.fields.forEach((f, i) => {
        this.columns.push({
          field: f.name,
          key: String(i),
          title: f.name,
          width: 300,
          ellipsis: {
            showTitle: true,
          },
        });
      });
      this.filterColumns();

      this.matchedDict = {};

      // if (!this.shouldShowAllRows) {
      //   this.uniqueRowNumbers = [
      //     ...new Set(this.resource.matches.matches.map((m) => m.row_number)),
      //   ];
      // }
      // this.resource.matches.matches.forEach((m) => {
      //   const i = m.row_number;
      //   if (!this.matchedDict[i]) {
      //     this.matchedDict[i] = {};
      //   }
      //   this.matchedDict[i][m.field_name] = true;
      // });
      console.time("DuckDB Load");
      const totalCount = await DuckDB.loadParquet(this.tableId);
      console.timeEnd("DuckDB Load");
      this.totalCount = this.shouldShowAllRows
        ? totalCount
        : this.uniqueRowNumbers.length;
      await this.loadDataForCurrentPage();
      this.loadingInstance.close();
      this.isLoading = false;
    },
    async loadDataForCurrentPage() {
      this.tableData.splice(0);
      this.columns.splice(0);

      console.time("DuckDB Query");
      const tableId = this.joinedTableId ? this.joinedTableId : this.tableId;
      const arrowTable = await (this.shouldShowAllRows
        ? DuckDB.getFullTable(tableId, this.pageIndex, this.pageSize)
        : DuckDB.getTableByRowNumbers(
            tableId,
            this.uniqueRowNumbers,
            this.pageIndex,
            this.pageSize
          ));
      arrowTable.schema.fields.forEach((f, i) => {
        this.columns.push({
          field: f.name,
          key: String(i),
          title: f.name,
          width: 300,
          ellipsis: {
            showTitle: true,
          },
        });
      });
      console.log(arrowTable);
      console.timeEnd("DuckDB Query");

      console.time("Post-process");
      arrowTable.toArray().forEach((r, i) => {
        const rowDict = { rowKey: r.row ? r.row[0] : i };
        for (let j = 0; j < this.columns.length; ++j) {
          let fieldName, rawValue;
          try {
            const field = this.columns[j];
            fieldName = field.field;
            rawValue = r[j];
          } catch (err) {
            continue;
          }
          rowDict[fieldName] = rawValue;
        }
        this.tableData.push(rowDict);
      });
      console.timeEnd("Post-process");
    },
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$refs.tableContainer,
      name: "wave",
    });
    if (this.isLoading) {
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
