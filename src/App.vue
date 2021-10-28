<template>
  <div id="app">
    <Search />
  </div>
</template>

<script>
import Search from "./components/Search.vue";

export default {
  name: "App",
  components: {
    Search,
  },
};
</script>

<style>
#app {
  margin-top: 20px;
  margin-left: 10px;
  margin-right: 10px;
  margin-bottom: 20px;
}
</style>
