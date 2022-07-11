<template>
  <div class="working-table-components-container">
    <div style="background-color: white">
      <table ref="blocksTable">
        <tr v-for="(row, i) in blockMapping" :key="i">
          <th
            v-for="(uuid, j) in row"
            :key="j"
            :style="getBlockStyle(uuid, i)"
            v-b-tooltip.hover
            :title="getTableTitle(uuid, i, j)"
            @click="onBlockClick(uuid, i, j)"
          ></th>
        </tr>
      </table>
    </div>

    <b-modal
      title="Working Table Component Detail"
      ok-only
      hide-header-close
      size="lg"
      ref="componentDetailModal"
    >
      <b-list-group-item v-if="!!h">
        <b
          >Dataset:
          <a
            target="_blank"
            :href="getDatasetUrl(h.dataset)"
            v-b-tooltip.hover
            title="Jump to dataset on open.canada.ca"
          >
            <i>{{ h.dataset.title }}</i></a
          >
        </b>

        <div class="d-flex w-100">
          <span>
            <div>
              <span>
                <div
                  class="inline-color-block"
                  :style="{ 'background-color': h.table.color }"
                ></div>
                &nbsp;
                <a
                  href="#"
                  @click="openResource(h.table, h.dataset, h.resourceStats)"
                  v-b-tooltip.hover
                  title="Open table"
                  >{{ h.table.name }}</a
                ></span
              >
            </div>
          </span>
        </div>
        <div v-if="h.joinedTables">
          <div v-for="(j, k) in h.joinedTables" :key="k">
            <small>
              <div
                class="inline-color-block"
                :style="{ 'background-color': j.targetResource.color }"
              ></div>
              &nbsp; Joined Table:
              <a
                href="#"
                v-b-tooltip.hover
                title="Open table"
                @click="
                  openResource(
                    j.targetResource,
                    h.dataset,
                    j.targetResourceStats
                  )
                "
                >{{ j.targetResource.name }}</a
              >
              <span class="float-right">
                {{
                  j.sourceKey === j.targetKey
                    ? `(Join Key: ${j.sourceKey})`
                    : `(Primary Key: ${j.sourceKey}; Foreign Key: ${j.targetKey})`
                }}
              </span>
            </small>
          </div>
        </div>
      </b-list-group-item>
      <div v-if="hasUnfilled">
        <br />
        This component has unfilled cells.
      </div>
      <template #modal-footer>
        <div class="w-100">
          <span>
            <span>
              <b-button
                size="sm"
                variant="danger"
                @click="removeComponent(componentDetailIndex)"
              >
                Remove Component
              </b-button>
            </span>
            <span>
              <b-button
                size="sm"
                variant="success"
                @click="focusOnComponent(componentDetailIndex)"
              >
                {{
                  focusedComponentIndex === componentDetailIndex
                    ? "Unfocus"
                    : "Focus"
                }}
              </b-button>
            </span>
            <span>
              <b-button
                size="sm"
                variant="success"
                @click="jumpToFirstRow(componentDetailIndex)"
              >
                Jump to First Row
              </b-button>
            </span>
          </span>

          <span class="float-right">
            <span>
              <b-button size="sm" @click="closeComponentDetailModal()">
                Close
              </b-button>
            </span>
          </span>
        </div>
      </template>
    </b-modal>
  </div>
</template>

<script>
import TableColorManger from "../TableColorManager";
import Common from "../Common";

export default {
  name: "WorkingTableComponents",
  data() {
    return {
      displayWidth: null,
      h: null,
      componentDetailIndex: null,
      hasUnfilled: false,
    };
  },
  props: {
    histories: {
      type: Array,
      required: false,
    },
    selectedColumns: {
      type: Array,
      required: false,
    },
    columns: {
      type: Array,
      required: false,
    },
    focusedComponentIndex: Number,
  },
  watch: {},
  computed: {
    blockMapping() {
      if (!this.histories || !this.selectedColumns || !this.columns) {
        return [];
      }
      const blocks = [];
      // Filter on columns to maintain the order of the list
      const selectedColumns = this.columns
        .filter((column) => this.selectedColumns.includes(column.title))
        .map((c) => c.title);
      for (let i = 0; i < this.histories.length; ++i) {
        blocks[i] = [];
        const columnNameToTableMap = {};
        const h = this.histories[i];
        if (h.joinedTables) {
          for (const uuid in h.joinedTables) {
            h.joinedTables[uuid].columns.forEach((c) => {
              columnNameToTableMap[c] = uuid;
            });
          }
        }
        h.resourceStats.schema.fields.forEach((f) => {
          columnNameToTableMap[f.name] = h.resourceStats.uuid;
        });
        for (let j = 0; j < selectedColumns.length; ++j) {
          const c = selectedColumns[j];
          blocks[i].push(
            columnNameToTableMap[c] ? columnNameToTableMap[c] : null
          );
        }
      }
      return blocks;
    },
  },
  methods: {
    getBlockColor(uuid) {
      return uuid ? TableColorManger.getColor(uuid) : "#ffffff";
    },
    getTableDisplayWidth() {
      return this.$refs.blocksTable.clientWidth;
    },
    onBlockClick(_, i) {
      this.h = this.histories[i];
      this.componentDetailIndex = i;
      this.hasUnfilled = false;
      for (let b of this.blockMapping[i]) {
        if (!b) {
          this.hasUnfilled = true;
          break;
        }
      }
      this.$refs.componentDetailModal.show();
    },
    getTableTitle(uuid, i) {
      if (this.histories[i].table.id === uuid) {
        return this.histories[i].table.name;
      } else if (
        this.histories[i].joinedTables &&
        this.histories[i].joinedTables[uuid]
      ) {
        return this.histories[i].joinedTables[uuid].targetResource.name;
      }
      return;
    },
    getBlockStyle(uuid, i) {
      const isFocused =
        isNaN(parseInt(this.focusedComponentIndex)) ||
        this.focusedComponentIndex === i;
      const color = this.getBlockColor(uuid);
      return {
        "background-color": color,
        cursor: "pointer",
        "user-select": "none",
        opacity: isFocused ? 1 : 0.7,
      };
    },
    removeComponent(i) {
      this.$parent.removeTable(this.histories[i]);
      this.closeComponentDetailModal();
    },
    focusOnComponent(i) {
      this.$parent.focusComponent(i);
      this.closeComponentDetailModal();
    },
    jumpToFirstRow(i) {
      this.$parent.jumpToFirstRow(i);
      this.closeComponentDetailModal();
    },
    closeComponentDetailModal() {
      this.h = null;
      this.componentDetailIndex = null;
      this.$refs.componentDetailModal.hide();
    },
    getDatasetUrl(dataset) {
      return Common.getDatasetUrl(dataset.id);
    },
    openResource(resource, dataset, resourceStats) {
      this.closeComponentDetailModal();
      this.$parent.$parent.$parent.openResource(
        { resource, dataset, resourceStats },
        true
      );
    },
  },
  async mounted() {},
  destroyed() {},
};
</script>

<style lang="scss" scoped>
.working-table-components-container {
  table {
    width: 100%;
    tr {
      height: 40px;
    }
  }
}
.float-right {
  float: right;
}
</style>
