<template>
  <div style="height: 100%">
    <ve-table
      :max-height="height"
      :virtual-scroll-option="virtualScrollOption"
      :columns="columns"
      :table-data="tableData"
      row-key-field-name="rowKey"
      :columnHiddenOption="columnHiddenOption"
      :cell-style-option="cellStyleOption"
      ref="table"
    />
  </div>
</template>

<script>
import axios from "axios";
import csvtojson from "csvtojson";
import { VeLoading } from "vue-easytable";

export default {
  data() {
    return {
      virtualScrollOption: {
        enable: true,
      },
      columns: [],
      tableData: [],
      inferredstats: null,
      columnHiddenOption: {
        defaultHiddenColumnKeys: [],
      },
      isLoading: true,
      matchedDict: {},
      cellStyleOption: {
        bodyCellClass: ({row, column }) => {
          if (
            this.matchedDict[row.rowKey] &&
            this.matchedDict[row.rowKey][column.field]
          ) {
            return "table-body-cell-highlighted";
          }
        },
      },
    };
  },
  props: {
    height: Number,
    selectedFields: Array,
    showAllRows: Boolean,
    resource: Object,
    tableId: String,
  },
  watch: {
    // whenever question changes, this function will run
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
  methods: {
    filterColumns() {
      const selectedFieldsSet = new Set(this.selectedFields);
      const keysHidden = [];
      const keysShown = [];
      for (let c of this.columns) {
        if (selectedFieldsSet.has(c.field)) {
          keysShown.push(c.key);
        } else {
          keysHidden.push(c.key);
        }
      }
      this.$refs.table.showColumnsByKeys(keysShown);
      this.$refs.table.hideColumnsByKeys(keysHidden);
    },
    async reloadData() {
      this.isLoading = true;
      this.columns.splice(0);
      this.tableData.splice(0);
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
          // ellipsis: {
          //   showTitle: true,
          // },
        });
      });
      this.filterColumns();

      this.matchedDict = {};
      const rowToIndexDict = {};

      let body;
      if (!this.showAllRows) {
        const uniqueRowNumbers = [
          ...new Set(this.resource.matches.matches.map((m) => m.row_number)),
        ];
        uniqueRowNumbers.sort((a, b) => {
          return a - b;
        });
        body = { rows: uniqueRowNumbers };
        uniqueRowNumbers.forEach((r, i) => {
          rowToIndexDict[r] = i;
        });
      }
      this.resource.matches.matches.forEach((m) => {
        const i = this.showAllRows
          ? m.row_number - 1 // header is hidden, -1 offset
          : rowToIndexDict[m.row_number];
        if (!this.matchedDict[i]) {
          this.matchedDict[i] = {};
        }
        this.matchedDict[i][m.field_name] = true;
      });
      const csvString = await axios
        .post(`/api/csv/${this.tableId}`, body)
        .then((res) => res.data);
      const csvRows = await csvtojson({
        noheader: true,
        output: "csv",
      }).fromString(csvString);
      csvRows.forEach((r, i) => {
        if (this.showAllRows && i === this.inferredstats.header) {
          return;
        }
        const rowDict = { rowKey: i };
        for (let j = 0; j < r.length; ++j) {
          let fieldName, rawValue;
          try {
            const field = this.inferredstats.schema.fields[j];
            fieldName = field.name;
            rawValue = r[j];
          } catch (err) {
            continue;
          }
          rowDict[fieldName] = rawValue;
        }
        this.tableData.push(rowDict);
      });
      this.isLoading = false;
      this.loadingInstance.close();
    },
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$el,
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

<style>
.table-body-cell-highlighted {
  color: #007bff !important;
}
</style>
