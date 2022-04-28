<template>
  <div class="dataset-description-container" v-if="!!dataset">
    <div>
      <data-table-details
        :dataset="dataset"
        :resource="resource"
        :joinedResource="joinedTable.resource"
      />
    </div>
    <hr />
    <div>
      <h5>Actions</h5>
      <b-button size="sm" @click="addToWorkingTable()"
        >Add to Working Table</b-button
      >
      &nbsp;
      <b-button size="sm" @click="toggleColor()"
        >Toggle Color By Table</b-button
      >
      &nbsp;
      <b-button size="sm" @click="dumpCsv()">Dump as CSV</b-button>
    </div>
    <hr />
    <div>
      <table-filters
        :keywords="keywords"
        @filter-keywords-removed="removeKeyword"
        @filter-keywords-added="addNewKeyword"
      />
    </div>
    <hr />
    <div>
      <p></p>
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
          :items="schemaFieldsTableItems"
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

          <template #cell(name)="row">
            <div
              class="inline-color-block"
              :style="{ 'background-color': row.item.color }"
            ></div>
            <span>&nbsp; {{ row.item.name }}</span>
          </template>

          <template #cell(stats)="row">
            <b-button variant="primary" size="sm" @click="showStats(row)">
              <b-icon icon="bar-chart-line-fill"></b-icon>
            </b-button>
          </template>
        </b-table>
      </div>
    </div>
    <hr />
    <div>
      <b-modal
        ref="columnStatsModal"
        title="Stats"
        ok-only
        static
        :hideHeaderClose="true"
        :centered="true"
        size="xl"
      >
        <column-stats ref="columnStats" />
      </b-modal>
    </div>
  </div>
</template>

<script>
export default {
  name: "DataTableDescription",
  mounted: function () {
    this.syncSelectedFields();
  },
  data: function () {
    return {
      schemaFields: [
        { key: "selected", label: "✓" },
        { key: "name", label: "Column" },
        { key: "type", label: "Type" },
        { key: "stats", label: "Stats" },
      ],
      joinableResults: [],
      isColumnDetailsVisible: false,
    };
  },
  computed: {
    fields: function () {
      return this.resourceStats.schema.fields.map((r, i) => {
        return {
          idx: i,
          name: r.name,
          type: r.type,
        };
      });
    },
    schemaFieldsTableItems: function () {
      const result = [];
      if (!this.resourceStats) {
        return result;
      }
      this.resourceStats.schema.fields.forEach((r, i) => {
        result.push({
          name: r.name,
          type: r.type,
          stats: r.stats,
          index: i,
          color: this.resource.color,
        });
      });
      if (!this.joinedTable.resourceStats) {
        return result;
      }
      this.joinedTable.resourceStats.schema.fields.forEach((r, i) => {
        // DuckDB cannot retrive the joined column on the target table, so skip
        if (i === this.joinedTable.targetIndex) {
          return;
        }
        result.push({
          name: r.name,
          type: r.type,
          stats: r.stats,
          index: i,
          isJoinedTable: true,
          color: this.joinedTable.resource.color,
        });
      });
      return result;
    },
    joinableResultsTableData: function () {
      return this.joinableResults.map((m) => {
        let sourceColumnName, targetColumnName;
        try {
          sourceColumnName = m.source.column.inferred_schema.name;
        } catch (err) {
          // continue anyway
          sourceColumnName = m.source.column.index;
        }
        try {
          targetColumnName = m.target.column.inferred_schema.name;
        } catch (err) {
          // continue anyway
          targetColumnName = m.target.column.index;
        }

        return {
          target_id: m.target.uuid,
          source_column: sourceColumnName,
          target_table: m.target.name,
          target_column: targetColumnName,
          score: m.score.toFixed(2),
          rawData: m,
        };
      });
    },
  },
  props: {
    dataset: Object,
    resourceStats: Object,
    resource: Object,
    keywords: Array,
    selectedFields: Array,
    joinedTable: Object,
  },
  watch: {
    selectedFields: {
      immediate: true,
      handler: function () {
        try {
          this.syncSelectedFields();
        } catch (err) {
          // Continue
        }
      },
    },
    "joinedTable.selectedFields": {
      handler: function () {
        try {
          this.syncSelectedFields();
        } catch (err) {
          // Continue
        }
      },
    },
  },
  methods: {
    syncSelectedFields: function () {
      this.$refs.schemaFieldsTable.clearSelected();
      this.selectedFields.forEach((idx) => {
        this.$refs.schemaFieldsTable.selectRow(idx);
      });
      this.joinedTable.selectedFields.forEach((idx) => {
        this.$refs.schemaFieldsTable.selectRow(
          // -1 offset for the joined column
          idx + this.resourceStats.schema.fields.length - 1
        );
      });
    },
    joinTable: async function (metadata) {
      this.$parent.joinTable(metadata);
    },
    showStats: function (row) {
      const fieldName = row.item.name;
      const resourceId = this.resource.id;
      this.$refs.columnStatsModal.show();
      this.$refs.columnStats.reloadData(resourceId, fieldName);
    },
    schemaFieldsTableRowClicked: function (_, idx) {
      const clickedItem = this.schemaFieldsTableItems[idx];
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$parent.removeSelectedField(clickedItem);
      } else {
        this.$parent.addSelectedField(clickedItem);
      }
    },
    addToWorkingTable: function () {
      this.$parent.addToWorkingTable();
    },
    toggleColor: function () {
      this.$parent.toggleColor();
    },
    dumpCsv: function () {
      this.$parent.dumpCsv();
    },
    removeKeyword: function (i) {
      this.$parent.removeKeyword(i);
    },
    addNewKeyword: function (keyword) {
      this.$parent.addNewKeyword(keyword);
    },
  },
};
</script>

<style lang="scss">
.dataset-description-container {
  background-color: var(--bs-gray-100);
  flex-basis: 25%;
  padding: 10px;
  overflow-y: scroll;
}
.dataset-description-buttons-container {
  float: right;
  > button:not(:last-child) {
    margin-right: 4px;
  }
  svg {
    color: var(--bs-gray-600);
    &:hover {
      color: var(--bs-gray-500);
    }
    cursor: pointer;
  }
}
div.schema-fields-table-container {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.125);
  border-radius: 0.25rem;
  tr {
    cursor: pointer;
  }
  table td {
    overflow-wrap: anywhere;
    button {
      overflow-wrap: normal;
    }
  }
}
.schema-table-span {
  width: 10px;
  display: inline-block;
}
.inline-color-block {
  height: 12px;
  width: 12px;
  display: inline-block;
}
</style>
