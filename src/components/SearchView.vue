<template>
  <div class="outer-container">
    <div class="searchbar-container">
      <div class="input-group mb-3">
        <b-form-input
          v-model="searchBarText"
          v-on:keyup.enter="searchButtonClicked()"
          placeholder="Enter a keyword / UUID"
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

          <b-button
            variant="success"
            class="search-button"
            v-on:click="openRandom()"
            >Open By ID</b-button
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
          <b-card v-for="(r, i) in results" :key="i">
            <template #header>
              <b>{{ r.title }}</b>
            </template>
            <b-card-text
              v-if="searchResultFields.matched_count && !searchMetadata"
            >
              <b> Matched Count:</b> {{ r.matched_count }}
            </b-card-text>
            <b-card-text v-if="searchResultFields.subjects">
              <b> Subjects:&nbsp;</b>
              <span
                class="badge rounded-pill bg-primary"
                v-for="(s, j) in r.subject"
                :key="j"
                >{{ s.replaceAll("_", " ") }}</span
              >
            </b-card-text>
            <b-card-text v-if="searchResultFields.portal_release_date">
              <b> Release Date:</b>
              {{ r.portal_release_date ? r.portal_release_date : "N/A" }}
            </b-card-text>
            <b-card-text>
              <b> Notes: </b>
              <a
                href="#"
                @click="r.display_notes = r.display_notes ? '' : r.notes"
              >
                {{ r.display_notes ? "Hide" : "Show" }}
              </a>
              <p>{{ r.display_notes }}</p>
            </b-card-text>

            <b-table
              hover
              :items="getFileTableItem(r.resources)"
              :fields="fileTableFields"
              :sort-by="'count'"
              outlined
              fixed
              small
            >
              <template #cell(file)="f">
                <a href="#" @click="fileSelected(r.id, f.item.id)">{{
                  f.item.file
                }}</a>
              </template>
            </b-table>
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
      isNotesDisplayed: [],
      searchResultFields: {
        dataset_title: true,
        languages: true,
        matched_columns: true,
        matched_count: true,
        subjects: false,
        portal_release_date: false,
      },
      jumpImmediately: true,
      selectedResource: null,
      selectedDataset: null,
      selectedResourceStats: null,
      searchSuccess: false,
      showTabArea: false,
      loadingInstance: null,
      searchMetadata: false,
    };
  },
  watch: {
    showAllRows: function (newValue) {
      this.$parent.setShowAllRows(this.selectedResource.id, newValue);
    },
  },
  computed: {
    fileTableFields: function () {
      const result = [
        {
          key: "file",
          sortable: true,
        },
      ];
      if (this.searchResultFields.languages) {
        result.push({
          key: "language",
          sortable: true,
        });
      }
      if (this.searchResultFields.matched_count && !this.searchMetadata) {
        result.push({
          key: "count",
          sortable: true,
        });
      }
      if (this.searchResultFields.matched_columns && !this.searchMetadata) {
        result.push({
          key: "matched_columns",
        });
      }
      return result;
    },
  },
  methods: {
    getFileTableItem: function (resources) {
      return resources.map((r) => {
        return {
          file: r.name,
          language: r.language.join(", "),
          matched_columns: r.matches.columns.join(", "),
          count: r.matches.count,
          id: r.id,
        };
      });
    },
    toggleSettings: function () {
      this.$refs.searchResultSettingsModal.show();
    },
    shouldShowNotes: function (i) {
      console.log("shouldShowNotes", i, this.isNotesDisplayed[i]);
      return this.isNotesDisplayed[i];
    },
    toggleNotesDisplayed: function (i) {
      console.log(i);
      this.isNotesDisplayed[i] = !this.isNotesDisplayed[i];
      console.log(this.isNotesDisplayed[i]);
    },
    searchButtonClicked: async function (searchMetadata) {
      this.searchSuccess = false;
      this.searchMetadata = searchMetadata;
      if (this.searchBarText.length === 0) {
        this.results.splice(0);
        this.searchSuccess = true;
        return;
      }
      await this.loadSeachResult(this.searchBarText, searchMetadata);

      this.searchSuccess = true;
    },
    closeDatasetDescription: function () {
      this.selectedResource = null;
      this.selectedDataset = null;
      this.selectedResourceStats = null;
    },
    loadSeachResult: async function (keyword, searchMetadata) {
      this.results.splice(0);
      this.isNotesDisplayed.splice(0);
      const url = searchMetadata ? "/api/search/metadata" : "/api/search/";
      this.loadingInstance.show();
      const params = new URLSearchParams([["q", keyword]]);
      const results = await axios.get(url, { params }).then((res) => res.data);
      results.forEach((r) => {
        r.display_notes = "";
        this.results.push(r);
        this.isNotesDisplayed.push(false);
      });
      this.loadingInstance.close();
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
          searchMetadata: this.searchMetadata,
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
  padding-left: 10px;
  padding-right: 10px;

  div.card {
    &.active {
      > .card-header {
        border-radius: calc(0.25rem - 1px) calc(0.25rem - 1px) 0 0 !important;
        background-color: var(--bs-blue) !important;
        a {
          color: white !important;
        }
      }
    }
    min-width: 1000px;
    border: 1px solid rgba(0, 0, 0, 0.125) !important;
    border-radius: calc(0.25rem - 1px) calc(0.25rem - 1px) 0 0 !important;
    margin-right: 10px;
    margin-bottom: 10px;
    p {
      margin-bottom: 4px;
    }
  }
}
.sr-only {
  display: none;
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
