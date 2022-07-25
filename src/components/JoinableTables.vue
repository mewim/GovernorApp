<template>
  <div>
    <div
      v-show="joinableTables.length > 0 && !isLoading"
      class="joinable-view-filter-container"
    >
      <div v-if="false">
        <b-button
          variant="primary"
          @click="showColumnSuggestionsModal()"
          style="width: 100%"
        >
          Try to Fill All Unfilled Columns Automatically
        </b-button>
        <p></p>
      </div>
      <b-form-input
        v-model.lazy="filterText"
        placeholder="Filter by dataset / column / table name..."
      ></b-form-input>
    </div>
    <b-list-group v-show="this.joinableTables.length === 0 || isLoading">
      <b-list-group-item
        v-if="joinableTables.length === 0 && !isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        No foreign column has been found.
      </b-list-group-item>
      <b-list-group-item
        v-if="isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        Loading...
      </b-list-group-item>
    </b-list-group>
    <b-list-group>
      <b-list-group-item v-for="(r, k) in filteredResourcesHash" :key="k">
        <div
          class="
            d-flex
            w-100
            justify-content-between
            joinable-table-header-container
          "
        >
          <span>
            <div>
              <span>Table: {{ r.resource.name }}</span>
            </div>
            <small>
              From: <i>{{ r.datasetName }}</i>
            </small>
          </span>
          <span style="min-width: 142px">
            <b-button
              size="sm"
              variant="secondary"
              style="min-width: 75px !important"
              @click="
                r.resource.isColumnsVisiable = !r.resource.isColumnsVisiable
              "
              >{{ r.resource.isColumnsVisiable ? "Hide" : "Columns" }}</b-button
            >
            &nbsp;
            <b-button
              size="sm"
              variant="secondary"
              @click="openTable(r.resource)"
              >Open</b-button
            >
          </span>
        </div>

        <b-list-group v-show="r.resource.isColumnsVisiable">
          <b-list-group-item
            v-for="(column, i) in r.filteredColumns"
            :key="i"
            :class="
              column.isSelected ? 'column-table-selected' : 'column-table'
            "
          >
            <div class="d-flex w-100" @click="toggleJoin(r.resource, column)">
              <span style="width: 40px">{{
                column.isSelected ? "✓" : ""
              }}</span>
              <span>{{ column.name }}</span>
            </div>
          </b-list-group-item>
        </b-list-group>
      </b-list-group-item>
    </b-list-group>
    <b-modal size="xl" ref="joinConfigModal" hide-header centered>
      <p>The column will be added to the following component tables:</p>

      <b-list-group-item
        v-for="(joinable, i) in joinConfigModalComponentTables"
        :key="i"
      >
        <div class="d-flex w-100 justify-content-between">
          <b>
            <div
              class="inline-color-block"
              :style="{ 'background-color': joinable.source_resource.color }"
            ></div>
            Table: {{ joinable.source_resource.name }}
          </b>
          <span>
            <b-form-checkbox
              v-model="joinable.selected"
              value="selected"
              unchecked-value=""
            >
            </b-form-checkbox>
          </span>
        </div>
        <div>
          <small>
            From: <i>{{ datasetNameHash[joinable.source_resource.id] }}</i>
          </small>
        </div>
        <div>
          <small>
            {{ getKeyDescription(joinable) }}
          </small>
        </div>
      </b-list-group-item>

      <template #modal-footer>
        <div class="w-100">
          <span>
            <span>
              <b-button
                size="sm"
                variant="success"
                v-show="
                  joinConfigModalSelectedComponentTables.length <
                  joinConfigModalComponentTables.length
                "
                @click="toggleJoinConfigModalSelections(true)"
              >
                Select All
              </b-button>
            </span>
            <span>
              <b-button
                size="sm"
                variant="success"
                v-show="joinConfigModalSelectedComponentTables.length > 0"
                @click="toggleJoinConfigModalSelections(false)"
              >
                Unselect All
              </b-button>
            </span>
          </span>

          <span class="float-right">
            <span>
              <b-button size="sm" @click="closeJoinConfigModal()">
                Close
              </b-button>
            </span>
            <span>
              <b-button
                size="sm"
                variant="primary"
                v-show="joinConfigModalSelectedComponentTables.length > 0"
                @click="addColumn()"
              >
                OK
              </b-button>
            </span>
          </span>
        </div>
      </template>
    </b-modal>

    <b-modal size="xl" ref="columnSuggestionsModal" hide-header centered>
      <div
        style="max-height: 600px; overflow-y: scroll"
        v-if="
          columnFillingSuggestionsSelected &&
          columnFillingSuggestionsSelected.length > 0
        "
      >
        <b-list-group>
          <b-list-group-item
            v-for="(suggestion, i) in columnFillingSuggestions"
            :key="i"
          >
            <div style="display: flex; flex-direction: row">
              <div style="flex-basis: 40%">
                <working-table-component-table-item
                  :h="suggestion.history"
                  @open-resource="openResource"
                />
              </div>
              <div style="margin-left: 20px; flex-grow: 1">
                <p v-if="false">
                  There {{ suggestion.columns.length > 1 ? "are" : "is" }}
                  {{ suggestion.columns.length }} unfilled column{{
                    suggestion.columns.length > 1 ? "s" : ""
                  }}
                  in this component:
                </p>
                <ul style="width: 100%">
                  <li v-for="(c, j) in suggestion.columns" :key="j">
                    <hr v-if="j > 0" />
                    <h6>Unfilled column: {{ c.name }}</h6>
                    <b-form-group>
                      <b-form-radio
                        v-for="(joinPlan, k) in c.joinPlans"
                        :key="k"
                        :value="k"
                        v-model="columnFillingSuggestionsSelected[i][j]"
                        :name="`join-plan-suggestions-radio-${i}-${j}`"
                      >
                        <div class="join-plan-suggestions__radio-label">
                          Join with:
                          <a
                            href="#"
                            @click="openTable(joinPlan.target_resource)"
                          >
                            {{ joinPlan.target_resource.name }}</a
                          >
                        </div>
                      </b-form-radio>

                      <b-form-radio
                        v-model="columnFillingSuggestionsSelected[i][j]"
                        :name="`join-plan-suggestions-radio-${i}-${j}`"
                        :value="null"
                      >
                        <div class="join-plan-suggestions__radio-label">
                          Do not fill this column
                        </div>
                      </b-form-radio>
                    </b-form-group>
                  </li>
                </ul>
              </div>
            </div>
          </b-list-group-item>
        </b-list-group>
      </div>
      <div v-else>
        <p>There is no suggestions for joining for the current selection.</p>
      </div>
      <template #modal-footer>
        <div class="w-100">
          <span class="float-right">
            <span>
              <b-button size="sm" @click="closeColumnSuggestionsModal()">
                Close
              </b-button>
            </span>
            <span>
              <b-button
                size="sm"
                variant="primary"
                @click="applyColumnSuggestions()"
                v-if="
                  columnFillingSuggestionsSelected &&
                  columnFillingSuggestionsSelected.length > 0
                "
              >
                OK
              </b-button>
            </span>
          </span>
        </div>
      </template>
    </b-modal>
  </div>
</template>

<script>
import axios from "axios";
import TableColorManager from "../TableColorManager";

export default {
  name: "JoinableTables",
  props: {
    histories: {
      type: Array,
      required: true,
    },
    focusedComponentId: String,
    columns: {
      type: Array,
      required: true,
    },
  },
  data: function () {
    return {
      resourcesHash: {},
      datasetNameHash: {},
      resourceStatsHash: {},
      joinableTables: [],
      joinConfigModalComponentTables: [],
      joinedColumn: null,
      isLoading: false,
      loadingPromise: null,
      filterText: "",
      filteredResourcesHash: {},
      columnFillingSuggestions: [],
      columnFillingSuggestionsSelected: [],
    };
  },
  watch: {
    histories: {
      immediate: true,
      handler: async function () {
        if (this.loadingPromise) {
          await this.loadingPromise;
        }
        this.loadingPromise = this.reloadData();
        await this.loadingPromise;
        this.loadingPromise = null;
      },
    },
  },
  computed: {
    joinConfigModalSelectedComponentTables() {
      return this.joinConfigModalComponentTables.filter(
        (joinable) => joinable.selected === "selected"
      );
    },
  },
  methods: {
    reloadData: async function () {
      this.isLoading = true;
      this.resourcesHash = {};
      this.resourceStatsHash = {};
      this.datasetNameHash = {};
      this.joinableTables.splice(0);
      for (let h of this.histories) {
        this.datasetNameHash[h.table.id] = h.dataset.title;
        const url = `api/keyjoinscores/${h.table.id}`;
        const data = await axios.get(url).then((res) => res.data);

        data.resources.forEach((r) => {
          this.resourcesHash[r.id] = r;
          this.resourcesHash[r.id].isColumnsVisiable = false;
          this.datasetNameHash[r.id] = h.dataset.title;
        });
        data.resourceStats.forEach((d) => {
          this.resourceStatsHash[d.uuid] = d;
        });
        data.results.forEach((d) => {
          d.targets.forEach((t) => {
            this.joinableTables.push({
              target_resource: this.resourcesHash[t.uuid],
              target_resourcestats: this.resourceStatsHash[t.uuid],
              target_index: t.index,
              score: t.score,
              containment_score: t.containment_score,
              target_field_name: t.schema.field_name,
              source_index: d.index,
              source_resource: h.table,
            });
          });
        });
      }
      this.isLoading = false;
      this.updateFilteredResourcesHash();
    },
    getKeyDescription: function (joinable) {
      const sourceResourceStats = this.histories.find(
        (h) => h.table.id === joinable.source_resource.id
      ).resourceStats;
      const sourceKeyName =
        sourceResourceStats.schema.fields[joinable.source_index].name;
      if (sourceKeyName === joinable.target_field_name) {
        return `Key: ${sourceKeyName}`;
      } else {
        return `Primary key: ${sourceKeyName}; Foreign key: ${joinable.target_field_name}`;
      }
    },
    openTable: async function (resource) {
      this.closeColumnSuggestionsModal();
      const resourceStats = await axios
        .get(`/api/inferredstats/${resource.id}`)
        .then((res) => res.data);
      const dataset = await axios
        .get(`/api/dataset/?resource_id=${resource.id}`)
        .then((res) => res.data);
      const openedResource = {
        resource,
        dataset,
        resourceStats,
      };
      this.$parent.$parent.$parent.$parent.openResource(openedResource, true);
    },
    toggleJoin: function (targetResource, column) {
      if (!column.isSelected) {
        this.showJoinConfigModal(targetResource, column);
      }
      this.$parent.$parent.undoJoin(targetResource, column);
    },
    showJoinConfigModal: function (targetResource, column) {
      this.joinedColumn = column;
      this.joinConfigModalComponentTables.splice(0);
      this.findJoinables(targetResource.id).forEach((j) => {
        const history = this.histories.find(
          (h) => h.table.id === j.source_resource.id
        );
        const columnsSet = new Set();
        if (history && history.joinedTables) {
          for (let j in history.joinedTables) {
            history.joinedTables[j].columns.forEach((c) => columnsSet.add(c));
          }
          if (columnsSet.has(column.name)) {
            return;
          }
        }
        const jCopy = Object.assign({}, j);
        jCopy.selected = "selected";
        this.joinConfigModalComponentTables.push(jCopy);
      });
      this.$refs.joinConfigModal.show();
    },
    closeJoinConfigModal: function () {
      this.joinedColumn = null;
      this.joinConfigModalComponentTables.splice(0);
      this.$refs.joinConfigModal.hide();
    },
    addColumn: function () {
      const column = this.joinedColumn;
      const joinables = this.joinConfigModalSelectedComponentTables;
      for (let j of joinables) {
        j.target_resource.color = TableColorManager.getColor(
          j.target_resource.id
        );
      }
      this.closeJoinConfigModal();
      this.$parent.$parent.$parent.addColumn(joinables, column);
    },
    findJoinables: function (resourceId) {
      return this.joinableTables.filter((joinable) => {
        return joinable.target_resource.id === resourceId;
      });
    },
    filterColumns: function (resource) {
      let joinables = this.findJoinables(resource.id);
      const joinedColumnsHash = {};
      const targetTojoinedColumnsHash = {};
      this.histories.forEach((h) => {
        if (!joinedColumnsHash[h.table.id]) {
          joinedColumnsHash[h.table.id] = new Set();
        }
        if (!h.joinedTables) {
          return;
        }
        for (let j in h.joinedTables) {
          h.joinedTables[j].columns.forEach((c) => {
            joinedColumnsHash[h.table.id].add(c);
            if (!targetTojoinedColumnsHash[j]) {
              targetTojoinedColumnsHash[j] = new Set();
            }
            targetTojoinedColumnsHash[j].add(c);
          });
        }
      });
      const joinableSources = joinables.map((j) => j.source_resource.id);
      if (
        this.focusedComponentId &&
        !joinableSources.includes(this.focusedComponentId)
      ) {
        return [];
      }
      const targetResourceStats = this.resourceStatsHash[resource.id];
      const sourceColumnNames = new Set();
      for (let h of this.histories) {
        h.resourceStats.schema.fields.forEach((f) => {
          sourceColumnNames.add(f.name);
        });
      }
      const results = targetResourceStats.schema.fields
        .map((c) => {
          c.isSelected =
            targetTojoinedColumnsHash[targetResourceStats.uuid] &&
            targetTojoinedColumnsHash[targetResourceStats.uuid].has(c.name);
          return c;
        })
        .filter((c) => {
          if (c.isSelected) {
            return true;
          }
          let joinableNameConflict = true;
          for (let j of joinableSources) {
            // If we find at least one source without this column, we can stil join this column, so it should not be removed.
            if (!joinedColumnsHash[j].has(c.name)) {
              joinableNameConflict = false;
              break;
            }
          }
          return !sourceColumnNames.has(c.name) && !joinableNameConflict;
        });
      return results;
    },
    getJoinedColumnName: function (joinable) {
      return joinable.target_resourcestats.schema.fields[joinable.target_index]
        .name;
    },
    getFilteredResourcesHash: function () {
      const filterKeywords = this.filterText
        ? this.filterText.toLowerCase().split(" ")
        : null;
      const result = {};
      for (let k in this.resourcesHash) {
        const resource = this.resourcesHash[k];
        const datasetName = this.datasetNameHash[resource.id];
        let shouldInclude = !filterKeywords;
        if (!shouldInclude) {
          for (let f of filterKeywords) {
            if (
              resource.name.toLowerCase().includes(f) ||
              datasetName.toLowerCase().includes(f)
            ) {
              shouldInclude = true;
              break;
            }
          }
        }
        if (!shouldInclude) {
          const resourceStats = this.resourceStatsHash[resource.id];
          for (let kw of filterKeywords) {
            if (
              resourceStats.schema.fields.find((f) =>
                f.name.toLowerCase().includes(kw)
              )
            ) {
              shouldInclude = true;
              break;
            }
          }
        }
        if (!shouldInclude) {
          continue;
        }
        const filteredColumns = this.filterColumns(resource);
        if (filteredColumns.length > 0) {
          result[k] = {
            datasetName: this.datasetNameHash[resource.id],
            resource,
            filteredColumns,
          };
        }
      }
      return result;
    },
    getColumnFillingSuggestions(columnNameFilter, componentIdFilter) {
      const columnTitles = this.columns.map((c) => c.title);
      const suggestionsHash = {};
      const unfilledColumnsForHistory = {};
      const historiesHash = {};
      this.histories.forEach((h) => {
        if (componentIdFilter && componentIdFilter !== h.table.id) {
          return;
        }
        historiesHash[h.table.id] = h;
        const currentColumnSet = new Set(
          h.resourceStats.schema.fields.map((f) => f.name)
        );
        if (h.joinedTables) {
          for (const uuid in h.joinedTables) {
            h.joinedTables[uuid].columns.forEach((c) => {
              currentColumnSet.add(c);
            });
          }
        }
        const unfilledColumns = columnTitles
          .filter((c) => !currentColumnSet.has(c))
          .filter((c) => (columnNameFilter ? columnNameFilter === c : true));
        if (unfilledColumns.length > 0) {
          unfilledColumnsForHistory[h.resourceStats.uuid] = unfilledColumns;
        }
      });
      for (const uuid in unfilledColumnsForHistory) {
        const unfilledColumns = unfilledColumnsForHistory[uuid];
        for (let joinPlan of this.joinableTables) {
          if (joinPlan.source_resource.id === uuid) {
            const targerResourceStats = joinPlan.target_resourcestats;
            const targetColumns = targerResourceStats.schema.fields.map(
              (f) => f.name
            );
            const intersection = unfilledColumns.filter((c) =>
              targetColumns.includes(c)
            );
            if (intersection.length > 0) {
              intersection.forEach((c) => {
                if (!suggestionsHash[uuid]) {
                  suggestionsHash[uuid] = {};
                }
                if (!suggestionsHash[uuid][c]) {
                  suggestionsHash[uuid][c] = [];
                }
                suggestionsHash[uuid][c].push(joinPlan);
              });
            }
          }
        }
      }
      const suggetionsFlattened = [];
      for (const uuid in suggestionsHash) {
        const currentHistory = historiesHash[uuid];
        const currentResult = {
          history: currentHistory,
          columns: [],
        };
        for (const column in suggestionsHash[uuid]) {
          const joinPlans = suggestionsHash[uuid][column].sort((a, b) => {
            if (a.containment_score > b.containment_score) {
              return -1;
            } else if (a.containment_score === b.containment_score) {
              return b.score - a.score;
            }
            return 1;
          });
          currentResult.columns.push({
            name: column,
            joinPlans,
          });
        }
        suggetionsFlattened.push(currentResult);
      }
      return suggetionsFlattened;
    },
    async showColumnSuggestionsModal(
      columnNameFilter = null,
      componentIdFilter = null
    ) {
      if (this.loadingPromise) {
        await this.loadingPromise;
      }
      this.columnFillingSuggestions = this.getColumnFillingSuggestions(
        columnNameFilter,
        componentIdFilter
      );
      this.columnFillingSuggestionsSelected = this.columnFillingSuggestions.map(
        (c) => {
          // Select the first by default (cause it has highest score)
          return c.columns.map(() => "0");
        }
      );
      this.$refs.columnSuggestionsModal.show();
    },
    applyColumnSuggestions() {
      const appliedJoinPlans = [];
      for (let i = 0; i < this.columnFillingSuggestionsSelected.length; ++i) {
        for (
          let j = 0;
          j < this.columnFillingSuggestionsSelected[i].length;
          ++j
        ) {
          const selectedIndex = parseInt(
            this.columnFillingSuggestionsSelected[i][j]
          );
          if (isNaN(selectedIndex)) {
            continue;
          }
          const selectedColumn = this.columnFillingSuggestions[i].columns[j];
          const selectedJoinPlan = selectedColumn.joinPlans[selectedIndex];
          selectedJoinPlan.target_resource.color = TableColorManager.getColor(
            selectedJoinPlan.target_resource.id
          );
          const selectedColumnName = selectedColumn.name;
          appliedJoinPlans.push({
            joinable: selectedJoinPlan,
            column: selectedJoinPlan.target_resourcestats.schema.fields.find(
              (f) => f.name === selectedColumnName
            ),
          });
        }
      }
      this.closeColumnSuggestionsModal();
      this.$parent.$parent.$parent.bulkAddColumns(appliedJoinPlans);
    },
    closeColumnSuggestionsModal() {
      this.columnFillingSuggestions = [];
      this.$refs.columnSuggestionsModal.hide();
    },
    updateFilteredResourcesHash: function () {
      this.filteredResourcesHash = this.getFilteredResourcesHash();
    },
    toggleJoinConfigModalSelections: function (isSelected) {
      const selected = isSelected ? "selected" : "";
      this.joinConfigModalComponentTables.forEach((j) => {
        j.selected = selected;
      });
    },
    openResource(data) {
      this.closeColumnSuggestionsModal();
      const { resource, dataset, resourceStats } = data;
      this.$parent.$parent.$parent.$parent.openResource(
        { resource, dataset, resourceStats },
        true
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.joinable-table-header-container {
  margin-bottom: 10px;
}
.float-right {
  float: right;
}
.column-table-selected {
  cursor: pointer;
  background-color: #cccccc;
}
.column-table {
  cursor: pointer;
}
.joinable-view-filter-container {
  > input.form-control {
    width: 100%;
    margin-bottom: 8px;
  }
}

div.custom-control.custom-radio {
  display: flex;
  label.custom-control-label {
    margin-left: 8px;
  }
}
div.join-plan-suggestions__radio-label {
  margin-left: 8px;
}
</style>
