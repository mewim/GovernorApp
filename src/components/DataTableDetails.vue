<template>
  <div v-if="!!dataset">
    <div class="title-container">
      <h5>
        <div
          class="inline-color-block"
          :style="{ 'background-color': resource.color }"
        ></div>
        Original Table: {{ resource.name }}
      </h5>
      <a href="#" @click="isTableDetailsVisible = !isTableDetailsVisible"
        >[{{ isTableDetailsVisible ? "Hide" : "Show" }} Dataset Details]</a
      >
    </div>
    <b-collapse v-model="isTableDetailsVisible" class="mt-2">
      <b-card>
        <p><b>UUID: </b>{{ dataset.id }}</p>
        <p><b>Dataset: </b>{{ dataset.title }}</p>
        <p><b>Notes: </b>{{ dataset.notes }}</p>
        <p>
          <b>URL: </b>
          <a target="_blank" :href="getUrl(dataset.id)">{{
            getUrl(dataset.id)
          }}</a>
        </p>

        <p v-for="field in fields" :key="field.name">
          <b> {{ field.displayName }}:</b>
          <span v-if="field.type === 'text'">
            {{
              getField(dataset, field.fieldName)
                ? getField(dataset, field.fieldName)
                : "N/A"
            }}
          </span>

          <span v-if="field.type === 'date'">
            {{
              getField(dataset, field.fieldName)
                ? formatDate(getField(dataset, field.fieldName))
                : "N/A"
            }}
          </span>

          <span v-if="field.type === 'list'">
            {{ " " }}
            <span
              class="badge rounded-pill bg-primary"
              v-for="(s, j) in getField(dataset, field.fieldName)"
              :key="j"
              >{{ s }}</span
            ></span
          >
        </p>
      </b-card>
    </b-collapse>
  </div>
</template>

<script>
import Common from "../Common";
import { frontend as frontendConfig } from "../../app.config.json";

export default {
  name: "DataTableDetails",
  data: function () {
    return {
      isTableDetailsVisible: false,
      fields: frontendConfig.preview.fields,
    };
  },
  methods: {
    getUrl: function (uuid) {
      return Common.getDatasetUrl(uuid);
    },
    getField: function (object, field) {
      return Common.getField(object, field);
    },
    formatDate: function (date) {
      return Common.formatDate(date);
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
