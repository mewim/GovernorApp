<template>
  <div>
    <b-list-group v-show="this.joinableTables.length === 0 || isLoading">
      <b-list-group-item
        v-if="joinableTables.length === 0 && !isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        No foreign column has been found for this table.
      </b-list-group-item>
      <b-list-group-item
        v-if="isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        Loading...
      </b-list-group-item>
    </b-list-group>

    <div v-for="(joinable, i) in joinableTables" :key="i">
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
          <!-- <b-button size="sm" variant="secondary" @click="openTable(joinable)"
            >Open</b-button
          > -->
        </span>
      </div>

      <b-list-group>
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

      <br />
    </div>
  </div>
</template>

<script>
import axios from "axios";
import TableColorManger from "../TableColorManager";

export default {
  name: "JoinableTables",
  props: {
    resourceId: String,
    sourceResourceStats: Object,
    showJoinButton: { type: Boolean, default: false },
  },
  data: function () {
    return {
      resourcesHash: {},
      resourceStatsHash: {},
      joinableTables: [],
      isLoading: false,
    };
  },
  watch: {
    resourceId: {
      immediate: true,
      handler: function () {
        this.reloadData();
      },
    },
  },
  computed: {
    sourceColumnSet() {
      return new Set(
        this.sourceResourceStats.schema.fields.map((field) => field.name)
      );
    },
  },
  methods: {
    reloadData: async function () {
      this.isLoading = true;
      this.resourcesHash = {};
      this.resourceStatsHash = {};

      this.joinableTables.splice(0);
      const url = `api/joinable/${this.resourceId}`;
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
          });
        });
      });
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
      console.log(joinable, column);
    },
    filterColumns: function (joinable) {
      return joinable.target_resourcestats.schema.fields.filter(
        (c) =>
          c.name !== joinable.target_field_name &&
          !this.sourceColumnSet.has(c.name)
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.joinable-table-header-container {
  margin-bottom: 10px;
}
</style>
