<template>
  <div>
    <b-modal
      title="Provenance Information"
      ok-only
      hide-header-close
      ref="modal"
      size="lg"
    >
      <div v-if="!isLoading">
        <b-list-group>
          <b-list-group-item>
            <b
              >Dataset:
              <a
                target="_blank"
                :href="getDatasetUrl(dataset)"
                v-b-tooltip.hover
                title="Jump to dataset on open.canada.ca"
              >
                <i>{{ dataset.title }}</i></a
              >
            </b>
            <div class="d-flex w-100">
              <span>
                <div
                  class="inline-color-block"
                  :style="{ 'background-color': table.color }"
                ></div>
                &nbsp;
                <a
                  href="#"
                  @click="openResource(table, dataset, resourceStats)"
                  v-b-tooltip.hover
                  title="Open table"
                  >{{ table.name }}</a
                ></span
              >
            </div>
          </b-list-group-item>
        </b-list-group>
        <br />
        The value{{ positions.length > 1 ? "s" : "" }} of this cell
        {{ positions.length > 1 ? "are" : "is" }} from the following cell{{
          positions.length > 1 ? "s" : ""
        }}
        in the original table:
        <div class="table-container">
          <b-table :items="positions" :fields="fields" sticky-header bordered>
            <template #cell(actions)="row">
              <div style="min-width: 110px">
                <b-button
                  variant="primary"
                  size="sm"
                  @click="
                    locateInOriginal(table, dataset, resourceStats, row.item)
                  "
                  :title="isAdvancedMode ? 'Locate in Original Table' : ''"
                  v-b-tooltip.hover
                >
                  <b-icon icon="ui-checks-grid"></b-icon>
                  {{ !isAdvancedMode ? "&nbsp;Locate in Original Table" : "" }}
                </b-button>
                <span v-if="isAdvancedMode">
                  &nbsp;
                  <b-button
                    variant="primary"
                    size="sm"
                    @click="filterByValue(row)"
                    title="Filter by Value"
                    v-b-tooltip.hover
                  >
                    <b-icon icon="filter"></b-icon>
                  </b-button>
                </span>
              </div>
            </template>
          </b-table>
        </div>
      </div>
      <div v-else>Loading...</div>

      <template #modal-footer>
        <div class="w-100">
          <span class="float-right">
            <span>
              <b-button size="sm" @click="hideModal()"> Close </b-button>
            </span>
          </span>
        </div>
      </template>
    </b-modal>
  </div>
</template>

<script>
const IS_ADVANCED_MODE_ENABLED = false;
import Common from "../Common";

export default {
  data() {
    const fields = [{ key: "value", label: "Value" }];
    if (IS_ADVANCED_MODE_ENABLED) {
      fields.push({ key: "excelPosition", label: "Position in Excel" });
    }
    fields.push({
      key: "actions",
      label: IS_ADVANCED_MODE_ENABLED ? "Actions" : "Action",
      class: "text-center",
    });
    return {
      fields,
      isAdvancedMode: IS_ADVANCED_MODE_ENABLED,
    };
  },
  props: {
    isLoading: {
      type: Boolean,
      default: true,
    },
    dataset: Object,
    table: Object,
    resourceStats: Object,
    positions: Array,
  },
  computed: {},
  methods: {
    showModal() {
      this.$refs.modal.show();
    },
    hideModal() {
      this.$refs.modal.hide();
      this.$emit("modal-closed");
    },
    getDatasetUrl(dataset) {
      return Common.getDatasetUrl(dataset.id);
    },
    openResource(resource, dataset, resourceStats) {
      this.hideModal();
      this.$parent.$parent.openResource(
        { resource, dataset, resourceStats },
        true
      );
    },
    locateInOriginal(resource, dataset, resourceStats, position) {
      this.hideModal();
      this.$parent.$parent.openResource(
        { resource, dataset, resourceStats, selectedCell: position },
        true
      );
    },
    filterByValue(row) {
      const keyword = row.item.value;
      this.hideModal();
      this.$parent.addNewKeyword(keyword);
    },
  },
};
</script>

<style lang="scss" scoped>
.float-right {
  float: right;
}
</style>
