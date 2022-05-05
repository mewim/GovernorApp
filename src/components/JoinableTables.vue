<template>
  <div>
    <b-list-group v-show="this.joinableTables.length === 0 || isLoading">
      <b-list-group-item
        v-if="joinableTables.length === 0 && !isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        No foreign column has been found for this table. Please try to select
        other column as primary.
      </b-list-group-item>
      <b-list-group-item
        v-if="isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        Loading...
      </b-list-group-item>
    </b-list-group>
    <b-list-group>
      <b-list-group-item v-for="(joinable, i) in joinableTables" :key="i">
        <div
          class="
            d-flex
            w-100
            justify-content-between
            joinable-table-header-container
          "
        >
          <b>
            <div
              class="inline-color-block"
              :style="{ 'background-color': joinable.target_resource.color }"
            ></div>
            Table: {{ joinable.target_resource.name }}
          </b>
          <span>
            <b-button
              size="sm"
              variant="secondary"
              @click="joinable.isVisiable = !joinable.isVisiable"
              >{{ joinable.isVisiable ? "Hide" : "Columns" }}</b-button
            >
            &nbsp;
            <b-button size="sm" variant="secondary" @click="openTable(joinable)"
              >Open</b-button
            >
          </span>
        </div>
        <b-list-group v-show="joinable.isVisiable">
          <b-list-group-item
            v-for="(column, i) in filterColumns(joinable)"
            :key="i"
          >
            <div class="d-flex w-100 justify-content-between">
              <span>{{ column.name }}</span>
              <span>
                <span>
                  <b-button
                    size="sm"
                    variant="primary"
                    @click="addColumn(joinable, column)"
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
    primaryColumn: {
      type: String,
      required: false,
    },
  },
  data: function () {
    return {
      resourcesHash: {},
      resourceStatsHash: {},
      joinableTables: [],
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
    primaryColumn: {
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
    sourceColumnSetHash() {
      const hash = [];
      for (let h of this.histories) {
        const resourceStats = h.resourceStats;
        hash[resourceStats.uuid] = new Set(
          resourceStats.schema.fields.map((field) => field.name)
        );
      }
      return hash;
    },
  },
  methods: {
    reloadData: async function () {
      this.isLoading = true;
      this.resourcesHash = {};
      this.resourceStatsHash = {};

      this.joinableTables.splice(0);
      for (let h of this.histories) {
        let primaryColumnIndex = null;
        if (this.primaryColumn) {
          for (let i = 0; i < h.resourceStats.schema.fields.length; ++i) {
            if (h.resourceStats.schema.fields[i].name === this.primaryColumn) {
              primaryColumnIndex = i;
              break;
            }
          }
        }
        if (isNaN(primaryColumnIndex)) {
          continue;
        }
        const url = `api/keyjoinscores/${h.table.id}?index=${primaryColumnIndex}`;
        const data = await axios.get(url).then((res) => res.data);

        data.resources.forEach((r) => {
          r.color = TableColorManger.getColor(r.id);
          this.resourcesHash[r.id] = r;
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
              isVisiable: false,
            });
          });
        });
      }
      this.isLoading = false;
    },
    openTable: async function (joinable) {
      const resource = joinable.target_resource;
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
    addColumn: async function (joinable, column) {
      this.$parent.$parent.addColumn(
        joinable.source_resource.id,
        joinable,
        column
      );
    },
    filterColumns: function (joinable) {
      return joinable.target_resourcestats.schema.fields.filter(
        (c) =>
          c.name !== joinable.target_field_name &&
          !this.sourceColumnSetHash[joinable.source_resource.id].has(c.name)
      );
    },
    getJoinedColumnName: function (joinable) {
      return joinable.target_resourcestats.schema.fields[joinable.target_index]
        .name;
    },
  },
};
</script>

<style lang="scss" scoped>
.joinable-table-header-container {
  margin-bottom: 10px;
}
</style>
