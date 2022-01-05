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
            >Search Tuples</b-button
          >
          <b-button
            variant="success"
            class="search-button"
            v-on:click="searchButtonClicked(true)"
            >Search Metadata</b-button
          >
        </div>
      </div>
    </div>
    <div class="search-result-container" v-if="searchSuccess">
      <div
        class="search-no-result"
        v-if="searchSuccess && results.length === 0"
      >
        Sorry, no table has been found. Please try other keywords.
      </div>
      <div
        class="search-result-cards-container"
        v-if="searchSuccess && results.length > 0"
      >
        <b-card-group>
          <b-card v-for="(r, i) in searchResultTableItems" :key="i">
            <template #header>
              <a href="#" @click="fileSelected(r.dataset_id, r.id)"
                ><b>{{ r.file_title }}</b></a
              >
            </template>
            <b-card-text v-if="searchResultFields.dataset_title">
              <b>Dataset:</b>
              <a target="_blank" :href="getUrl(r.dataset_id)">
                {{ r.dataset_title }}
              </a>
            </b-card-text>
            <b-card-text v-if="searchResultFields.matched_count">
              <b> Matched Count:</b> {{ r.matched_count }}
            </b-card-text>
            <b-card-text v-if="searchResultFields.matched_columns">
              <b> Matched Columns:</b> {{ r.matched_columns.join(", ") }}
            </b-card-text>
            <b-card-text v-if="searchResultFields.languages">
              <b> Languages:</b> {{ r.languages.join(", ") }}
            </b-card-text>
            <b-card-text v-if="searchResultFields.subjects">
              <b> Subjects:&nbsp;</b>
              <span
                class="badge rounded-pill bg-primary"
                v-for="(s, i) in r.subject"
                :key="i"
                >{{ s.replaceAll("_", " ") }}</span
              >
            </b-card-text>
            <b-card-text v-if="searchResultFields.portal_release_date">
              <b> Release Date:</b>
              {{ r.portal_release_date ? r.portal_release_date : "N/A" }}
            </b-card-text>
            <b-card-text v-if="searchResultFields.notes">
              <b> Notes:</b>
              {{ r.notes ? r.notes : "N/A" }}
            </b-card-text>
          </b-card>
        </b-card-group>
      </div>
    </div>
    <b-modal
      ref="searchResultSettingsModal"
      title="Settings"
      ok-only
      :hideHeaderClose="true"
      :centered="true"
    >
      <div class="search-results-fields-toggle-container">
        <b>Search Results Fields</b>
        <b-form-checkbox v-model="searchResultFields.dataset_title">
          Dataset
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.matched_count">
          Matched Count
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.matched_columns">
          Matched Columns
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.languages">
          Languages
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.subjects">
          Subjects
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.portal_release_date">
          Release Date
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.notes">
          Notes
        </b-form-checkbox>

        <b>Navigation Option</b>
        <b-form-checkbox v-model="jumpImmediately">
          Jump to table immediately upon open
        </b-form-checkbox>
      </div>
    </b-modal>
  </div>
</template>

<script>
import axios from "axios";
import { VeLoading } from "vue-easytable";

export default {
  name: "Search",
  data() {
    return {
      searchBarText: "",
      results: [],
      searchResultFields: {
        dataset_title: true,
        languages: true,
        matched_columns: true,
        matched_count: true,
        subjects: false,
        portal_release_date: false,
        notes: false,
      },
      jumpImmediately: true,
      selectedResource: null,
      selectedDataset: null,
      selectedResourceStats: null,
      previewAreaHeight: 0,
      searchSuccess: false,
      showTabArea: false,
      loadingInstance: null,
    };
  },
  watch: {
    showAllRows: function (newValue) {
      this.$parent.setShowAllRows(this.selectedResource.id, newValue);
    },
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
            portal_release_date: r.portal_release_date,
            matched_columns: rs.matches.columns,
            matched_count: rs.matches.count,
            subject: r.subject,
            notes: r.notes,
          });
        });
      });
      items.sort((a, b) => b.matched_count - a.matched_count);
      return items;
    },
  },
  methods: {
    toggleSettings: function () {
      this.$refs.searchResultSettingsModal.show();
    },
    searchButtonClicked: async function (searchMetadata) {
      if (this.searchBarText.length === 0) {
        this.results = [];
        this.searchSuccess = true;
        return;
      }
      this.results = await this.loadSeachResult(
        this.searchBarText,
        searchMetadata
      );
      this.searchSuccess = true;
    },
    closeDatasetDescription: function () {
      this.selectedResource = null;
      this.selectedDataset = null;
      this.selectedResourceStats = null;
    },
    loadSeachResult: async function (keyword, searchMetadata) {
      const url = searchMetadata ? "/api/search/metadata" : "/api/search/";
      this.loadingInstance.show();
      const params = new URLSearchParams([["q", keyword]]);
      const results = await axios.get(url, { params }).then((res) => res.data);
      this.loadingInstance.close();
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
      this.$parent.openResource(
        {
          resource: this.selectedResource,
          dataset: this.selectedDataset,
          resourceStats: this.selectedResourceStats,
        },
        this.jumpImmediately
      );
    },
    getUrl: function (uuid) {
      return "https://open.canada.ca/data/en/dataset/" + uuid;
    },
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$el,
      lock: true,
      name: "wave",
    });
  },
  destroyed() {
    this.loadingInstance.destroy();
    this.loadingInstance = null;
  },
};
</script>

<style lang="scss">
.outer-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.searchbar-container {
  margin-left: 10px;
  margin-right: 10px;
  margin-top: 10px;
}
.search-result-container {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  flex-grow: 2;
  height: 100%;
}
.search-result-cards-container {
  flex-grow: 1;
  overflow-y: scroll;
  margin-left: 10px;
  div.card {
    &.active {
      > .card-header {
        border-radius: calc(0.25rem - 1px) calc(0.25rem - 1px) 0 0 !important;
        background-color: #007bff !important;
        a {
          color: #ffffff !important;
        }
      }
    }
    min-width: 500px;
    border: 1px solid rgba(0, 0, 0, 0.125) !important;
    border-radius: calc(0.25rem - 1px) calc(0.25rem - 1px) 0 0 !important;
    margin-right: 10px;
    margin-bottom: 10px;
    p {
      margin-bottom: 4px;
    }
  }
}

.search-result-container > .b-table-sticky-header {
  overflow: scroll;
  flex-grow: 1;
  margin-bottom: 0;
}
span {
  margin-right: 2px;
}
.tab-content {
  min-height: 100%;
}
.search-no-result {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}
div.search-results-fields-toggle-container {
  label {
    padding-left: 8px;
  }
}
.search-button {
  margin-right: 2px;
  &:first-child {
    margin-left: 6px;
  }
  &:last-child {
    margin-right: 0;
  }
}
</style>
