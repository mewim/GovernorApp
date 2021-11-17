<template>
  <ve-table
    :max-height="height"
    :virtual-scroll-option="virtualScrollOption"
    :columns="columns"
    :table-data="tableData"
    row-key-field-name="rowKey"
  />
</template>

<script>
import axios from "axios";
import csvtojson from "csvtojson";

export default {
  data() {
    return {
      virtualScrollOption: {
        enable: true,
      },
      columns: [],
      tableData: [],
      inferredstats: null,
    };
  },
  props: {
    tableId: String,
    height: Number,
  },
  watch: {
    // whenever question changes, this function will run
    tableId: {
      immediate: true,
      handler: function (newTableId) {
        console.log(newTableId);
        this.reloadData();
      },
    },
  },
  methods: {
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
          width: 100,
        });
      });
      const csvString = await axios
        .get(`/api/csv/${this.tableId}`)
        .then((res) => res.data);
      const csvRows = await csvtojson({
        noheader: true,
        output: "csv",
      }).fromString(csvString);
      csvRows.forEach((r, i) => {
        if (i === this.inferredstats.header) {
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
