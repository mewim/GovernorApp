<template>
  <div class="outer-container">
    <div class="searchbar-container">
      <div class="input-group mb-3">
        <b-form-input
          v-model.lazy="searchBarText"
          v-on:keyup.enter="searchButtonClicked()"
          :placeholder="uuidPlaceHolder"
        />
        <div class="input-group-append">
          <b-button
            variant="success"
            class="search-button"
            v-on:click="searchButtonClicked()"
            title="Search by matching the values in the cells of the original table"
            v-b-tooltip.hover
            >Search Tuples
          </b-button>
          <b-button
            variant="success"
            class="search-button"
            v-on:click="searchButtonClicked(true)"
            title="Search by matching the description and title of the dataset or original table"
            v-b-tooltip.hover
            >Search Description
          </b-button>
          <b-button
            variant="success"
            class="search-button"
            v-on:click="searchButtonClicked(true, true)"
            v-if="settings.uuidEnabled"
            title="Search by matching the UUID of the dataset or original table"
            v-b-tooltip.hover
            >Search UUID
          </b-button>
        </div>
      </div>
    </div>
    <div class="search-result-container" v-if="searchSuccess">
      <div
        class="search-no-result"
        v-if="searchSuccess && results.length === 0"
      >
        Sorry, no table has been found. Please try other keywords{{
          settings.uuidEnabled ? " or UUID" : ""
        }}.
      </div>
      <div
        class="search-result-cards-container"
        v-if="searchSuccess && results.length > 0"
      >
        <b-card v-for="(r, i) in results" :key="i">
          <template #header>
            <b>Dataset: {{ r.title }}</b>
          </template>
          <b-card-text
            v-if="settings.searchResultFields.matched_count && !searchMetadata"
          >
            <b> Matched Count:</b> {{ r.matched_count }}
          </b-card-text>
          <b-card-text v-if="settings.searchResultFields.subjects">
            <b> Subjects:&nbsp;</b>
            <span
              class="badge rounded-pill bg-primary"
              v-for="(s, j) in r.subject"
              :key="j"
              >{{ s.replaceAll("_", " ") }}</span
            >
          </b-card-text>
          <b-card-text v-if="settings.searchResultFields.portal_release_date">
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
          <div class="file-description-cards-outer-container">
            <div class="file-description-cards-container">
              <b-card
                v-for="(res, i) in r.resources"
                :key="i"
                class="mb-2 file-description-card"
              >
                <b-card-text
                  class="file-description-card-title"
                  :id="res.id + '-title'"
                  ><a href="#" @click="fileSelected(r.id, res.id)"
                    >Table: {{ res.name }}</a
                  ></b-card-text
                >
                <b-tooltip
                  placement="right"
                  :target="res.id + '-title'"
                  triggers="hover"
                >
                  Open file: <i>{{ res.name }}</i>
                </b-tooltip>
                <b-card-text
                  class="file-description-card-description"
                  v-if="settings.searchResultFields.languages"
                >
                  <b> Language{{ res.language.length > 1 ? "s" : "" }}: </b>
                  {{ res.language.join(", ") }}
                </b-card-text>
                <b-card-text
                  class="file-description-card-description"
                  v-if="
                    settings.searchResultFields.matched_count && !searchMetadata
                  "
                >
                  <b>
                    {{ res.matches.count }} match{{
                      res.matches.count > 1 ? "es" : ""
                    }}</b
                  >
                  on
                  <span
                    style="font-style: italic"
                    >{{res.matches.columns.join(", "),}}</span
                  >
                </b-card-text>
              </b-card>
            </div>
          </div>
        </b-card>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import adddashestouuid from "add-dashes-to-uuid";
import { VeLoading } from "vue-easytable";
const uuid = require("uuid");
import Common from "../Common";

export default {
  name: "Search",
  data() {
    return {
      searchBarText: "",
      keyword: "",
      results: [],
      isNotesDisplayed: [],
      selectedResource: null,
      selectedDataset: null,
      selectedResourceStats: null,
      searchSuccess: false,
      loadingInstance: null,
      searchMetadata: false,
    };
  },
  props: {
    settings: {
      type: Object,
      required: true,
    },
  },
  computed: {
    uuidPlaceHolder() {
      return this.settings.uuidEnabled
        ? "Enter a keyword / UUID to search"
        : "Enter a keyword to search";
    },
  },
  methods: {
    shouldShowNotes: function (i) {
      return this.isNotesDisplayed[i];
    },
    toggleNotesDisplayed: function (i) {
      this.isNotesDisplayed[i] = !this.isNotesDisplayed[i];
    },
    searchButtonClicked: async function (isSearchMetadata, isSearchUUID) {
      this.searchSuccess = false;
      this.keyword = this.searchBarText;
      this.searchMetadata = isSearchMetadata;
      if (isSearchUUID) {
        this.searchBarText = this.searchBarText.trim();
        if (
          this.searchBarText.length === 32 &&
          /[0-9A-Fa-f]{32}/g.test(this.searchBarText)
        ) {
          this.searchBarText = adddashestouuid(this.searchBarText);
        }
        if (
          this.searchBarText.length === 36 &&
          uuid.validate(this.searchBarText)
        ) {
          this.searchBarText = this.searchBarText.toLowerCase();
        } else {
          this.results.splice(0);
          this.searchSuccess = true;
          return;
        }
      }
      if (this.searchBarText.length === 0) {
        this.results.splice(0);
        this.searchSuccess = true;
        return;
      }
      await this.loadSeachResult(this.searchBarText, isSearchMetadata);

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
          keyword: this.searchMetadata ? null : this.keyword,
        },
        this.settings.jumpImmediately
      );
    },
    getUrl: function (uuid) {
      return Common.getDatasetUrl(uuid);
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
.file-description-cards-outer-container {
  position: relative;
  .file-description-cards-container {
    display: flex;
    max-width: 100%;
    position: relative;
    overflow: auto;
    .file-description-card {
      min-width: 20rem;
      max-width: 20rem;
      .file-description-card-title.card-text {
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
      }
      .file-description-card-description.card-text {
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
      }
    }
  }
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
