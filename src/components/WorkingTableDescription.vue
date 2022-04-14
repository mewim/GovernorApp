<template>
  <div class="working-table-description-container">
    <h5>History</h5>

    <b-list-group>
      <b-list-group-item v-for="(h, i) in histories" :key="i">
        <div class="d-flex w-100 justify-content-between">
          <span>
            <div
              class="inline-color-block"
              :style="{ 'background-color': h.baseTable.color }"
            ></div>
            &nbsp;
            {{ h.baseTable.name }}</span
          >
          <b-button size="sm" variant="danger" @click="removeTable(h)"
            >Remove</b-button
          >
        </div>
        <small
          >Filters: {{ h.filters.length > 0 ? h.filters.join(", ") : "(None)" }}
        </small>
        <br />
        <small v-if="h.joinedTable.resource"
          >Joined with:
          &nbsp;
          <div
            class="inline-color-block small"
            :style="{ 'background-color': h.joinedTable.resource.color }"
          ></div>
          &nbsp;{{ h.joinedTable.resource.name }}
        </small>
      </b-list-group-item>
    </b-list-group>
    <hr />
    <div>
      <h5>Actions</h5>
      <b-button size="sm" @click="resetTable()">Reset Working Table</b-button>
      &nbsp;
      <b-button size="sm" @click="toggleColor()"
        >Toggle Color By Table</b-button
      >
    </div>
    <hr />
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
    removeTable: function (h) {
      this.$parent.removeTable(h);
    },
    resetTable: function () {
      this.$parent.resetTable();
    },
    toggleColor: function () {
      this.$parent.toggleColor();
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
.inline-color-block {
  height: 12px;
  width: 12px;
  display: inline-block;
  &.small {
    height: 10px;
    width: 10px;
  }
}
</style>
