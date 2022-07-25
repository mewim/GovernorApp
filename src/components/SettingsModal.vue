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
        <b-form-checkbox v-model="searchResultFields.dataset_title">
          Dataset
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.matched_count">
          Matched Count
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.languages">
          Languages
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.subjects">
          Subjects
        </b-form-checkbox>
        <b-form-checkbox v-model="searchResultFields.portal_release_date">
          Release Date
        </b-form-checkbox>

        <b>Navigation Option</b>
        <b-form-checkbox v-model="jumpImmediately">
          Jump to table immediately upon open
        </b-form-checkbox>

        <div>
          <b>Use Cases Discovery Mode</b>
          <b-form-radio v-model="useCasesDiscoveryMode" value="hidden"
            >Disabled</b-form-radio
          >
          <b-form-radio v-model="useCasesDiscoveryMode" value="union-join"
            >Union + Join</b-form-radio
          >
          <b-form-radio v-model="useCasesDiscoveryMode" value="union"
            >Union Only</b-form-radio
          >
        </div>
      </div>
    </b-modal>
  </div>
</template>

<script>
export default {
  data() {
    return {
      searchResultFields: {
        dataset_title: true,
        languages: true,
        matched_count: true,
        subjects: false,
        portal_release_date: false,
      },
      useCasesDiscoveryMode: "hidden",
      jumpImmediately: true,
    };
  },
  watch: {},
  computed: {},
  methods: {
    showModal() {
      this.$refs.modal.show();
    },
  },
  mounted() {},
  destroyed() {},
};
</script>

<style lang="scss"></style>
