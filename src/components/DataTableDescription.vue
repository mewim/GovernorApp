<template>
  <div class="dataset-description-container" v-if="!!dataset">
    <div>
      <h4>Release Date</h4>
    </div>
    <p>
      {{ dataset.portal_release_date ? dataset.portal_release_date : "N/A" }}
    </p>
    <p></p>

    <h4>Subjects</h4>
    <div>
      <span
        class="badge rounded-pill bg-primary"
        v-for="(s, i) in dataset.subject"
        :key="i"
        >{{ s.replaceAll("_", " ") }}</span
      >
    </div>
    <p></p>
    <h4>Notes</h4>
    <p>{{ dataset.notes }}</p>

    <p></p>
    <h4>URL</h4>
    <a target="_blank" :href="getUrl(dataset.id)">{{ getUrl(dataset.id) }}</a>
    <div v-if="!!resourceStats">
      <p></p>
      <h4>Number of Rows</h4>
      <p>{{ resourceStats.tuples_count }}</p>

      <p></p>
      <h4>
        Data
        <span class="dataset-description-buttons-container">
          <b-button size="sm" @click="showAllRows = !showAllRows">{{
            toggleRowText
          }}</b-button>
        </span>
      </h4>

      <div class="schema-fields-table-container">
        <b-table
          ref="schemaFieldsTable"
          :items="resourceStats.schema.fields"
          :fields="schemaFields"
          no-select-on-click
          selectable
          @row-selected="schemaFieldsTableRowSelected"
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
    this.selectMatchedFields();
  },
  data: function () {
    return {
      schemaFields: [
        { key: "selected", label: "✓" },
        { key: "name", label: "Inferred Column Name" },
        { key: "type", label: "Inferred Column Type" },
        { key: "stats", label: "Stats" },
      ],
      selectedFields: [],
      showAllRows: false,
    };
  },
  computed: {
    toggleRowText: function () {
      if (this.showAllRows) {
        return "Show Matched Rows";
      }
      return "Show All Rows";
    },
  },
  props: {
    dataset: Object,
    resourceStats: Object,
    resource: Object,
  },
  watch: {
    resourceStats: function () {
      this.selectMatchedFields();
    },
    showAllRows: function (newVal) {
      this.$parent.setShowAllRows(newVal);
    },
  },
  methods: {
    showStats: function (row) {
      const fieldName = row.item.name;
      const resourceId = this.resource.id;
      this.$refs.columnStatsModal.show();
      this.$refs.columnStats.reloadData(resourceId, fieldName);
    },
    getUrl: function (uuid) {
      return "https://open.canada.ca/data/en/dataset/" + uuid;
    },
    schemaFieldsTableRowSelected: function (rows) {
      this.selectedFields = rows.map((r) => r.name);
      this.$parent.setSelectedFields(this.selectedFields);
    },
    schemaFieldsTableRowClicked: function (_, idx) {
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$refs.schemaFieldsTable.unselectRow(idx);
      } else {
        this.$refs.schemaFieldsTable.selectRow(idx);
      }
    },
    selectMatchedFields: function () {
      this.$nextTick(() => {
        const matchedColumns = new Set(this.resource.matches.columns);
        console.log(matchedColumns, this.resourceStats.schema);
        for (let i = 0; i < this.resourceStats.schema.fields.length; ++i) {
          if (matchedColumns.has(this.resourceStats.schema.fields[i].name)) {
            this.$refs.schemaFieldsTable.selectRow(i);
          }
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
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
    color: #6c7572;
    &:hover {
      color: #5a6268;
    }
    cursor: pointer;
  }
}
div.schema-fields-table-container {
  tr {
    cursor: pointer;
  }
}
.schema-table-span {
  width: 10px;
  display: inline-block;
}
</style>
