<template>
  <div class="outer-container">
    <div
      class="stats-visualization-container"
      v-if="!isLoading && statTableData"
    >
      <div class="stats-table-container">
        <b-table ref="statsTable" :items="statTableData"> </b-table>
      </div>
      <div class="visualization-iframe-container">
        <iframe class="visualization-iframe" :srcdoc="iframeSource"></iframe>
      </div>
    </div>
    <div
      class="stats-not-available-message"
      v-if="!isLoading && !statTableData"
    >
      <p>Sorry. The stats for the selected table field is not available.</p>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import { VeLoading } from "vue-easytable";
export default {
  data() {
    return {
      loadingInstance: null,
      inferredStats: null,
      inferredHistograms: null,
      resourceId: null,
      fieldName: null,
      isLoading: true,
      iframeSource: "",
    };
  },
  props: {},
  watch: {},
  computed: {
    statTableData() {
      const fieldName = this.fieldName;
      if (
        !this.inferredHistograms ||
        !this.inferredHistograms.histograms[fieldName]
      ) {
        return null;
      }
      const results = [];
      for (let k in this.inferredHistograms.histograms[fieldName]) {
        const v = this.inferredHistograms.histograms[fieldName][k];
        if (typeof v === "number" && isFinite(v)) {
          results.push({
            stat: k.split("_").join(" "),
            value: parseFloat(v.toFixed(2)),
          });
        }
      }
      return results;
    },
  },
  methods: {
    async reloadData(resourceId, fieldName) {
      this.isLoading = true;
      this.resourceId = resourceId;
      this.fieldName = fieldName;
      if (this.loadingInstance) {
        this.loadingInstance.show();
      }
      this.inferredStats = await axios
        .get(`/api/inferredstats/${this.resourceId}`)
        .then((res) => res.data);
      try {
        this.inferredHistograms = await axios
          .get(`/api/inferredhistograms/${this.resourceId}`)
          .then((res) => res.data);
      } catch (err) {
        this.inferredHistograms = null;
      }
      try {
        this.iframeSource = await axios
          .post(`/api/plotlyplot/`, {
            uuid: this.resourceId,
            field: this.fieldName,
          })
          .then((res) => res.data);
      } catch (err) {
        this.iframeSource = null;
      }
      this.loadingInstance.close();
      this.isLoading = false;
    },
  },

  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$el,
      lock: true,
      name: "wave",
    });
    this.loadingInstance.show();
  },
  created() {},
  destroyed() {
    this.loadingInstance.destroy();
    this.loadingInstance = null;
  },
};
</script>

<style lang="scss" scoped>
.outer-container {
  width: 100%;
  height: 50vh;
}
.stats-not-available-message {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}
.stats-visualization-container {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 100%;
  .visualization-iframe-container {
    flex-grow: 1;
    width: 100%;
    .visualization-iframe {
      height: 100%;
      width: 100%;
    }
  }
}
</style>
