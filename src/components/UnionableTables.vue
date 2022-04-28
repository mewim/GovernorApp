<template>
  <div>
    <h5>Unionable Tables</h5>

    <div v-show="this.unionableTables.length !== 0">
      <a href="#" @click="isVisible = !isVisible"
        >[{{ isVisible ? "Hide" : "Show" }}]</a
      >
      <p></p>
    </div>
    <b-list-group v-show="this.unionableTables.length === 0 || isVisible">
      <b-list-group-item v-for="(unionable, i) in unionableTables" :key="i">
        <div class="d-flex w-100 justify-content-between">
          <span>{{ unionable.name }}</span>
          <span>
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
        Loading unionable tables...
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";
import TableColorManger from "../TableColorManager";

export default {
  name: "UnionableTables",
  data: function () {
    return {
      data: [],
      datasetHash: {},
      isLoading: false,
      isVisible: false,
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
          r.color = TableColorManger.getColor(r.id);
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
      this.$parent.$parent.$parent.openResource(openedResource, true);
    },
    unionTable: async function (resource) {
      const dataset = this.datasetHash[resource.id];
      const resourceStats = await axios
        .get(`/api/inferredstats/${resource.id}`)
        .then((res) => res.data);
      const unionable = {
        dataset: dataset,
        table: resource,
        visibleColumns: [],
        resourceStats,
      };
      this.$parent.$parent.addData(unionable);
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
