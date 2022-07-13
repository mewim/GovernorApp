<template>
  <b-list-group-item v-if="!!h">
    <b
      >Dataset:
      <a
        target="_blank"
        :href="getDatasetUrl(h.dataset)"
        v-b-tooltip.hover
        title="Jump to dataset on open.canada.ca"
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
        <small>
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
          <span class="float-right">
            {{
              j.sourceKey === j.targetKey
                ? `(Join Key: ${j.sourceKey})`
                : `(Primary Key: ${j.sourceKey}; Foreign Key: ${j.targetKey})`
            }}
          </span>
        </small>
      </div>
    </div>
  </b-list-group-item>
</template>

<script>
import Common from "../Common";

export default {
  data() {
    return {};
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
  },
};
</script>

<style lang="scss" scoped>
.float-right {
  float: right;
}
</style>
