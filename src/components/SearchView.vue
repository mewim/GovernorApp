<template>
  <div class="outer-container">
    <div class="searchbar-container">
      <div class="input-group mb-3">
        <b-form-input
          v-model="searchBarText"
          v-on:keyup.enter="searchButtonClicked()"
          placeholder="Enter a keyword"
        ></b-form-input>
        <div class="input-group-append">
          <b-button
            variant="success"
            class="search-button"
            v-on:click="searchButtonClicked()"
            >Search</b-button
          >
        </div>
      </div>
    </div>
    <div class="search-result-container" v-if="!!results && results.length > 0">
      <b-table
        hover
        sticky-header="100%"
        :items="searchResultTableItems"
        :fields="searchResultFields"
      >
        <template #cell(languages)="data">
          {{ data.item.languages.join(", ") }}
        </template>

        <template #cell(matched_columns)="data">
          {{ data.item.matched_columns.join(", ") }}
        </template>

        <template #cell(file_title)="data">
          <a
            href="#"
            @click="fileSelected(data.item.dataset_id, data.item.id)"
            >{{ data.item.dataset_title }}</a
          >
        </template>
      </b-table>

      <div class="dataset-description-container" v-if="!!selectedDataset">
        <div>
          <h4>
            Release Date
            <span class="dataset-description-buttons-container">
              <b-button
                size="sm"
                variant="primary"
                @click="previewFile(selectedResource.id)"
                >Preview</b-button
              >
              <b-button
                size="sm"
                variant="danger"
                @click="closeDatasetDescription()"
                >Close</b-button
              >
            </span>
          </h4>
        </div>
        <p>{{ selectedDataset.portal_release_date }}</p>
        <p></p>

        <h4>Subjects</h4>
        <div>
          <span
            class="badge rounded-pill bg-primary"
            v-for="(s, i) in selectedDataset.subject"
            :key="i"
            >{{ s.replaceAll("_", " ") }}</span
          >
        </div>
        <p></p>
        <h4>Notes</h4>
        <p>{{ selectedDataset.notes }}</p>

        <p></p>
        <h4>URL</h4>
        <a target="_blank" :href="getUrl(selectedDataset.id)">{{
          getUrl(selectedDataset.id)
        }}</a>
        <div v-if="!!selectedResourceStats">
          <p></p>
          <h4>Number of Rows</h4>
          <p>{{ selectedResourceStats.tuples_count }}</p>

          <p></p>
          <h4>Inferred Schema</h4>
          <b-table
            striped
            :items="selectedResourceStats.schema.fields"
            :fields="schemaFields"
          >
          </b-table>
        </div>
      </div>
    </div>

    <div
      class="table-preview-container"
      v-if="!!previewTableId"
      ref="tablePreviewContainer"
    >
      <data-table :height="previewAreaHeight" :tableId="previewTableId" />
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "Search",
  data() {
    return {
      searchBarText: "",
      results: [],
      searchResultFields: [
        "file_title",
        "dataset_title",
        "languages",
        "matched_columns",
        "matched_count",
      ],
      schemaFields: ["name", "type"],
      selectedResource: null,
      selectedDataset: null,
      selectedResourceStats: null,
      previewTableId: null,
      previewAreaHeight: 0,
    };
  },
  computed: {
    searchResultTableItems: function () {
      const items = [];
      this.results.forEach((r) => {
        r.resources.forEach((rs) => {
          items.push({
            id: rs.id,
            dataset_title: r.title,
            file_title: rs.name,
            languages: rs.language,
            dataset_id: r.id,
            matched_columns: rs.matches.columns,
            matched_count: rs.matches.count,
          });
        });
      });
      items.sort((a, b) => b.matched_count - a.matched_count);
      return items;
    },
  },
  methods: {
    searchButtonClicked: async function () {
      this.closeDatasetDescription();
      if (this.searchBarText.length === 0) {
        this.results = [];
        return;
      }
      this.results = await this.loadSeachResult(this.searchBarText);
    },
    closeDatasetDescription: function () {
      this.selectedResource = null;
      this.selectedDataset = null;
      this.selectedResourceStats = null;
    },
    previewFile: function (uuid) {
      this.previewTableId = uuid;
      this.$nextTick(() => {
        this.updatePreviewAreaHeight();
      });
    },
    loadSeachResult: async function (keyword) {
      const params = new URLSearchParams([["q", keyword]]);
      const results = await axios
        .get(`/api/search`, { params })
        .then((res) => res.data);
      return results;
    },
    getInferredStats: function (fileId) {
      return axios.get(`/api/inferredstats/${fileId}`).then((res) => res.data);
    },
    fileSelected: async function (datasetId, fileId) {
      this.selectedDataset = this.results.filter((r) => r.id === datasetId)[0];
      this.selectedResource = this.selectedDataset.resources.filter(
        (r) => r.id === fileId
      )[0];
      this.selectedResourceStats = await this.getInferredStats(fileId);
    },
    getUrl: function (uuid) {
      return "https://open.canada.ca/data/en/dataset/" + uuid;
    },
    updatePreviewAreaHeight: function () {
      if (!this.$refs.tablePreviewContainer) {
        this.previewAreaHeight = 0;
      }
      this.previewAreaHeight =
        this.$refs.tablePreviewContainer.getBoundingClientRect().height;
    },
  },
  created() {
    window.addEventListener("resize", this.updatePreviewAreaHeight);
  },
  destroyed() {
    window.removeEventListener("resize", this.updatePreviewAreaHeight);
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.outer-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.search-result-container {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  flex-grow: 1;
}
a {
  color: #42b983;
}
.dataset-description-container {
  flex-basis: 33.33%;
  padding-left: 10px;
  overflow-y: scroll;
}
.dataset-description-buttons-container {
  float: right;
}
.dataset-description-buttons-container > button:first-child {
  margin-right: 4px;
}
.search-result-container > .b-table-sticky-header {
  flex-basis: 66.66%;
  overflow: scroll;
  flex-grow: 1;
}
.table-preview-container {
  padding-top: 4px;
  min-height: 40%;
  max-height: 40%;
}
span {
  margin-right: 2px;
}
</style>
