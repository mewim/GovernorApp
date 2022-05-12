<template>
  <div class="outer-container">
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
    <div class="search-result-cards-container">
      <b-card v-for="(plan, i) in plans" :key="i">
        <p>
          <b>Source Schema: </b> {{ getSchema(plan.union[0].join.query_uuid) }}
        </p>
        <hr />
        <p>
          <b>Target Schema: </b> {{ getSchema(plan.union[0].join.target_uuid) }}
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
                    :href="getResourceUrl(joinPlan.join.target_uuid)"
                    target="_blank"
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
                    :href="getResourceUrl(joinPlan.join.target_uuid)"
                    target="_blank"
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
  </div>
</template>

<script>
import axios from "axios";

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
    };
  },
  watch: {},
  computed: {},
  methods: {
    loadTotalCount: async function () {
      return await axios
        .get("/api/usecasediscoveries/count")
        .then((response) => response.data.count);
    },
    loadDataForPage: async function (pageIndex, pageSize) {
      const skip = (pageIndex - 1) * pageSize;
      const limit = pageSize;
      return await axios
        .get("/api/usecasediscoveries", {
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
    },
    pageSizeChange(pageSize) {
      this.pageIndex = 1;
      this.pageSize = pageSize;
      this.reloadData();
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
    reloadData() {
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
      });
    },
    getDatasetUrl(resourceId) {
      return (
        "https://open.canada.ca/data/en/dataset/" +
        this.resourcesHash[resourceId].dataset.id
      );
    },
    getResourceUrl(resourceId) {
      return this.getDatasetUrl(resourceId) + "/resource/" + resourceId;
    },
    getKey(resourceId, index) {
      return this.inferredStatsHash[resourceId].schema.fields[index].name;
    },
  },
  mounted() {
    this.reloadData();
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
