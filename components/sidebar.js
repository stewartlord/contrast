'use strict';

const Vue = require('vue/dist/vue');

Vue.component('sidebar', {
  data: function () {
    // find all git repositories in the user's home directory
    let gitWorker = new Worker('workers/find-repos.js');
    gitWorker.onmessage = (event) => {
      this.repositories = event.data;
    }

    // stub while we wait for repos to load
    return { repositories: [] };
  },
  template: `
    <div class="sidebar">
      <div class="button"
        v-for="repository in repositories"
        v-bind:title="repository.name">
        {{ repository.name.substr(0,2) }}
      </div>
      <div class="button add">+</div>
    </div>
  `
});