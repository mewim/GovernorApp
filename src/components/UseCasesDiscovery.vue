<template>
  <div class="outer-container" ref="outerContainer">
    <div class="pagination-container">
      <ve-pagination
        :total="totalCount"
        :page-size-option="[25, 50, 100]"
        :page-index="pageIndex"
        :page-size="pageSize"
        @on-page-number-change="pageNumberChange"
        @on-page-size-change="pageSizeChange"
      />
    </div>
    <div class="search-result-cards-container" ref="resultContainer">
      <div v-if="!isUnionMode">
        <b-card v-for="(plan, i) in plans" :key="i">
          <p>
            <b>Source Schema: </b>
            {{ getSchema(plan.union[0].join.query_uuid) }}
          </p>
          <hr />
          <p>
            <b>Target Schema: </b>
            {{ getSchema(plan.union[0].join.target_uuid) }}
          </p>
          <hr />
          <p>
            <b>Percentage of joinables within unionable group: </b>
            {{ (plan.joinable_percentage * 100).toFixed(2) }}%
          </p>
          <hr />
          <b>Union:</b>
          <ul>
            <li v-for="(joinPlan, j) in plan.union" :key="j">
              <b>Join:</b>
              <ul>
                <li>
                  <p>
                    <a
                      href="#"
                      @click="openResource(joinPlan.join.target_uuid)"
                      >{{ getResourceName(joinPlan.join.query_uuid) }}</a
                    >
                    from
                    <a
                      :href="getDatasetUrl(joinPlan.join.query_uuid)"
                      target="_blank"
                      >{{ getDatasetName(joinPlan.join.query_uuid) }}</a
                    >
                  </p>
                  <p>
                    <b
                      >Key:
                      {{
                        getKey(
                          joinPlan.join.query_uuid,
                          joinPlan.join.query_index
                        )
                      }}</b
                    >
                  </p>
                </li>
                <li>
                  <p>
                    <a
                      href="#"
                      @click="openResource(joinPlan.join.target_uuid)"
                      >{{ getResourceName(joinPlan.join.target_uuid) }}</a
                    >
                    from
                    <a
                      :href="getDatasetUrl(joinPlan.join.target_uuid)"
                      target="_blank"
                      >{{ getDatasetName(joinPlan.join.target_uuid) }}</a
                    >
                  </p>
                  <p>
                    <b
                      >Key:
                      {{
                        getKey(
                          joinPlan.join.target_uuid,
                          joinPlan.join.target_index
                        )
                      }}</b
                    >
                  </p>
                </li>
              </ul>
            </li>
          </ul>
        </b-card>
      </div>
      <div v-else>
        <b-card v-for="(plan, i) in plans" :key="i">
          <p>
            <b>Schema: </b>
            {{ getSchema(plan.union[0]) }}
          </p>
          <hr />
          <p>
            <b>Count: </b>
            {{ plan.union.length }}
          </p>
          <hr />
          <b>Union:</b>
          <ul>
            <li v-for="(uuid, j) in plan.union" :key="j">
              <p>
                <a href="#" @click="openResource(uuid)">{{
                  getResourceName(uuid)
                }}</a>
                from
                <a :href="getDatasetUrl(uuid)" target="_blank">{{
                  getDatasetName(uuid)
                }}</a>
              </p>
            </li>
          </ul>
        </b-card>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import { VeLoading } from "vue-easytable";
import Common from "../Common";

export default {
  name: "UseCaseDiscovery",
  data() {
    return {
      pageIndex: 1,
      pageSize: 25,
      totalCount: 0,
      plans: [],
      resourcesHash: {},
      inferredStatsHash: {},
      loadingInstance: null,
    };
  },
  props: {
    isUnionMode: {
      type: Boolean,
      required: true,
    },
  },
  watch: {
    isUnionMode() {
      this.reloadData(true);
    },
  },
  computed: {},
  methods: {
    loadTotalCount: async function () {
      const url = this.isUnionMode
        ? "/api/unionable/count"
        : "/api/usecasediscoveries/count";
      return await axios.get(url).then((response) => response.data.count);
    },
    loadDataForPage: async function (pageIndex, pageSize) {
      const skip = (pageIndex - 1) * pageSize;
      const limit = pageSize;
      const url = this.isUnionMode
        ? "/api/unionable/usecases"
        : "/api/usecasediscoveries";
      return await axios
        .get(url, {
          params: {
            skip,
            limit,
          },
        })
        .then((response) => response.data);
    },
    pageNumberChange(pageIndex) {
      this.pageIndex = pageIndex;
      this.reloadData();
      this.scrollToTop();
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.reloadData();
      this.scrollToTop();
    },
    scrollToTop() {
      this.$refs.resultContainer.scrollTop = 0;
    },
    getSchema(uuid) {
      return this.inferredStatsHash[uuid].schema.fields
        .map((f) => f.name)
        .join(", ");
    },
    getResourceName(uuid) {
      return this.resourcesHash[uuid].resource.name;
    },
    getDatasetName(uuid) {
      return this.resourcesHash[uuid].dataset.title;
    },
    reloadData(hideAnimation = false) {
      if (this.loadingInstance && !hideAnimation) {
        this.loadingInstance.show();
      }
      this.loadTotalCount().then((count) => {
        this.totalCount = count;
      });
      this.loadDataForPage(this.pageIndex, this.pageSize).then((result) => {
        const resourcesHash = {};
        const inferredStatsHash = {};
        for (let m of result.metadata) {
          for (let r of m.resources) {
            resourcesHash[r.id] = { resource: r, dataset: m };
          }
        }
        for (let i of result.inferredstats) {
          inferredStatsHash[i.uuid] = i;
        }
        this.resourcesHash = resourcesHash;
        this.inferredStatsHash = inferredStatsHash;
        this.plans = result.plans;
        if (this.loadingInstance && !hideAnimation) {
          this.loadingInstance.close();
        }
      });
    },
    getDatasetUrl(resourceId) {
      return Common.getDatasetUrl(this.resourcesHash[resourceId].dataset.id);
    },
    openResource(resourceId) {
      const r = this.resourcesHash[resourceId];
      const dataset = r.dataset;
      const resource = r.resource;
      const resourceStats = this.inferredStatsHash[resourceId];
      this.$parent.openResource({ resource, dataset, resourceStats }, true);
    },
    getKey(resourceId, index) {
      return this.inferredStatsHash[resourceId].schema.fields[index].name;
    },
    isActive: function () {
      return this.$parent.isUseCasesDiscoveryActive;
    },
  },
  mounted() {
    this.loadingInstance = VeLoading({
      target: this.$refs.outerContainer,
      name: "wave",
    });
    this.reloadData(true);
  },
  destroyed() {
    if (this.loadingInstance) {
      this.loadingInstance.destroy();
      this.loadingInstance = null;
    }
  },
};
</script>

<style lang="scss" scoped>
.outer-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pagination-container {
  width: 100%;
  border: 1px solid #eee;
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding-top: 4px;
  padding-bottom: 4px;
  a.ve-dropdown-dt-selected {
    width: 120px !important;
  }
}
</style>
