<template>
  <div class="working-table-description-container">
    <div v-show="!relatedTablesMetadata">
      <div>
        <table-filters
          :keywords="keywords"
          @filter-keywords-removed="removeKeyword"
          @filter-keywords-added="addNewKeyword"
        />
      </div>
      <hr />
      <div>
        <h5>Actions</h5>
        <b-button size="sm" @click="resetTable()">Reset Working Table</b-button>
        &nbsp;
        <b-button size="sm" @click="toggleColor()"
          >Toggle Color By Table</b-button
        >
        &nbsp;
        <b-button size="sm" @click="dumpCsv()">Dump as CSV</b-button>
      </div>
      <hr />
      <h5>Components</h5>
      <b-list-group>
        <b-list-group-item v-for="(h, i) in histories" :key="i">
          <div class="d-flex w-100 justify-content-between">
            <span>
              <div
                class="inline-color-block"
                :style="{ 'background-color': h.table.color }"
              ></div>
              &nbsp;
              {{ h.table.name }}</span
            >
            <span class="history-buttons-span">
              <b-button
                size="sm"
                variant="primary"
                @click="showRelatedTables(h)"
                >Foreign Columns</b-button
              >
              &nbsp;
              <b-button size="sm" variant="danger" @click="removeTable(h)"
                ><b-icon icon="trash"></b-icon
              ></b-button>
            </span>
          </div>
          <div v-if="h.joinedTables">
            <div v-for="(j, k) in h.joinedTables" :key="k">
            <small >
              <div
                class="inline-color-block"
                :style="{ 'background-color': j.targerResource.color }"
              ></div>
              &nbsp;
              Joined Table: {{ j.targerResource.name }}
            </small>
            </div>
          </div>
        </b-list-group-item>
      </b-list-group>
      <hr />
      <h5>Columns</h5>
      <a href="#" @click="isColumnDetailsVisible = !isColumnDetailsVisible"
        >[{{ isColumnDetailsVisible ? "Hide" : "Show" }}]</a
      >
      <p></p>
      <div
        class="schema-fields-table-container"
        v-show="isColumnDetailsVisible"
      >
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
      <hr />
      <unionable-tables :resourceIds="allTableIds" :showUnionButton="true" />
    </div>
    <div v-if="!!relatedTablesMetadata">
      <b-button size="sm" @click="hideRelatedTables()">
        <b-icon icon="chevron-left"></b-icon>
        Back
      </b-button>
      <p></p>
      <h5>
        Columns from Other Tables for:
        <div
          class="inline-color-block"
          :style="{ 'background-color': relatedTablesMetadata.table.color }"
        ></div>
        {{ relatedTablesMetadata.table.name }}
      </h5>
      <hr />
      <joinable-tables
        :resourceId="relatedTablesMetadata.table.id"
        :history="relatedTablesMetadata"
        :sourceResourceStats="relatedTablesMetadata.resourceStats"
        :showJoinButton="true"
      />
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
    keywords: Array,
  },
  data: function () {
    return {
      isHistoriesShown: true,
      isColumnDetailsVisible: false,
      schemaFields: [
        { key: "selected", label: "✓" },
        { key: "title", label: "Column" },
      ],
      relatedTablesMetadata: null,
    };
  },
  mounted: function () {},
  computed: {
    allTableIds: function () {
      return this.histories.map((h) => h.table.id);
    },
  },

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
      const columnSet = new Set(this.selectedColumns);
      const rowsToSelect = this.columns
        .map((c, i) => {
          return {
            key: c.key,
            index: i,
          };
        })
        .filter((c) => columnSet.has(c.key));
      rowsToSelect.forEach((r) => {
        this.$refs.schemaFieldsTable.selectRow(r.index);
      });
    },
    schemaFieldsTableRowClicked: function (row, idx) {
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$parent.removeSelectedColumn(row.field);
      } else {
        this.$parent.addSelectedColumn(row.field);
      }
    },
    showRelatedTables: function (h) {
      this.$parent.focusOnTable(h.table.id);
      this.relatedTablesMetadata = h;
    },
    hideRelatedTables: function () {
      this.relatedTablesMetadata = null;
      window.setTimeout(() => {
        this.$parent.unfocusOnTable();
      });
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
    dumpCsv: function () {
      this.$parent.dumpCsv();
    },
    removeKeyword: function (keyword) {
      this.$parent.removeKeyword(keyword);
    },
    addNewKeyword: function (keyword) {
      this.$parent.addNewKeyword(keyword);
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
.history-buttons-span {
  min-width: 175px;
  margin-left: 4px;
}
.btn.btn-danger {
  svg {
    fill: var(--bs-white);
  }
}
</style>
