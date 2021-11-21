<template>
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
</template>

<script>
import axios from "axios";
import csvtojson from "csvtojson";

export default {
  data() {
    return {
      virtualScrollOption: {
        enable: false,
      },
      columns: [],
      tableData: [],
      inferredstats: null,
      columnHiddenOption: {
        defaultHiddenColumnKeys: [],
      },
      matchedDict: {},
      cellStyleOption: {
        bodyCellClass: ({ column, rowIndex }) => {
          if (
            this.matchedDict[rowIndex] &&
            this.matchedDict[rowIndex][column.field]
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
        this.tableId = this.resource.id;
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
          ? m.row_number
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
    },
  },
  created() {},
};
</script>

<style>
.table-body-cell-highlighted {
  color: #007bff !important;
}
</style>
