<template>
  <div class="data-table-tab-container">
    <div>
      <ul role="tablist" class="nav nav-tabs">
        <li>
          <b-button
            variant="primary"
            @click="toggleSearchView()"
            class="toggle-table-button"
            ><b-icon icon="gear-fill"></b-icon
          ></b-button>

          <b-button
            variant="light"
            @click="toggleSearchView()"
            class="toggle-table-button"
            ><b-icon icon="search"></b-icon
          ></b-button>
        </li>

        <li v-for="item in openedResources" :key="item.resource.id">
          <p :class="getTabClass(item.resource.id)">
            <a
              href="#"
              @click="
                activeResourceId = item.resource.id;
                isSearchActive = false;
              "
              >{{ item.resource.name }}</a
            >
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
      v-show="tableViewDisplayed"
    >
      <search-view v-show="isSearchActive" />
      <data-table
        v-for="item in openedResources"
        v-show="!isSearchActive && activeResourceId === item.resource.id"
        :key="item.resource.id"
        :selectedFields="item.selectedFields"
        :showAllRows="item.showAllRows"
        :resource="item.resource"
        :resourceStats="item.resourceStats"
        :dataset="item.dataset"
        :tableId="item.resource.id"
        :height="tableAreaHeight"
        :ref="`table-${item.resource.id}`"
      />
    </div>
  </div>
</template>

<script>
import SearchView from "./SearchView.vue";
export default {
  components: { SearchView },
  data() {
    return {
      activeResourceId: null,
      openedResources: [],
      tableAreaHeight: 0,
      tableViewDisplayed: true,
      isSearchActive: true,
    };
  },
  props: {},
  watch: {},
  computed: {},
  methods: {
    toggleSearchView: function () {
      this.isSearchActive = true;
    },
    getTabClass: function (resourceId) {
      return resourceId === this.activeResourceId
        ? "nav-link active"
        : "nav-link";
    },
    openResource: function (r) {
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (this.openedResources[i].resource.id === r.resource.id) {
          this.activeResourceId = r.resource.id;
          this.openedResources[i].resource = r.resource;
          this.$nextTick(() => {
            this.updatePreviewAreaHeight();
          });
          return;
        }
      }
      this.openedResources.push(r);
      this.activeResourceId = r.resource.id;
      if (this.openedResources.length === 1) {
        this.$emit("showTabAreaChanged", true);
      }
      this.$nextTick(() => {
        this.updatePreviewAreaHeight();
      });
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
        this.$emit("showTabAreaChanged", false);
      }
      this.$nextTick(() => {
        this.updatePreviewAreaHeight();
      });
    },
    setAttributeForResource: function (id, key, newValue) {
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (this.openedResources[i].resource.id !== id) {
          continue;
        }
        this.openedResources[i][key] = newValue;
        break;
      }
    },
    setSelectedFields: function (id, newValue) {
      this.setAttributeForResource(id, "selectedFields", newValue);
    },
    setShowAllRows: function (id, newValue) {
      this.setAttributeForResource(id, "showAllRows", newValue);
    },
    updatePreviewAreaHeight: function () {
      try {
        this.tableAreaHeight = window.innerHeight - 43;
      } catch (err) {
        this.tableAreaHeight = 0;
      }
    },
  },

  mounted() {},
  created() {
    window.addEventListener("resize", this.updatePreviewAreaHeight);
  },
  destroyed() {
    window.removeEventListener("resize", this.updatePreviewAreaHeight);
  },
};
</script>

<style lang="scss" scoped>
.close-button {
  color: #6c7572;
  &:hover {
    color: #5a6268;
  }
  cursor: pointer;
}
.nav.nav-tabs {
  border-top: 1px solid #dee2e6;
  border-left: 1px solid #dee2e6;
  border-right: 1px solid #dee2e6;
}
.nav-link {
  > a {
    text-decoration: none;
  }
  &.active {
    > a {
      cursor: default;
      color: #495057;
    }
  }
}
.data-table-tab-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  .data-table-container {
    flex-grow: 1;
  }
}
.toggle-table-button {
  height: 41px;
}
</style>
