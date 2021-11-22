<template>
  <div>
    <div>
      <ul role="tablist" class="nav nav-tabs">
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

    <div class="data-table-container">
      <data-table
        v-for="item in openedResources"
        v-show="activeResourceId === item.resource.id"
        :key="item.resource.id"
        :selectedFields="item.selectedFields"
        :showAllRows="item.showAllRows"
        :resource="item.resource"
        :tableId="item.resource.id"
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
    };
  },
  props: {},
  watch: {},
  computed: {},
  methods: {
    getTabClass: function (resourceId) {
      return resourceId === this.activeResourceId
        ? "nav-link active"
        : "nav-link";
    },
    openResource: function (r) {
      this.openedResources.push(r);
      this.activeResourceId = r.resource.id;
      if (this.openedResources.length === 1) {
        this.$emit("showTabAreaChanged", true);
      }
    },
    closeResource: function (id) {
      for (let i = 0; i < this.openedResources.length; ++i) {
        if (!this.openedResources[i].resource.id === id) {
          continue;
        }
        const newActiveResourceIndex = this.openedResources[i - 1]
          ? i - 1
          : this.openedResources[i + 1]
          ? i + 1
          : null;
        this.activeResourceId = this.openedResources[newActiveResourceIndex]
          ? this.openedResources[newActiveResourceIndex].resource.id
          : null;
        this.openedResources.splice(i, 1);
        break;
      }
      if (this.openedResources.length === 0) {
        this.$emit("showTabAreaChanged", false);
      }
    },
  },
  mounted() {},
  destroyed() {},
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
.nav-link {
  > a {
    text-decoration: none;
  }
  &.active {
    >a{
    cursor: default;
    color: #495057;
    }
  }
}
</style>
