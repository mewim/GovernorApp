<template>
  <div>
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
      <b-list-group-item v-for="(r, k) in getFilteredResourcesHash()" :key="k">
        <div
          class="
            d-flex
            w-100
            justify-content-between
            joinable-table-header-container
          "
        >
          <span>
            <b>
              <div
                class="inline-color-block"
                :style="{ 'background-color': r.resource.color }"
              ></div>
              Table: {{ r.resource.name }}
            </b>
          </span>
          <span style="min-width: 142px">
            <b-button
              size="sm"
              variant="secondary"
              @click="r.resource.isColumnsVisiable = !r.resource.isColumnsVisiable"
              >{{ r.resource.isColumnsVisiable ? "Hide" : "Columns" }}</b-button
            >
            &nbsp;
            <b-button size="sm" variant="secondary" @click="openTable(r.resource)"
              >Open</b-button
            >
          </span>
        </div>

        <b-list-group
          v-show="r.resource.isColumnsVisiable"
        >
          <b-list-group-item v-for="(column, i) in r.filteredColumns" :key="i">
            <div class="d-flex w-100 justify-content-between">
              <span>{{ column.name }}</span>
              <span>
                <span>
                  <b-button
                    size="sm"
                    variant="primary"
                    @click="showJoinConfigModal(r.resource, column)"
                    >Add Column
                  </b-button>
                </span>
              </span>
            </div>
          </b-list-group-item>
        </b-list-group>
      </b-list-group-item>
    </b-list-group>
    <br />
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
  </div>
</template>

<script>
import axios from "axios";
import TableColorManger from "../TableColorManager";

export default {
  name: "JoinableTables",
  props: {
    histories: {
      type: Array,
      required: true,
    },
  },
  data: function () {
    return {
      resourcesHash: {},
      resourceStatsHash: {},
      joinableTables: [],
      joinConfigModalComponentTables: [],
      joinedColumn: null,
      isLoading: false,
      loadingPromise: null,
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

      this.joinableTables.splice(0);
      for (let h of this.histories) {
        const url = `api/keyjoinscores/${h.table.id}`;
        const data = await axios.get(url).then((res) => res.data);

        data.resources.forEach((r) => {
          r.color = TableColorManger.getColor(r.id);
          this.resourcesHash[r.id] = r;
          this.resourcesHash[r.id].isColumnsVisiable = false;
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
              target_field_name: t.schema.field_name,
              source_index: d.index,
              source_resource: h.table,
            });
          });
        });
      }
      this.isLoading = false;
    },
    openTable: async function (resource) {
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
      this.$parent.$parent.$parent.openResource(openedResource, true);
    },
    showJoinConfigModal: function (targetResource, column) {
      this.joinedColumn = column;
      console.log("column", column);
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
      this.closeJoinConfigModal();
      this.$parent.$parent.addColumn(joinables, column);
    },
    findJoinables: function (resourceId) {
      return this.joinableTables.filter((joinable) => {
        return joinable.target_resource.id === resourceId;
      });
    },
    filterColumns: function (resource) {
      let joinables = this.findJoinables(resource.id);
      const joinedColumnsHash = {};
      this.histories.forEach((h) => {
        if (!joinedColumnsHash[h.table.id]) {
          joinedColumnsHash[h.table.id] = new Set();
        }
        if (!h.joinedTables) {
          return;
        }
        for (let j in h.joinedTables) {
          h.joinedTables[j].columns.forEach((c) =>
            joinedColumnsHash[h.table.id].add(c)
          );
        }
      });
      const joinableSources = joinables.map((j) => j.source_resource.id);
      const targerFieldNameSet = new Set(
        joinables.map((j) => j.target_field_name)
      );
      const targetResourceStats = this.resourceStatsHash[resource.id];
      const sourceColumnNames = new Set();
      for (let h of this.histories) {
        h.resourceStats.schema.fields.forEach((f) => {
          sourceColumnNames.add(f.name);
        });
      }
      const results = targetResourceStats.schema.fields.filter((c) => {
        let joinableNameConflict = true;
        for (let j of joinableSources) {
          // If we find at least one source without this column, we can stil join this column, so it should not be removed.
          if (!joinedColumnsHash[j].has(c.name)) {
            joinableNameConflict = false;
            break;
          }
        }
        return (
          !targerFieldNameSet.has(c.name) &&
          !sourceColumnNames.has(c.name) &&
          !joinableNameConflict
        );
      });
      return results;
    },
    getJoinedColumnName: function (joinable) {
      return joinable.target_resourcestats.schema.fields[joinable.target_index]
        .name;
    },
    getFilteredResourcesHash: function () {
      const result = {};
      for (let k in this.resourcesHash) {
        const resource = this.resourcesHash[k];
        const filteredColumns = this.filterColumns(resource);
        if (filteredColumns.length > 0) {
          result[k] = { resource, filteredColumns };
        }
      }
      return result;
    },
    toggleJoinConfigModalSelections: function (isSelected) {
      const selected = isSelected ? "selected" : "";
      this.joinConfigModalComponentTables.forEach((j) => {
        j.selected = selected;
      });
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
</style>
