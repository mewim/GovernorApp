<template>
  <div class="data-table-tab-container">
    <div ref="dataTableTabBar">
      <ul role="tablist" class="nav nav-tabs">
        <li>
          <b-button
            variant="info"
            @click="showSettingsModal()"
            class="toggle-table-button"
            ><b-icon icon="gear-fill"></b-icon
          ></b-button>

          <b-button
            variant="primary"
            @click="toggleSearchView()"
            class="toggle-table-button"
            ><b-icon icon="search"></b-icon
          ></b-button>

          <b-button
            variant="success"
            @click="toggleWorkingTable()"
            class="toggle-table-button"
            ><b-icon icon="table"></b-icon>&nbsp;Working Table</b-button
          >
        </li>

        <li v-for="item in openedResources" :key="item.resource.id">
          <p :class="getTabClass(item.resource.id)">
            <a href="#" @click="toggleResource(item.resource.id)">{{
              item.resource.name
            }}</a>
            <span class="close-button" @click="closeResource(item.resource.id)">
              &nbsp;<b-icon icon="x"></b-icon
            ></span>
          </p>
        </li>
      </ul>
    </div>

    <div
      class="data-table-container"
      ref="dataTableContainer"
      :style="dataTableContainerStyle"
    >
      <search-view
        v-show="isSearchActive"
        ref="searchView"
        :settings="settings"
      />
      <working-table
        v-show="isWorkingTableActive"
        :height="tableAreaHeight"
        :isActive="isWorkingTableActive"
        ref="workingTable"
        :settings="settings"
        @unionedTableFieldsUpdated="unionedTableFieldsUpdated"
      />
      <data-table
        v-for="item in openedResources"
        v-show="
          !isSearchActive &&
          !isWorkingTableActive &&
          activeResourceId === item.resource.id
        "
        :key="item.resource.id"
        :resource="item.resource"
        :resourceStats="item.resourceStats"
        :unionedTableFields="unionedTableFields"
        :keyword="item.keyword"
        :dataset="item.dataset"
        :tableId="item.resource.id"
        :selectedCell="item.selectedCell"
        :height="tableAreaHeight"
        :isActive="
          !isSearchActive &&
          !isWorkingTableActive &&
          activeResourceId === item.resource.id
        "
        :settings="settings"
        :ref="`table-${item.resource.id}`"
      />
    </div>
    <div></div>
    <settings-modal
      ref="settingsModal"
      :settings="settings"
      @searchResultsFieldsChanged="searchResultsFieldsChanged"
      @jumpImmediatelyChanged="jumpImmediatelyChanged"
      @uuidEnabledChanged="uuidEnabledChanged"
      @globalColumnFillingSuggestionEnabledChanged="
        globalColumnFillingSuggestionEnabledChanged
      "
      @provenanceModalEnabledChanged="provenanceModalEnabledChanged"
      @workingTableColumnsSectionChanged="workingTableColumnsSectionChanged"
      @workingTableComponentsLabelChanged="workingTableComponentsLabelChanged"
      @filterLogicChanged="filterLogicChanged"
      @autoColumnUnhideEnabledChanged="autoColumnUnhideEnabledChanged"
    />
  </div>
</template>

<script>
import DuckDB from "../DuckDB";
import TableColorManager from "../TableColorManager";
export default {
  data() {
    return {
      activeResourceId: null,
      openedResources: [],
      unionedTableFields: [],
      tableAreaHeight: 0,
      isSearchActive: true,
      isWorkingTableActive: false,
      TABLE_AREA_OFFSET: 40,
      settings: {
        searchResultFields: {
          languages: true,
          matched_count: true,
          subjects: false,
          portal_release_date: false,
        },
        jumpImmediately: true,
        uuidEnabled: false,
        globalColumnFillingSuggestionEnabled: false,
        provenanceModalEnabled: false,
        workingTableComponentsLabel: false,
        workingTableColumnsSection: "all",
        filterLogic: "and",
        autoColumnUnhideEnabled: true,
      },
    };
  },
  props: {},
  watch: {
    settings: {
      handler(newSettings) {
        this.saveSettings(newSettings);
      },
      deep: true,
    },
  },
  computed: {
    dataTableContainerStyle: function () {
      let height = this.tableAreaHeight;
      height += this.TABLE_AREA_OFFSET;
      return { height: `${height}px` };
    },
    openedDataTables: function () {
      return this.openedResources.filter((r) => !r.isJoinedTable);
    },
  },
  methods: {
    showSettingsModal: function () {
      this.$refs.settingsModal.showModal();
    },
    toggleSearchView: function () {
      this.isWorkingTableActive = false;
      this.isSearchActive = true;
    },
    toggleWorkingTable: function () {
      this.$nextTick(() => {
        this.updatePreviewAreaHeight();
      });
      this.isSearchActive = false;
      this.isWorkingTableActive = true;
    },
    toggleResource: function (resourceId) {
      this.isSearchActive = false;
      this.isWorkingTableActive = false;
      this.activeResourceId = resourceId;
    },
    getTabClass: function (resourceId) {
      return resourceId === this.activeResourceId &&
        !this.isSearchActive &&
        !this.isWorkingTableActive
        ? "nav-link active"
        : "nav-link";
    },
    jumpToResource(resourceId) {
      this.activeResourceId = resourceId;
      this.isSearchActive = false;
      this.isWorkingTableActive = false;
    },
    openResource: function (r, jumpImmediately) {
      if (!r.resource.color) {
        r.resource.color = TableColorManager.getColor(r.resource.id);
      }
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (this.openedResources[i].resource.id === r.resource.id) {
          this.openedResources[i].keyword = r.keyword;
          this.openedResources[i].selectedCell = r.selectedCell;
          if (jumpImmediately) {
            this.jumpToResource(r.resource.id);
          }
          return;
        }
      }
      this.openedResources.push(r);
      if (jumpImmediately) {
        this.jumpToResource(r.resource.id);
      }
    },
    closeResource: function (id) {
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (this.openedResources[i].resource.id !== id) {
          continue;
        }
        if (id === this.activeResourceId) {
          const newActiveResourceIndex = this.openedResources[i - 1]
            ? i - 1
            : this.openedResources[i + 1]
            ? i + 1
            : null;
          this.activeResourceId = this.openedResources[newActiveResourceIndex]
            ? this.openedResources[newActiveResourceIndex].resource.id
            : null;
        }
        this.openedResources.splice(i, 1);
        DuckDB.dropDataView(id, true);
        break;
      }
      if (this.openedResources.length === 0) {
        this.isSearchActive = true;
      }
    },
    updatePreviewAreaHeight: function () {
      try {
        this.tableAreaHeight =
          window.innerHeight -
          this.$refs.dataTableTabBar.getBoundingClientRect().height -
          this.TABLE_AREA_OFFSET;
      } catch (err) {
        this.tableAreaHeight = window.innerHeight;
      }
    },
    searchResultsFieldsChanged: function ({ field, newValue }) {
      this.settings.searchResultFields[field] = newValue;
    },
    jumpImmediatelyChanged: function (newValue) {
      this.settings.jumpImmediately = newValue;
    },
    uuidEnabledChanged(newValue) {
      this.settings.uuidEnabled = newValue;
    },
    globalColumnFillingSuggestionEnabledChanged(newValue) {
      this.settings.globalColumnFillingSuggestionEnabled = newValue;
    },
    provenanceModalEnabledChanged(newValue) {
      this.settings.provenanceModalEnabled = newValue;
    },
    workingTableColumnsSectionChanged(newValue) {
      this.settings.workingTableColumnsSection = newValue;
    },
    workingTableComponentsLabelChanged(newValue) {
      this.settings.workingTableComponentsLabel = newValue;
    },
    filterLogicChanged(newValue) {
      this.settings.filterLogic = newValue;
    },
    autoColumnUnhideEnabledChanged(newValue) {
      this.settings.autoColumnUnhideEnabled = newValue;
    },
    saveSettings: function (newSettings) {
      localStorage.setItem("settings", JSON.stringify(newSettings));
    },
    loadSettings: function () {
      const settingsString = localStorage.getItem("settings");
      if (!settingsString) {
        return;
      }
      const settings = JSON.parse(settingsString);
      // Perform a check to see if the settings are valid.
      // If they are not, then we will fall back to the default settings.
      for (let key in this.settings) {
        if (settings && settings[key] !== undefined) {
          this.settings[key] = settings[key];
        }
      }
    },
    unionedTableFieldsUpdated: function (newValue) {
      this.unionedTableFields = newValue;
    },
  },
  mounted() {
    this.updatePreviewAreaHeight();
  },
  created() {
    this.loadSettings();
    window.addEventListener("resize", this.updatePreviewAreaHeight);
  },
  destroyed() {
    window.removeEventListener("resize", this.updatePreviewAreaHeight);
  },
};
</script>

<style lang="scss" scoped>
.nav.nav-tabs {
  background: var(--bs-gray-700);
  li {
    button.btn {
      border-radius: 0;
    }
  }
}
.nav-link {
  > a {
    color: var(--bs-white);
    text-decoration: none;
  }
  &.active {
    > a {
      color: var(--bs-grey-700);
      cursor: default;
    }
    .close-button {
      > svg {
        color: var(--bs-gray-600);
        &:hover {
          color: var(--bs-gray-500);
        }
      }
    }
  }
  .close-button {
    > svg {
      color: var(--bs-white);
      &:hover {
        color: var(--bs-gray-300);
      }
    }
    cursor: pointer;
  }
}
.btn.btn-info {
  color: var(--bs-white);
}
.btn.btn-warning {
  color: var(--bs-white);
}
.data-table-tab-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.toggle-table-button {
  height: 41px;
}
</style>
