<template>
  <div>
    <b-modal
      ref="modal"
      title="Settings"
      ok-only
      :hideHeaderClose="true"
      :centered="true"
    >
      <div class="search-results-fields-toggle-container">
        <b>Navigation Option</b>
        <b-form-checkbox
          :checked="settings.jumpImmediately"
          @change="jumpImmediatelyChanged"
        >
          Jump to table immediately upon open
        </b-form-checkbox>

        <b>Feature Switches</b>
        <b-form-checkbox
          :checked="settings.uuidEnabled"
          @change="uuidEnabledChanged"
        >
          Search by UUID
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.globalColumnFillingSuggestionEnabled"
          @change="globalColumnFillingSuggestionEnabledChanged"
        >
          Global Column Filling Suggestion
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.provenanceModalEnabled"
          @change="provenanceModalEnabledChanged"
        >
          Provenance Information Modal
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.workingTableComponentsLabel"
          @change="workingTableComponentsLabelChanged"
        >
          Working Table Structure Labels
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.autoColumnUnhideEnabled"
          @change="autoColumnUnhideEnabledChanged"
        >
          Automatically Unhide Columns on Filter
        </b-form-checkbox>
        <div>
          <b>Working Table Columns Selection</b>
          <b-form-radio
            :checked="settings.workingTableColumnsSection"
            value="unioned"
            @change="workingTableColumnsSectionChanged"
          >
            Column From Unioned Tables Only
          </b-form-radio>
          <b-form-radio
            :checked="settings.workingTableColumnsSection"
            value="all"
            @change="workingTableColumnsSectionChanged"
          >
            All Columns
          </b-form-radio>
        </div>
        <div>
          <b>Filter Logic</b>
          <b-form-radio
            :checked="settings.filterLogic"
            value="and"
            @change="filterLogicChanged"
          >
            And
          </b-form-radio>
          <b-form-radio
            :checked="settings.filterLogic"
            value="or"
            @change="filterLogicChanged"
          >
            Or
          </b-form-radio>
        </div>
      </div>
    </b-modal>
  </div>
</template>

<script>
export default {
  data() {
    return {};
  },
  props: {
    settings: {
      type: Object,
      required: true,
    },
  },
  watch: {},
  computed: {},
  methods: {
    showModal() {
      this.$refs.modal.show();
    },
    jumpImmediatelyChanged(newValue) {
      this.$emit("jumpImmediatelyChanged", newValue);
    },
    uuidEnabledChanged(newValue) {
      this.$emit("uuidEnabledChanged", newValue);
    },
    globalColumnFillingSuggestionEnabledChanged(newValue) {
      this.$emit("globalColumnFillingSuggestionEnabledChanged", newValue);
    },
    provenanceModalEnabledChanged(newValue) {
      this.$emit("provenanceModalEnabledChanged", newValue);
    },
    workingTableColumnsSectionChanged(newValue) {
      this.$emit("workingTableColumnsSectionChanged", newValue);
    },
    workingTableComponentsLabelChanged(newValue) {
      this.$emit("workingTableComponentsLabelChanged", newValue);
    },
    filterLogicChanged(newValue) {
      this.$emit("filterLogicChanged", newValue);
    },
    autoColumnUnhideEnabledChanged(newValue) {
      this.$emit("autoColumnUnhideEnabledChanged", newValue);
    },
  },
  mounted() {},
  destroyed() {},
};
</script>

<style lang="scss">
div.search-results-fields-toggle-container {
  label {
    padding-left: 8px;
  }
  max-height: 50vh;
  overflow-y: scroll;
}
</style>
