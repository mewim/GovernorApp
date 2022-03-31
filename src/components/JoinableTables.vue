<template>
  <div>
    <h5>Joinable Tables</h5>

    <div v-show="this.joinableTables.length !== 0">
      <a href="#" @click="isVisible = !isVisible"
        >[{{ isVisible ? "Hide" : "Show" }}]</a
      >
      <p></p>
    </div>
    <b-list-group v-show="this.joinableTables.length === 0 || isVisible">
      <b-list-group-item v-for="(joinable, i) in joinableTables" :key="i">
        <div class="d-flex w-100 justify-content-between">
          <span>{{ joinable.target_resource.name }}</span>
          <b-button
            size="sm"
            variant="primary"
            @click="joinTable(joinable)"
            >Join</b-button
          >
        </div>
        <small
          >Column: {{ joinable.target_field_name }} ({{
            joinable.score.toFixed(2)
          }})</small
        >
      </b-list-group-item>

      <b-list-group-item
        v-if="joinableTables.length === 0 && !isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        No joinable table has been found for this table.
      </b-list-group-item>

      <b-list-group-item
        v-if="isLoading"
        class="d-flex justify-content-between align-items-center"
      >
        Loading joinable tables...
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "JoinableTables",
  data: function () {
    return {
      resourcesHash: {},
      joinableTables: [],
      isLoading: false,
      isVisible: false,
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
  methods: {
    reloadData: async function () {
      this.isLoading = true;
      this.resourcesHash = {};
      this.joinableTables.splice(0);
      const url = `api/keyjoinscores/${this.resourceId}`;
      const data = await axios.get(url).then((res) => res.data);
      
      data.resources.forEach((r) => (this.resourcesHash[r.id] = r));
      data.results.forEach((d) => {
        d.targets.forEach((t) => {
          this.joinableTables.push({
            target_resource: this.resourcesHash[t.uuid],
            target_index: t.index,
            score: t.score,
            target_field_name: t.schema.field_name,
            source_index: d.index,
          });
        });
      });
      this.isLoading = false;
    },
    joinTable: function (joinable) {
      this.$parent.$parent.joinTable(joinable);
    },
  },
  props: {
    resourceId: String,
    sourceResourceStats: Object,
  },
};
</script>
