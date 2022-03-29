<template>
  <div>
    <h5>
      Filter
      <span class="filters-header-button-container"
        ><button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="showAddModal()"
        >
          Add
        </button></span
      >
    </h5>

    <b-list-group>
      <b-list-group-item
        v-for="(k, i) in keywords"
        :key="i"
        class="d-flex justify-content-between align-items-center"
      >
        <span>
          <b-icon-x @click="removeKeyword(i)" />
          {{ k }}
        </span>
        <span
          class="badge rounded-pill bg-primary"
          v-if="i !== keywords.length - 1"
          >OR</span
        >
      </b-list-group-item>

      <b-list-group-item
        v-if="keywords.length === 0 && !this.isAddingNewFilter"
        class="d-flex justify-content-between align-items-center"
      >
        There is no filter. Please click on "Add" button to apply a new filter.
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
          </button></span
        >
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script>
// import axios from "axios";
// import { VeLoading } from "vue-easytable";
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
  },
  watch: {},
  computed: {},
  methods: {
    removeKeyword(i) {
      this.$parent.$parent.removeKeyword(i);
    },
    showAddModal() {
      this.isAddingNewFilter = true;
    },
    addNewKeyword() {
      this.$parent.$parent.addNewKeyword(this.newKeyWordText);
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
span {
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
