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
        :max-height="height"
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
// import DuckDB from "../DuckDB";

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
      loadingPromise: null,
      selectedFields: [],
      cellStyleOption: {},
      viewId: null,
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
          return;
        }
      },
    },
  },
  methods: {
    pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
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
