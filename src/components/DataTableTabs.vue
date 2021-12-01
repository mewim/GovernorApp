<template>
  <div class="data-table-tab-container">
    <div>
      <ul role="tablist" class="nav nav-tabs">
        <li>
          <b-button variant="light" @click="toggleTableView()"
            ><b-icon :icon="toggleTableViewButtonIcon"></b-icon
          ></b-button>
        </li>

        <li v-for="item in openedResources" :key="item.resource.id">
          <p :class="getTabClass(item.resource.id)">
            <a href="#" @click="activeResourceId = item.resource.id">{{
              item.resource.name
            }}</a>
            <span class="close-button" @click="closeResource(item.resource.id)">
              &nbsp;<b-icon icon="x"></b-icon
            ></span>
          </p>
        </li>
      </ul>
    </div>

    <div class="data-table-container" ref="dataTableContainer" v-show="tableViewDisplayed">
      <data-table
        v-for="item in openedResources"
        v-show="activeResourceId === item.resource.id"
        :key="item.resource.id"
        :selectedFields="item.selectedFields"
        :showAllRows="item.showAllRows"
        :resource="item.resource"
        :tableId="item.resource.id"
        :height="tableAreaHeight"
      />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeResourceId: null,
      openedResources: [],
      tableAreaHeight: 0,
      tableViewDisplayed: true,
    };
  },
  props: {},
  watch: {},
  computed: {
    toggleTableViewButtonIcon: function () {
      if (this.tableViewDisplayed) {
        return "arrow-bar-down";
      }
      return "arrow-bar-up";
    },
  },
  methods: {
    toggleTableView: function () {
      this.tableViewDisplayed = !this.tableViewDisplayed;
      this.$emit("tableViewDisplayed", true);
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
        this.tableAreaHeight =
          this.$refs.dataTableContainer.getBoundingClientRect().height;
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
</style>
