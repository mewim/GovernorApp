<template>
  <div class="data-table-tab-container">
    <div ref="dataTableTabBar">
      <ul role="tablist" class="nav nav-tabs">
        <li>
          <b-button
            variant="info"
            @click="toggleSettings()"
            class="toggle-table-button"
            ><b-icon icon="gear-fill"></b-icon
          ></b-button>

          <b-button
            v-if="DISCOVERY_MODE"
            variant="warning"
            @click="toggleUseCasesDiscovery()"
            class="toggle-table-button"
            ><b-icon icon="eye-fill"></b-icon
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
      <search-view v-show="isSearchActive" ref="searchView" />
      <working-table
        v-show="isWorkingTableActive"
        :height="tableAreaHeight"
        :isActive="isWorkingTableActive"
        ref="workingTable"
      />
      <use-cases-discovery
        v-if="DISCOVERY_MODE"
        v-show="isUseCasesDiscoveryActive"
        ref="useCasesDiscovery"
      >
      </use-cases-discovery>
      <data-table
        v-for="item in openedResources"
        v-show="
          !isSearchActive &&
          !isWorkingTableActive &&
          !isUseCasesDiscoveryActive &&
          activeResourceId === item.resource.id
        "
        :key="item.resource.id"
        :resource="item.resource"
        :resourceStats="item.resourceStats"
        :keyword="item.keyword"
        :dataset="item.dataset"
        :tableId="item.resource.id"
        :height="tableAreaHeight"
        :isActive="
          !isSearchActive &&
          !isWorkingTableActive &&
          !isUseCasesDiscoveryActive &&
          activeResourceId === item.resource.id
        "
        :ref="`table-${item.resource.id}`"
      />
    </div>
    <div></div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeResourceId: null,
      openedResources: [],
      tableAreaHeight: 0,
      isSearchActive: true,
      isWorkingTableActive: false,
      isUseCasesDiscoveryActive: false,
      TABLE_AREA_OFFSET: 40,
      DISCOVERY_MODE: true,
    };
  },
  props: {},
  watch: {},
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
    toggleSettings: function () {
      this.$refs.searchView.toggleSettings();
    },
    toggleSearchView: function () {
      this.isWorkingTableActive = false;
      this.isUseCasesDiscoveryActive = false;
      this.isSearchActive = true;
    },
    toggleWorkingTable: function () {
      this.$nextTick(() => {
        this.updatePreviewAreaHeight();
      });
      this.isSearchActive = false;
      this.isUseCasesDiscoveryActive = false;
      this.isWorkingTableActive = true;
    },
    toggleUseCasesDiscovery: function () {
      this.isSearchActive = false;
      this.isWorkingTableActive = false;
      this.isUseCasesDiscoveryActive = true;
    },
    toggleResource: function (resourceId) {
      this.isSearchActive = false;
      this.isUseCasesDiscoveryActive = false;
      this.isWorkingTableActive = false;
      this.activeResourceId = resourceId;
    },
    getTabClass: function (resourceId) {
      return resourceId === this.activeResourceId &&
        !this.isSearchActive &&
        !this.isWorkingTableActive &&
        !this.isUseCasesDiscoveryActive
        ? "nav-link active"
        : "nav-link";
    },
    openResource: function (r, jumpImmediately, isJoinedTable = false) {
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (this.openedResources[i].resource.id === r.resource.id) {
          this.activeResourceId = r.resource.id;
          if (!isJoinedTable) {
            this.openedResources[i].resource = r.resource;
            this.openedResources[i].dataset = r.dataset;
            this.openedResources[i].resourceStats = r.resourceStats;
            this.openedResources[i].keyword = r.keyword;
          }
          return;
        }
      }
      r.isJoinedTable = isJoinedTable;
      this.openedResources.push(r);
      this.activeResourceId = r.resource.id;
      if (jumpImmediately) {
        this.isSearchActive = false;
        this.isWorkingTableActive = false;
        this.isUseCasesDiscoveryActive = false;
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
    useCasesDiscoveryModeChanged: function (isUnion) {
      this.$refs.useCasesDiscovery.useCasesDiscoveryModeChanged(isUnion);
    },
  },

  mounted() {
    this.updatePreviewAreaHeight();
  },
  created() {
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
