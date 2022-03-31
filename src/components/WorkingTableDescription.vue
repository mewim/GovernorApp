<template>
  <div class="working-table-description-container">
    <h5>Columns</h5>
    <a href="#" @click="isColumnDetailsVisible = !isColumnDetailsVisible"
      >[{{ isColumnDetailsVisible ? "Hide" : "Show" }}]</a
    >
    <p></p>
    <div class="schema-fields-table-container" v-show="isColumnDetailsVisible">
      <b-table
        ref="schemaFieldsTable"
        :items="columns"
        :fields="schemaFields"
        no-select-on-click
        selectable
        @row-clicked="schemaFieldsTableRowClicked"
      >
        <template #cell(selected)="{ rowSelected }">
          <template v-if="rowSelected">
            <span class="schema-table-span" aria-hidden="true">&check;</span>
          </template>
          <template v-else>
            <span class="schema-table-span" aria-hidden="true">&nbsp;</span>
          </template>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
export default {
  name: "WorkingTableDescription",

  props: {
    histories: Array,
    columns: Array,
    selectedColumns: Array,
  },
  data: function () {
    return {
      isHistoriesShown: true,
      isColumnDetailsVisible: false,
      schemaFields: [
        { key: "selected", label: "✓" },
        { key: "title", label: "Column" },
      ],
    };
  },
  mounted: function () {},
  computed: {},

  watch: {
    selectedColumns: {
      immediate: true,
      handler: function () {
        this.$nextTick(() => {
          try {
            this.syncSelectedColumns();
          } catch (err) {
            // Continue
          }
        });
      },
    },
  },
  methods: {
    syncSelectedColumns: function () {
      this.$refs.schemaFieldsTable.clearSelected();
      this.selectedColumns.forEach((c) => {
        this.$refs.schemaFieldsTable.selectRow(parseInt(c));
      });
    },
    schemaFieldsTableRowClicked: function (_, idx) {
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$parent.removeSelectedColumn(idx);
      } else {
        this.$parent.addSelectedColumn(idx);
      }
    },
  },
};
</script>

<style lang="scss">
.working-table-description-container {
  background-color: var(--bs-gray-100);
  flex-basis: 25%;
  padding: 10px;
  overflow-y: scroll;
}
</style>
