<template>
  <div class="outer-container">
    <div class="input-group mb-3">
      <b-form-input
        v-model="searchBarText"
        v-on:keyup.enter="searchButtonClicked()"
        placeholder="Enter a keyword"
      ></b-form-input>
      <div class="input-group-append">
        <b-button
          variant="success"
          class="search-button"
          v-on:click="searchButtonClicked()"
          >Search</b-button
        >
      </div>
    </div>
    <div class="serach-results-container">
      <b-card v-for="r in results" :key="r._id">
        <h4 class="card-title">
          <a
            href="#"
            @click.prevent="jumpToOpenCanada(r.id)"
            title="Open this in open canada"
            >{{ r.title }}</a
          >
        </h4>
        <h5>{{ r.portal_release_date }}</h5>
        <h6>{{ r.subject.join(", ") }}</h6>
        <p>{{ r.notes }}</p>
        <b-list-group>
          <b-list-group-item v-for="(t, i) in r.tuples" :key="i"
            ><b> Row {{ t.row_number }}:</b> {{ t.tuple.join(", ") }}</b-list-group-item
          >
        </b-list-group>
      </b-card>
    </div>
  </div>
</template>

<script>
import axios from "axios";
export default {
  name: "Search",
  data() {
    return {
      searchBarText: "",
      results: [],
    };
  },
  methods: {
    searchButtonClicked: async function () {
      if (this.searchBarText.length === 0) {
        this.results = [];
        return;
      }
      this.results = await this.loadSeachResult(this.searchBarText);
      console.log(this.results);
    },
    loadSeachResult: async function (keyword) {
      const params = new URLSearchParams([["q", keyword]]);
      const results = await axios
        .get(`/api/search`, { params })
        .then((res) => res.data);
      for (let r of results) {
        r.tuples = [];
        for (let rs of r.resources) {
          if (rs.tuples) {
            for (let t in rs.tuples) {
              r.tuples.push({ row_number: parseInt(t), tuple: rs.tuples[t] });
            }
          }
        }
      }
      return results;
    },
    jumpToOpenCanada: function (uuid) {
      window
        .open("https://open.canada.ca/data/en/dataset/" + uuid, "_blank")
        .focus();
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
