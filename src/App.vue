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
  padding-top: 20px;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 20px;
  display: block;
  position: absolute;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
