<template>
  <div class="working-table-components-container">
    <div style="background-color: white">
      <table ref="blocksTable" class="working-table-components-table">
        <tr v-for="(row, i) in blockMapping" :key="i">
          <th
            v-for="(block, j) in row"
            :key="j"
            :style="getBlockStyle(block.tableId, i)"
            v-b-tooltip.hover.html.lefttop="getTableTitle(block.tableId, i, j)"
            @click="onBlockClick(block.tableId, i, j)"
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
      <working-table-component-table-item
        :h="selectedHistory"
        v-if="!!selectedHistory"
        @open-resource="openResource"
      />
      <div>
        <br />
        <table
          v-if="!!selectedRow"
          class="
            working-table-components-table working-table-components-detail-table
          "
        >
          <tr>
            <th
              v-for="(block, j) in selectedRow"
              :key="j"
              :style="
                getBlockStyle(
                  block.tableId,
                  componentDetailIndex,
                  componentDetailHoveredId
                    ? block.tableId === componentDetailHoveredId
                    : block.tableId === componentDetailSelectedId
                )
              "
              v-b-tooltip.hover.html="
                getTableTitle(block.tableId, componentDetailIndex, j)
              "
              @click="onComponentDetailBlockClick(block.tableId)"
              @mouseover="onComponentDetailBlockHover(block.tableId)"
              @mouseleave="onComponentDetailBlockMouseLeave()"
            ></th>
          </tr>
        </table>

        <div v-if="componentDetailSelectedId">
          <br />
          <b-list-group-item style="max-height: 240px; overflow-y: scroll">
            <p v-if="componentDetailSelectedId !== unfilledText">
              The selected block contains
              {{ componentDetailColumns.length }} column{{
                componentDetailColumns.length > 1 ? "s" : ""
              }}:
            </p>
            <p v-else>
              <span
                >The selected block has
                {{ componentDetailColumns.length }} unfilled column{{
                  componentDetailColumns.length > 1 ? "s" : ""
                }}:</span
              >
              <span class="float-right">
                <b-button
                  size="sm"
                  variant="primary"
                  @click="getJoinSuggestions()"
                  >Get Suggestions</b-button
                >
              </span>
            </p>
            <ul>
              <li v-for="(c, i) in componentDetailColumns" :key="i">{{ c }}</li>
            </ul>
          </b-list-group-item>
        </div>
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
import TableColorManager from "../TableColorManager";
import Common from "../Common";
const UNFILLED_TEXT = "UNFILLED";

export default {
  name: "WorkingTableComponents",
  data() {
    return {
      displayWidth: null,
      selectedHistory: null,
      selectedRow: null,
      componentDetailHoveredId: null,
      componentDetailSelectedId: null,
      componentDetailIndex: null,
      hasUnfilled: false,
      unfilledText: UNFILLED_TEXT,
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
          blocks[i].push({
            tableId: columnNameToTableMap[c]
              ? columnNameToTableMap[c]
              : UNFILLED_TEXT,
            columnName: c,
          });
        }
      }
      return blocks;
    },
    componentDetailColumns() {
      if (
        !this.componentDetailSelectedId ||
        !this.blockMapping[this.componentDetailIndex]
      ) {
        return [];
      }
      const blocks = this.blockMapping[this.componentDetailIndex];
      const columns = [];
      for (let i = 0; i < blocks.length; ++i) {
        if (blocks[i].tableId === this.componentDetailSelectedId) {
          columns.push(blocks[i].columnName);
        }
      }
      return columns;
    },
  },
  methods: {
    getBlockColor(uuid) {
      return uuid !== UNFILLED_TEXT
        ? TableColorManager.getColor(uuid)
        : TableColorManager.nullColor;
    },
    getTableDisplayWidth() {
      return this.$refs.blocksTable.clientWidth;
    },
    onBlockClick(uuid, i) {
      this.selectedHistory = this.histories[i];
      this.selectedRow = this.blockMapping[i];
      this.componentDetailIndex = i;
      this.componentDetailSelectedId = uuid;
      this.hasUnfilled = false;
      for (let b of this.blockMapping[i]) {
        if (!b.tableId || b.tableId === UNFILLED_TEXT) {
          this.hasUnfilled = true;
          break;
        }
      }
      this.$refs.componentDetailModal.show();
    },
    onComponentDetailBlockHover(uuid) {
      this.componentDetailHoveredId = uuid;
    },
    onComponentDetailBlockMouseLeave() {
      this.componentDetailHoveredId = null;
    },
    onComponentDetailBlockClick(uuid) {
      if (this.componentDetailSelectedId === uuid) {
        this.componentDetailSelectedId = null;
        return;
      }
      this.componentDetailSelectedId = uuid;
    },
    getTableTitle(uuid, i) {
      const tableTitle = this.getTableTitleText(uuid, i);
      if (!tableTitle) {
        return `(Unfilled)`;
      }
      const datasetTitle = this.histories[i].dataset.title;
      return `
        <b>${Common.escapeHtml(datasetTitle)}</b>
        <br>
        <i>${Common.escapeHtml(tableTitle)}</i>
      `;
    },

    getTableTitleText(uuid, i) {
      if (this.histories[i].table.id === uuid) {
        return this.histories[i].table.name;
      } else if (
        this.histories[i].joinedTables &&
        this.histories[i].joinedTables[uuid]
      ) {
        return this.histories[i].joinedTables[uuid].targetResource.name;
      }
      return null;
    },
    getBlockStyle(uuid, i, isBlockSelected = false) {
      const isFocused =
        isNaN(parseInt(this.focusedComponentIndex)) ||
        this.focusedComponentIndex === i;
      const color = this.getBlockColor(uuid);
      return {
        "background-color": color,
        "border-color": color,
        cursor: "pointer",
        "user-select": "none",
        opacity: isFocused ? 1 : 0.7,
        " border-style": isBlockSelected ? "solid" : "none",
        "border-top-width": isBlockSelected ? "16px" : 0,
        "border-bottom-width": isBlockSelected ? "16px" : 0,
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
      this.selectedHistory = null;
      this.componentDetailIndex = null;
      this.selectedRow = null;
      this.componentDetailHoveredId = null;
      this.componentDetailSelectedId = null;
      this.$refs.componentDetailModal.hide();
    },
    getDatasetUrl(dataset) {
      return Common.getDatasetUrl(dataset.id);
    },
    openResource(data) {
      this.closeComponentDetailModal();
      const { resource, dataset, resourceStats } = data;
      this.$parent.$parent.$parent.openResource(
        { resource, dataset, resourceStats },
        true
      );
    },
    getJoinSuggestions() {
      const componentId = this.selectedHistory.table.id;
      this.closeComponentDetailModal();
      this.$parent.getJoinSuggestions(null, componentId);
    },
  },
  async mounted() {},
  destroyed() {},
};
</script>

<style lang="scss" scoped>
.working-table-components-table {
  // &.working-table-components-detail-table {
  //   tr {
  //     height: 64px;
  //   }
  // }
  width: 100%;
  tr {
    height: 40px;
  }
}

.float-right {
  float: right;
}
</style>
