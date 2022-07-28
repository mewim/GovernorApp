<template>
  <div class="working-table-description-container" :style="containerStyle">
    <div ref="topPanel">
      <h5>Working Table Structure</h5>
      <working-table-components
        :histories="histories"
        :selectedColumns="selectedColumns"
        :focusedComponentIndex="focusedComponentIndex"
        :columns="columns"
      />
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
        <h5>Actions</h5>
        <b-button size="sm" variant="primary" @click="resetTable()"
          >Reset Working Table</b-button
        >
        &nbsp;
        <b-button size="sm" variant="primary" @click="toggleColor()"
          >Toggle Color</b-button
        >
        &nbsp;
        <b-button size="sm" variant="primary" @click="dumpCsv()"
          >Download as CSV</b-button
        >
        &nbsp;

        <b-button size="sm" variant="primary" @click="share()">Share</b-button>
      </div>
      <hr />
    </div>

    <div class="accordion">
      <b-card no-body class="mb-1">
        <b-button block v-b-toggle.accordion-history variant="outline-primary"
          >History</b-button
        >
        <b-collapse
          id="accordion-history"
          accordion="working-table-description__accordion"
          role="tabpanel"
        >
          <b-card-body :style="accordionPanelStyle">
            <b-list-group>
              <b-list-group-item v-for="(log, i) in logs" :key="i">
                <div class="d-flex w-100 justify-content-between">
                  <span style="width: 350px" v-if="log.type === 'keyword'"
                    >Add filter keyword: {{ log.keyword }}
                  </span>
                  <span style="width: 350px" v-else>
                    Add
                    {{
                      log.type === "union"
                        ? " rows"
                        : " column" + `"${log.column}"`
                    }}
                    from table:
                  </span>
                  <span class="history-buttons-span">
                    <b-button size="sm" variant="danger" @click="undoLog(log)"
                      >Undo
                    </b-button>
                  </span>
                </div>

                <small v-if="log.type !== 'keyword'">
                  <div
                    class="inline-color-block"
                    :style="{ 'background-color': log.table.color }"
                  ></div>
                  &nbsp;
                  {{ log.table.name }}
                </small>
              </b-list-group-item>
            </b-list-group>
          </b-card-body>
        </b-collapse>
      </b-card>

      <b-card no-body class="mb-1">
        <b-button block v-b-toggle.accordion-columns variant="outline-primary">
          {{
            settings.workingTableColumnsSection === "unioned"
              ? "Add Column from Unioned Table"
              : "Hide / Unhide Columns"
          }}
        </b-button>
        <b-collapse
          id="accordion-columns"
          accordion="working-table-description__accordion"
          role="tabpanel"
        >
          <b-card-body :style="accordionPanelStyle">
            <div class="schema-fields-table-container">
              <b-table
                ref="schemaFieldsTable"
                :items="filteredColumns"
                :fields="schemaFields"
                no-select-on-click
                selectable
                @row-clicked="schemaFieldsTableRowClicked"
              >
                <template #cell(selected)="{ rowSelected }">
                  <template v-if="rowSelected">
                    <span class="schema-table-span" aria-hidden="true"
                      >&check;</span
                    >
                  </template>
                  <template v-else>
                    <span class="schema-table-span" aria-hidden="true"
                      >&nbsp;</span
                    >
                  </template>
                </template>
                <template #cell(title)="row">
                  <span
                    v-b-tooltip.hover.html
                    :title="getColumnDescription(row.item)"
                  >
                    {{ row.item.title }}
                  </span>
                </template>
                <template #cell(tables)="row">
                  <div
                    v-for="id in row.item.tables"
                    :key="id"
                    class="inline-color-block"
                    :style="{
                      'background-color': getColor(id),
                      'margin-right': '4px',
                    }"
                  ></div>
                </template>
              </b-table>
            </div>
          </b-card-body>
        </b-collapse>
      </b-card>

      <b-card no-body class="mb-1">
        <b-button block v-b-toggle.accordion-join variant="outline-primary"
          >Add Columns from Other Tables (Join)</b-button
        >
        <b-collapse
          id="accordion-join"
          accordion="working-table-description__accordion"
          role="tabpanel"
        >
          <b-card-body :style="accordionPanelStyle">
            <div>
              <joinable-tables
                :histories="histories"
                :focusedComponentId="focusedComponentId"
                :columns="columns"
                :settings="settings"
                ref="joinableTables"
              />
            </div>
          </b-card-body>
        </b-collapse>
      </b-card>

      <b-card no-body class="mb-1">
        <b-button block v-b-toggle.accordion-union variant="outline-primary"
          >Add Rows from Other Tables (Union)</b-button
        >
        <b-collapse
          id="accordion-union"
          accordion="working-table-description__accordion"
          role="tabpanel"
        >
          <b-card-body :style="accordionPanelStyle">
            <unionable-tables
              :resourceIds="allTableIds"
              :showUnionButton="true"
            />
          </b-card-body>
        </b-collapse>
      </b-card>
    </div>
    <b-modal
      title="Shared Link Created"
      ok-only
      hide-header-close
      ref="sharedLinkModal"
      size="lg"
    >
      <p>{{ sharedLink }}</p>
    </b-modal>

    <b-modal
      :title="`Column Composition: ${columnComposition.title}`"
      ok-only
      hide-header-close
      ref="columnCompositionModal"
      size="lg"
    >
      <b-list-group>
        <b-list-group-item v-for="(r, i) in columnComposition.tables" :key="i">
          <b
            >Dataset:
            <a
              target="_blank"
              :href="getDatasetUrl(r.dataset)"
              v-b-tooltip.hover
              title="Jump to dataset on open.canada.ca"
            >
              <i>{{ r.dataset.title }}</i></a
            >
          </b>
          <div class="d-flex w-100">
            <span>
              <div
                class="inline-color-block"
                :style="{ 'background-color': r.table.color }"
              ></div>
              &nbsp;
              <a
                href="#"
                @click="openResource(r.table, r.dataset, r.resourceStats)"
                v-b-tooltip.hover
                title="Open table"
                >{{ r.table.name }}</a
              ></span
            >
          </div>
        </b-list-group-item>
      </b-list-group>
      <div v-if="columnComposition.hasUnfilled">
        <br />
        <span> This column has unfilled cells. </span>
        <span class="float-right">
          <b-button
            size="sm"
            variant="primary"
            @click="getJoinSuggestions(columnComposition.title)"
          >
            Get Suggestions
          </b-button>
        </span>
      </div>
    </b-modal>
  </div>
</template>

<script>
const ACCORDION_BUTTONS_HEIGHT = 210;
const ACCORDION_CONTENT_MIN_HEIGHT = 400;
import axios from "axios";
import Common from "../Common";
import TableColorManager from "../TableColorManager";
export default {
  name: "WorkingTableDescription",
  props: {
    histories: Array,
    logs: Array,
    columns: Array,
    selectedColumns: Array,
    keywords: Array,
    focusedComponentIndex: Number,
    settings: { type: Object, required: true },
  },
  data: function () {
    return {
      isHistoriesShown: true,
      resizeObserver: null,
      primaryColumn: null,
      sharedLink: "",
      accordionPanelMaxHeight: null,
      columnComposition: {
        title: null,
        tables: [],
        hasUnfilled: false,
      },
    };
  },
  mounted: function () {
    this.resizeObserver = new ResizeObserver(() => {
      try {
        this.accordionPanelMaxHeight =
          this.$el.clientHeight -
          this.$refs.topPanel.clientHeight -
          ACCORDION_BUTTONS_HEIGHT;
      } catch (e) {
        this.accordionPanelMaxHeight = null;
      }
    });
    this.resizeObserver.observe(this.$refs.topPanel);
    this.resizeObserver.observe(this.$el);
  },
  unmounted() {
    this.resizeObserver.unobserve(this.$refs.topPanel);
    this.resizeObserver.unobserve(this.$el);
  },
  computed: {
    allTableIds: function () {
      return this.histories.map((h) => h.table.id);
    },
    focusedComponentId: function () {
      return !isNaN(parseInt(this.focusedComponentIndex))
        ? this.histories[this.focusedComponentIndex].table.id
        : null;
    },
    filteredColumns: function () {
      if (this.settings.workingTableColumnsSection === "all") {
        return this.columns;
      }
      return this.columns.filter((c) => {
        let isUnionedColumn = false;
        for (let h of this.histories) {
          if (h.resourceStats.schema.fields.find((f) => f.name === c.title)) {
            isUnionedColumn = true;
            break;
          }
        }
        return isUnionedColumn;
      });
    },
    schemaFields: function () {
      const schemaFields = [
        { key: "selected", label: "✓" },
        { key: "title", label: "Column" },
      ];
      if (this.settings.workingTableColumnsSection === "all") {
        schemaFields.push({ key: "tables", label: "Tables" });
      }
      return schemaFields;
    },
    accordionPanelStyle: function () {
      if (
        !this.accordionPanelMaxHeight ||
        this.accordionPanelMaxHeight < ACCORDION_CONTENT_MIN_HEIGHT
      ) {
        return {
          overflow: "hidden",
        };
      }
      return {
        maxHeight: this.accordionPanelMaxHeight + "px",
        overflow: "scroll",
      };
    },
    containerStyle: function () {
      return {
        "overflow-y":
          !this.accordionPanelMaxHeight ||
          this.accordionPanelMaxHeight < ACCORDION_CONTENT_MIN_HEIGHT
            ? "scroll"
            : "hidden",
      };
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
            title: c.title,
            index: i,
          };
        })
        .filter((c) => columnSet.has(c.title));
      rowsToSelect.forEach((r) => {
        this.$refs.schemaFieldsTable.selectRow(r.index);
      });
    },
    schemaFieldsTableRowClicked: function (row, idx) {
      if (this.$refs.schemaFieldsTable.isRowSelected(idx)) {
        this.$parent.removeSelectedColumn(row.title);
      } else {
        this.$parent.addSelectedColumn(row.title);
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
    dumpCsv: function () {
      this.$parent.dumpCsv();
    },
    removeKeyword: function (keyword) {
      this.$parent.removeKeyword(keyword);
    },
    addNewKeyword: function (keyword) {
      this.$parent.addNewKeyword(keyword);
    },
    undoLog: function (log) {
      this.$parent.undoLog(log);
    },
    undoJoin: function (targetResource, column) {
      const log = this.logs.find(
        (log) =>
          log.type === "join" &&
          log.table.id === targetResource.id &&
          log.column === column.name
      );
      if (!log) {
        return;
      }
      this.undoLog(log);
    },
    async share() {
      axios
        .post("/api/sharedhistories/", {
          histories: this.histories,
          keywords: this.keywords,
          selectedColumns: this.selectedColumns,
          sortConfig: this.$parent.sortConfig,
          logs: this.logs,
        })
        .then((res) => {
          const id = res.data._id;
          this.sharedLink = `${window.location.origin}/#shared/${id}`;
          this.$refs.sharedLinkModal.show();
        })
        .catch((err) => {
          console.error(err);
        });
    },
    getColor(id) {
      return TableColorManager.getColor(id);
    },
    focusComponent(i) {
      this.$parent.focusComponent(i);
    },
    jumpToFirstRow(i) {
      this.$parent.jumpToFirstRow(i);
    },
    getColumnDescription(item) {
      return this.$parent.getColumnDescription(item.title);
    },
    showColumnComposition(column) {
      const uuids = column.tables;
      const tableHash = {};
      const datasetHash = {};
      const resourceStatsHash = {};
      const columnTitle = column.title;
      const hasUnfilled = !uuids || uuids.length < this.histories.length;
      uuids.forEach((u) => {
        for (let h of this.histories) {
          if (h.table.id === u) {
            tableHash[u] = h.table;
            datasetHash[u] = h.dataset;
            resourceStatsHash[u] = h.resourceStats;
            break;
          }
          if (h.joinedTables && u in h.joinedTables) {
            tableHash[u] = h.joinedTables[u].targetResource;
            resourceStatsHash[u] = h.joinedTables[u].targetResourceStats;

            datasetHash[u] = h.dataset;
            break;
          }
        }
      });
      const data = uuids.map((u) => {
        return {
          id: u,
          color: TableColorManager.getColor(u),
          dataset: datasetHash[u],
          table: tableHash[u],
          resourceStats: resourceStatsHash[u],
        };
      });
      this.columnComposition.tables = data;
      this.columnComposition.title = columnTitle;
      this.columnComposition.hasUnfilled = hasUnfilled;
      this.$refs.columnCompositionModal.show();
    },
    getDatasetUrl(dataset) {
      return Common.getDatasetUrl(dataset.id);
    },
    openResource(resource, dataset, resourceStats) {
      this.$refs.columnCompositionModal.hide();
      this.$parent.$parent.openResource(
        { resource, dataset, resourceStats },
        true
      );
    },
    getJoinSuggestions(columnNameFilter, componentIdFilter) {
      this.$refs.columnCompositionModal.hide();
      this.$refs.joinableTables.showColumnSuggestionsModal(
        columnNameFilter,
        componentIdFilter
      );
    },
  },
};
</script>

<style lang="scss">
.working-table-description-container {
  background-color: var(--bs-gray-100);
  width: 500px;
  padding: 10px;
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
  min-width: 40px;
  margin-left: 4px;
}
.btn.btn-danger {
  svg {
    fill: var(--bs-white);
  }
}
.float-right {
  float: right;
}
</style>
