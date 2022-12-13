<template>
  <b-list-group-item v-if="!!h">
    <b
      >Dataset:
      <a
        target="_blank"
        :href="getDatasetUrl(h.dataset)"
        v-b-tooltip.hover
        :title="`Jump to dataset on ${portal.siteName}`"
      >
        <i>{{ h.dataset.title }}</i></a
      >
    </b>

    <div class="d-flex w-100">
      <span>
        <div>
          <span>
            <div
              class="inline-color-block"
              :style="{ 'background-color': h.table.color }"
            ></div>
            &nbsp;
            <a
              href="#"
              @click="openResource(h.table, h.dataset, h.resourceStats)"
              v-b-tooltip.hover
              title="Open table"
              >{{ h.table.name }}</a
            ></span
          >
        </div>
      </span>
    </div>
    <div v-if="h.joinedTables">
      <div v-for="(j, k) in h.joinedTables" :key="k">
        <small style="display: flex; width: 100%; white-space: nowrap">
          <div style="flex-grow: 1">
            <div
              class="inline-color-block"
              :style="{ 'background-color': j.targetResource.color }"
            ></div>
            &nbsp; Joined Table:
            <a
              href="#"
              v-b-tooltip.hover
              title="Open table"
              @click="
                openResource(j.targetResource, h.dataset, j.targetResourceStats)
              "
              >{{ j.targetResource.name }}</a
            >
          </div>
          <div
            style="overflow: hidden"
            :title="getKeyDescription(j)"
            v-b-tooltip.hover.html="getKeyDescriptionHTML(j)"
          >
            &emsp;&emsp;
            {{ getKeyDescription(j) }}
          </div>
        </small>
      </div>
    </div>
  </b-list-group-item>
</template>

<script>
import Common from "../Common";
import { portal } from "../../app.config.json";

export default {
  data() {
    return {
      portal,
    };
  },
  props: {
    h: Object,
  },
  watch: {},

  methods: {
    getDatasetUrl(dataset) {
      return Common.getDatasetUrl(dataset.id);
    },
    openResource(resource, dataset, resourceStats) {
      this.$emit("open-resource", { resource, dataset, resourceStats });
    },
    getKeyDescription(j) {
      return j.sourceKey === j.targetKey
        ? `(Join Key: ${j.sourceKey})`
        : `(Primary Key: ${j.sourceKey}; Foreign Key: ${j.targetKey})`;
    },
    getKeyDescriptionHTML(j) {
      return j.sourceKey === j.targetKey
        ? `<b>Join Key:</b> ${j.sourceKey}`
        : `
            <b>Primary Key:</b> ${j.sourceKey} 
            <br>
            <b>Foreign Key:</b> ${j.targetKey}
          `;
    },
  },
};
</script>

<style lang="scss" scoped>
.float-right {
  float: right;
}
</style>
