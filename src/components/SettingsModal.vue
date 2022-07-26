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
        <b>Search Results Fields</b>
        <b-form-checkbox
          :checked="settings.searchResultFields.matched_count"
          @change="searchResultFieldsChanged('matched_count', $event)"
        >
          Matched Count
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.searchResultFields.languages"
          @change="searchResultFieldsChanged('languages', $event)"
        >
          Languages
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.searchResultFields.subjects"
          @change="searchResultFieldsChanged('subjects', $event)"
        >
          Subjects
        </b-form-checkbox>
        <b-form-checkbox
          :checked="settings.searchResultFields.portal_release_date"
          @change="searchResultFieldsChanged('portal_release_date', $event)"
        >
          Release Date
        </b-form-checkbox>

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

        <div>
          <b>Use Cases Discovery Mode</b>
          <b-form-radio
            :checked="settings.useCasesDiscoveryMode"
            value="hidden"
            @change="useCasesDiscoveryModeChanged"
          >
            Disabled
          </b-form-radio>
          <b-form-radio
            :checked="settings.useCasesDiscoveryMode"
            value="union-join"
            @change="useCasesDiscoveryModeChanged"
          >
            Union + Join
          </b-form-radio>
          <b-form-radio
            :checked="settings.useCasesDiscoveryMode"
            value="union"
            @change="useCasesDiscoveryModeChanged"
          >
            Union Only
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
    searchResultFieldsChanged(field, newValue) {
      this.$emit("searchResultsFieldsChanged", { field, newValue });
    },
    jumpImmediatelyChanged(newValue) {
      this.$emit("jumpImmediatelyChanged", newValue);
    },
    uuidEnabledChanged(newValue) {
      this.$emit("uuidEnabledChanged", newValue);
    },
    useCasesDiscoveryModeChanged(newValue) {
      this.$emit("useCasesDiscoveryModeChanged", newValue);
    },
    globalColumnFillingSuggestionEnabledChanged(newValue) {
      this.$emit("globalColumnFillingSuggestionEnabledChanged", newValue);
    },
    provenanceModalEnabledChanged(newValue) {
      this.$emit("provenanceModalEnabledChanged", newValue);
    },
  },
  mounted() {},
  destroyed() {},
};
</script>

<style lang="scss"></style>
