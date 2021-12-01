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
          <b-button
            variant="primary"
            class="search-button"
            v-on:click="searchButtonClicked()"
            v-if="searchSuccess && results.length > 0"
          >
            <b-icon icon="gear-fill"></b-icon>
          </b-button>
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
            <b-card-text>
              <b>Dataset:</b>
              <a target="_blank" :href="getUrl(r.dataset_id)">
                {{ r.dataset_title }}
              </a>
            </b-card-text>
            <b-card-text>
              <b> Matched Count:</b> {{ r.matched_count }}
            </b-card-text>
            <b-card-text>
              <b> Matched Columns:</b> {{ r.matched_columns.join(", ") }}
            </b-card-text>
            <b-card-text>
              <b> Languages:</b> {{ r.languages.join(", ") }}
            </b-card-text>
            <b-card-text>
              <b> Subjects:&nbsp;</b>
              <span
                class="badge rounded-pill bg-primary"
                v-for="(s, i) in r.subject"
                :key="i"
                >{{ s.replaceAll("_", " ") }}</span
              >
            </b-card-text>
          </b-card>
        </b-card-group>
      </div>
      <div class="dataset-description-container" v-if="!!selectedDataset">
        <div>
          <h4>
            Release Date
            <span class="dataset-description-buttons-container">
              <b-icon @click="closeDatasetDescription()" icon="x"></b-icon>
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
          <h4>
            Data
            <span class="dataset-description-buttons-container">
              <b-button size="sm" @click="showAllRows = !showAllRows">{{
                toggleRowText
              }}</b-button>
              <b-button
                size="sm"
                variant="primary"
                @click="previewFile(selectedResource.id)"
                >Open</b-button
              >
            </span>
          </h4>

          <b-table
            ref="schemaFieldsTable"
            :items="selectedResourceStats.schema.fields"
            :fields="schemaFields"
            selectable
            @row-selected="schemaFieldsTableRowSelected"
          >
            <template #cell(selected)="{ rowSelected }">
              <template v-if="rowSelected">
                <span class="schema-table-span" aria-hidden="true"
                  >&check;</span
                >
              </template>
              <template v-else>
                <span class="schema-table-span" aria-hidden="true">&nbsp;</span>
              </template>
            </template>
          </b-table>
        </div>
      </div>
    </div>

    <div
      class="table-preview-container"
      v-show="showTabArea"
      ref="tablePreviewContainer"
      :class="{ 'table-content-hidden': !tableViewDisplayed }"
    >
      <data-table-tabs
        ref="dataTableTabs"
        v-on:showTabAreaChanged="showTabArea = !showTabArea"
        v-on:tableViewDisplayed="tableViewDisplayed = !tableViewDisplayed"
      />
    </div>
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
      searchResultFields: [
        "file_title",
        "dataset_title",
        "languages",
        "matched_columns",
        "matched_count",
      ],
      schemaFields: [
        { key: "selected", label: "✓" },
        { key: "name", label: "Inferred Column Name" },
        { key: "type", label: "Inferred Column Type" },
      ],
      selectedResource: null,
      selectedDataset: null,
      selectedResourceStats: null,
      previewAreaHeight: 0,
      selectedFields: [],
      showAllRows: false,
      searchSuccess: false,
      openedResources: {},
      showTabArea: false,
      loadingInstance: null,
      tableViewDisplayed: true,
    };
  },
  watch: {
    showAllRows: function (newValue) {
      this.$refs.dataTableTabs.setShowAllRows(
        this.selectedResource.id,
        newValue
      );
    },
  },
  computed: {
    toggleRowText: function () {
      if (this.showAllRows) {
        return "Show Matched Rows";
      }
      return "Show All Rows";
    },
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
            subject: r.subject,
          });
        });
      });
      items.sort((a, b) => b.matched_count - a.matched_count);
      return items;
    },
  },
  methods: {
    schemaFieldsTableRowSelected: function (rows) {
      this.selectedFields = rows.map((r) => r.name);
      this.$refs.dataTableTabs.setSelectedFields(
        this.selectedResource.id,
        this.selectedFields
      );
    },
    searchButtonClicked: async function () {
      this.closeDatasetDescription();
      if (this.searchBarText.length === 0) {
        this.results = [];
        this.searchSuccess = true;
        return;
      }
      this.results = await this.loadSeachResult(this.searchBarText);
      this.searchSuccess = true;
    },
    closeDatasetDescription: function () {
      this.selectedResource = null;
      this.selectedDataset = null;
      this.selectedResourceStats = null;
    },
    previewFile: function () {
      this.$refs.dataTableTabs.openResource({
        resource: this.selectedResource,
        showAllRows: this.showAllRows,
        selectedFields: this.selectedFields,
      });
    },
    loadSeachResult: async function (keyword) {
      this.loadingInstance.show();
      const params = new URLSearchParams([["q", keyword]]);
      const results = await axios
        .get(`/api/search`, { params })
        .then((res) => res.data);
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
      this.$nextTick(() => {
        const matchedColumns = new Set(this.selectedResource.matches.columns);
        for (
          let i = 0;
          i < this.selectedResourceStats.schema.fields.length;
          ++i
        ) {
          if (
            matchedColumns.has(this.selectedResourceStats.schema.fields[i].name)
          ) {
            this.$refs.schemaFieldsTable.selectRow(i);
          }
        }
      });
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
.search-result-container {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  flex-grow: 1;
}
a {
  color: #42b983;
}
.search-result-cards-container {
  flex-grow: 1;
  flex-basis: 66.66%;
  overflow-y: scroll;
  div.card {
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
.dataset-description-container {
  flex-basis: 33.33%;
  padding-left: 10px;
  overflow-y: scroll;
}
.dataset-description-buttons-container {
  float: right;
  > button:not(:last-child) {
    margin-right: 4px;
  }
  svg {
    color: #6c7572;
    &:hover {
      color: #5a6268;
    }
    cursor: pointer;
  }
}

.search-result-container > .b-table-sticky-header {
  flex-basis: 66.66%;
  overflow: scroll;
  flex-grow: 1;
  margin-bottom: 0;
}
.table-preview-container {
  padding-top: 4px;
  min-height: 50%;
  max-height: 50%;
  &.table-content-hidden {
    min-height: 50px;
  }
}
.schema-table-span {
  width: 10px;
  display: inline-block;
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
</style>
