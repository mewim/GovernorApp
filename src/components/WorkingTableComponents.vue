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
        <div class="d-flex w-100">
          <span>
            <div>
              <span>
                <div
                  class="inline-color-block"
                  :style="{ 'background-color': h.table.color }"
                ></div>
                &nbsp;
                {{ h.table.name }}</span
              >
            </div>
            <small>
              <div class="inline-color-block"></div>
              &nbsp; From: <i>{{ h.dataset.title }}</i>
            </small>
          </span>
        </div>
        <div v-if="h.joinedTables">
          <div v-for="(j, k) in h.joinedTables" :key="k">
            <small>
              <div
                class="inline-color-block"
                :style="{ 'background-color': j.targetResource.color }"
              ></div>
              &nbsp; Joined Table: {{ j.targetResource.name }}
            </small>
          </div>
        </div>
      </b-list-group-item>
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

export default {
  name: "WorkingTableComponents",
  data() {
    return {
      displayWidth: null,
      h: null,
      componentDetailIndex: null,
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
