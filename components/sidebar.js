'use strict';

const Vue = require('vue/dist/vue');

Vue.component('sidebar', {
  props: ['activeRepository'],
  data: function () {
    // find all git repositories in the user's home directory
    let gitWorker = new Worker('workers/find-repos.js');
    gitWorker.onmessage = (event) => {
      this.repositories = event.data;
    }

    // stub while we wait for repos to load
    return { repositories: [] };
  },
  methods: {
    activateRepository: function (repository) {
      this.$emit('activateRepository', repository);
    }
  },
  template: `
    <div class="sidebar">
      <div
        v-for="repository in repositories"
        v-bind:class="['button', { active: repository === activeRepository }]"
        v-bind:title="repository.name"
        v-on:click="activateRepository(repository)">
        {{ repository.name.substr(0,2) }}
      </div>
      <div class="button add">+</div>
    </div>
  `
});