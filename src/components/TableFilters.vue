<template>
  <div>
    <h5>
      Filter Table Data by Keywords
      <span class="filters-header-button-container"
        ><button
          type="button"
          class="btn btn-primary btn-sm"
          @click="showAddModal()"
        >
          Add
        </button>
      </span>
    </h5>

    <b-list-group>
      <b-list-group-item
        v-for="(k, i) in keywords"
        :key="i"
        class="d-flex justify-content-between align-items-center"
      >
        <span class="filter-remove-button-container">
          <b-icon-x @click="removeKeyword(i)" />
          {{ k }}
        </span>
        <span
          class="badge rounded-pill bg-primary"
          v-if="i !== keywords.length - 1"
        >
          {{ settings.filterLogic === "or" ? "OR" : "AND" }}
        </span>
      </b-list-group-item>

      <b-list-group-item
        v-if="keywords.length === 0 && !this.isAddingNewFilter"
        class="d-flex justify-content-between align-items-center"
      >
        There is no filter. Click "Add" to apply a new filter.
      </b-list-group-item>

      <b-list-group-item
        v-if="this.isAddingNewFilter"
        class="d-flex justify-content-between align-items-center"
      >
        <b-form-input
          v-model="newKeyWordText"
          placeholder="Enter new keyword"
        ></b-form-input>

        <span class="add-keyword-buttons-container">
          <button
            type="button"
            class="btn btn-success btn-sm"
            @click="addNewKeyword()"
          >
            OK
          </button>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            @click="cancelNewKeyword()"
          >
            Cancel
          </button>
        </span>
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
export default {
  name: "TableFilters",
  data() {
    return {
      newKeyWordText: "",
      isAddingNewFilter: false,
    };
  },
  props: {
    keywords: Array,
    settings: {
      type: Object,
      required: true,
    },
  },
  watch: {},
  computed: {},
  methods: {
    removeKeyword(i) {
      this.$emit("filter-keywords-removed", i);
    },
    showAddModal() {
      this.isAddingNewFilter = true;
    },
    addNewKeyword() {
      if (!this.newKeyWordText) {
        this.cancelNewKeyword();
        return;
      }
      this.$emit("filter-keywords-added", this.newKeyWordText.trim());
      this.cancelNewKeyword();
    },
    cancelNewKeyword() {
      this.newKeyWordText = "";
      this.isAddingNewFilter = false;
    },
  },
  mounted() {},
  destroyed() {},
};
</script>

<style lang="scss">
h5 {
  padding-bottom: 4px;
}
span.filter-remove-button-container {
  svg.b-icon.bi {
    color: var(--bs-gray-600);
    &:hover {
      color: var(--bs-gray-500);
    }
    cursor: pointer;
  }
}
input.form-control {
  width: calc(100% - 112px);
}
span.add-keyword-buttons-container {
  button:not(:last-child) {
    margin-right: 2px;
  }
}
.filters-header-button-container {
  float: right;
}
</style>
