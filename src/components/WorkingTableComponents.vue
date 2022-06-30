<template>
  <div class="working-table-components-container">
    <table ref="blocksTable">
      <tr v-for="(row, i) in blockMapping" :key="i">
        <th
          v-for="(cell, j) in row"
          :key="j"
          :style="{ 'background-color': getBlockColor(cell) }"
        ></th>
      </tr>
    </table>
  </div>
</template>

<script>
import TableColorManger from "../TableColorManager";

export default {
  name: "WorkingTableComponents",
  data() {
    return {
      displayWidth: null,
    };
  },
  props: {
    histories: {
      type: Array,
      required: false,
    },
    selectedColumns: {
      type: Array,
      required: false,
    },
    columns: {
      type: Array,
      required: false,
    },
  },
  watch: {},
  computed: {
    blockMapping() {
      if (!this.histories || !this.selectedColumns || !this.columns) {
        return [];
      }
      const blocks = [];
      // Filter on columns to maintain the order of the list
      const selectedColumns = this.columns
        .filter((column) => this.selectedColumns.includes(column.title))
        .map((c) => c.title);
      for (let i = 0; i < this.histories.length; ++i) {
        blocks[i] = [];
        const columnNameToTableMap = {};
        const h = this.histories[i];
        if (h.joinedTables) {
          for (const uuid in h.joinedTables) {
            h.joinedTables[uuid].columns.forEach((c) => {
              columnNameToTableMap[c] = uuid;
            });
          }
        }
        h.resourceStats.schema.fields.forEach((f) => {
          columnNameToTableMap[f.name] = h.resourceStats.uuid;
        });
        for (let j = 0; j < selectedColumns.length; ++j) {
          const c = selectedColumns[j];
          blocks[i].push(
            columnNameToTableMap[c] ? columnNameToTableMap[c] : null
          );
        }
      }
      return blocks;
    },
  },
  methods: {
    getBlockColor(uuid) {
      return uuid ? TableColorManger.getColor(uuid) : "#ffffff";
    },
    getTableDisplayWidth() {
      return this.$refs.blocksTable.clientWidth;
    },
  },
  async mounted() {
    this.$nextTick(() => {
      this.displayWidth = this.getTableDisplayWidth();
    });
  },
  destroyed() {},
};
</script>

<style lang="scss" scoped>
.working-table-components-container {
  table {
    width: 100%;
    tr {
      height: 40px;
    }
  }
}
</style>
