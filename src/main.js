import Vue from "vue";
import {
  BootstrapVue,
  IconsPlugin,
  BadgePlugin,
  LayoutPlugin,
} from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import "vue-easytable/libs/theme-default/index.css";
import VueEasytable from "vue-easytable";
import { VePagination } from "vue-easytable";

Vue.use(VePagination);
Vue.use(VueEasytable);
Vue.use(BootstrapVue);
Vue.use(IconsPlugin);
Vue.use(BadgePlugin);
Vue.use(LayoutPlugin);

import App from "./App.vue";
import { store } from "./store/store";
import SearchView from "./components/SearchView.vue";
import DataTable from "./components/DataTable.vue";
import DataTableTabs from "./components/DataTableTabs.vue";
import ColumnStats from "./components/ColumnStats.vue";
import DataTableDescription from "./components/DataTableDescription.vue";
import DataTableDetails from "./components/DataTableDetails.vue";
import TableFilters from "./components/TableFilters.vue";
import JoinableTables from "./components/JoinableTables.vue";
import UnionableTables from "./components/UnionableTables.vue";
import WorkingTable from "./components/WorkingTable.vue";
import WorkingTableDescription from "./components/WorkingTableDescription.vue";
import UseCasesDiscovery from "./components/UseCasesDiscovery.vue";
import WorkingTableComponents from "./components/WorkingTableComponents.vue";

Vue.component("search-view", SearchView);
Vue.component("data-table", DataTable);
Vue.component("data-table-tabs", DataTableTabs);
Vue.component("column-stats", ColumnStats);
Vue.component("data-table-description", DataTableDescription);
Vue.component("data-table-details", DataTableDetails);
Vue.component("table-filters", TableFilters);
Vue.component("joinable-tables", JoinableTables);
Vue.component("unionable-tables", UnionableTables);
Vue.component("working-table", WorkingTable);
Vue.component("working-table-description", WorkingTableDescription);
Vue.component("use-cases-discovery", UseCasesDiscovery);
Vue.component("working-table-components", WorkingTableComponents);

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App),
  store,
}).$mount("#app");
