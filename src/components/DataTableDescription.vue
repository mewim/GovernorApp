<template>
  <div class="dataset-description-container" v-if="!!dataset">
    <div>
      <data-table-details :dataset="dataset" :resource="resource" />
    </div>
    <hr />
    <div>
      <h5>Actions</h5>
      <b-button size="sm">Set as Working Table</b-button>
      &nbsp;
      <b-button size="sm">Union with Working Table</b-button>
    </div>
    <hr />
    <div>
      <table-filters :keywords="keywords" />
    </div>
    <hr />
    <div>
      <p></p>
      <h5>Columns</h5>
      <a href="#" @click="isColumnDetailsVisible = !isColumnDetailsVisible"
        >[{{ isColumnDetailsVisible ? "Hide" : "Show" }}]</a
      >
      <div
        class="schema-fields-table-container"
        v-show="isColumnDetailsVisible"
      >
        <b-table
          ref="schemaFieldsTable"
          :items="resourceStats.schema.fields"
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
      <joinable-tables
        :resourceId="resource.id"
        :sourceResourceStats="resourceStats"
      />
    </div>
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
      isColumnDetailsVisible: false
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
  },
  methods: {
    syncSelectedFields: function () {
      this.$refs.schemaFieldsTable.clearSelected();
      this.selectedFields.forEach((idx) => {
        this.$refs.schemaFieldsTable.selectRow(idx);
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
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$parent.removeSelectedField(idx);
      } else {
        this.$parent.addSelectedField(idx);
      }
    },
  },
};
</script>

<style lang="scss">
.dataset-description-container {
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
</style>
