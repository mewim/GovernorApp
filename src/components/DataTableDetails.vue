<template>
  <div v-if="!!dataset">
    <div class="title-container">
      <h5>
        <div
          class="inline-color-block"
          :style="{ 'background-color': resource.color }"
        ></div>
        Table: {{ resource.name }}
      </h5>
      <a href="#" @click="isTableDetailsVisible = !isTableDetailsVisible"
        >[{{ isTableDetailsVisible ? "Hide" : "Show" }} Dataset Details]</a
      >
    </div>
    <b-collapse v-model="isTableDetailsVisible" class="mt-2">
      <b-card>
        <div>
          <b>Subjects: </b>
          <span
            class="badge rounded-pill bg-primary"
            v-for="(s, i) in dataset.subject"
            :key="i"
            >{{ s.replaceAll("_", " ") }}</span
          >
        </div>
        <p><b>UUID: </b>{{ resource.id }}</p>
        <p><b>Dataset: </b>{{ dataset.title }}</p>
        <p><b>Notes: </b>{{ dataset.notes }}</p>
        <p>
          <b>URL: </b>
          <a target="_blank" :href="getUrl(dataset.id)">{{
            getUrl(dataset.id)
          }}</a>
        </p>
      </b-card>
    </b-collapse>
  </div>
</template>

<script>
export default {
  name: "DataTableDetails",
  data: function () {
    return {
      isTableDetailsVisible: false,
    };
  },
  methods: {
    getUrl: function (uuid) {
      return "https://open.canada.ca/data/en/dataset/" + uuid;
    },
  },
  props: {
    dataset: Object,
    resource: Object,
  },
};
</script>

<style lang="scss" scoped>
.inline-color-block {
  height: 12px;
  width: 12px;
  display: inline-block;
}
</style>
