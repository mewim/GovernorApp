<template>
  <div>
    <b-list-group>
      <b-list-group-item v-for="(unionable, i) in unionableTables" :key="i">
        <div class="d-flex w-100 justify-content-between">
          <span>{{ unionable.name }}</span>
          <span style="min-width: 124px">
            <b-button size="sm" variant="primary" @click="openTable(unionable)"
              >Open</b-button
            >
            <span v-if="showUnionButton">
              &nbsp;
              <b-button
                size="sm"
                variant="primary"
                @click="unionTable(unionable)"
                >Union</b-button
              >
            </span>
          </span>
        </div>
        <small>From: {{ datasetHash[unionable.id].title }} </small>
      </b-list-group-item>

      <b-list-group-item
        v-if="unionableTables.length === 0 && !isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        No unionable table has been found for this table.
      </b-list-group-item>

      <b-list-group-item
        v-if="isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        Loading ...
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";
import TableColorManager from "../TableColorManager";

export default {
  name: "UnionableTables",
  data: function () {
    return {
      data: [],
      datasetHash: {},
      isLoading: false,
    };
  },
  watch: {
    resourceIds: {
      immediate: true,
      deep: true,
      handler: function () {
        this.reloadData();
      },
    },
  },
  computed: {
    unionableTables: function () {
      const flattendData = [];
      this.data.forEach((d) => {
        d.resources.forEach((r) => {
          flattendData.push(r);
        });
      });
      return flattendData;
    },
  },
  methods: {
    reloadData: async function () {
      this.isLoading = true;
      this.unionableTables.splice(0);
      this.datasetHash = {};
      const url = `api/unionable/${this.resourceIds.join(",")}`;
      const data = await axios.get(url).then((res) => res.data);
      data.forEach((d) => {
        d.resources.forEach((r) => {
          this.datasetHash[r.id] = d;
        });
      });
      this.data = data;
      this.isLoading = false;
    },
    openTable: async function (resource) {
      const dataset = this.datasetHash[resource.id];
      const resourceStats = await axios
        .get(`/api/inferredstats/${resource.id}`)
        .then((res) => res.data);
      const openedResource = {
        resource,
        dataset,
        resourceStats,
      };
      this.$parent.$parent.$parent.$parent.openResource(openedResource, true);
    },
    unionTable: async function (resource) {
      const dataset = this.datasetHash[resource.id];
      const resourceStats = await axios
        .get(`/api/inferredstats/${resource.id}`)
        .then((res) => res.data);
      resource.color = TableColorManager.getColor(resource.id);
      const unionable = {
        dataset: dataset,
        table: resource,
        resourceStats,
      };
      this.$parent.$parent.$parent.addData(unionable, []);
    },
  },
  props: {
    resourceIds: Array,
    showUnionButton: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
