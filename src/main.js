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

Vue.component("search-view", SearchView);
Vue.component("data-table", DataTable);
Vue.component("data-table-tabs", DataTableTabs);
Vue.component("column-stats", ColumnStats);
Vue.component("data-table-description", DataTableDescription);

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App),
  store,
}).$mount("#app");
