'use strict';

const Vue = require('vue/dist/vue');

Vue.component('sidebar', {
  props: ['activeRepository'],
  computed: {
    repositories: function () {
      return this.$store.state.repositories;
    }
  },
  methods: {
    activateRepository: function (repository) {
      this.$emit('activateRepository', repository);
    }
  },
  template: `
    <div class="sidebar">
      <div class="repositories">
        <div
          v-for="repository in repositories"
          v-bind:class="['button', { active: repository === activeRepository }]"
          v-bind:title="repository.name"
          v-on:click="activateRepository(repository)">
          {{ repository.name.substr(0,2) }}
        </div>
      </div>
      <div class="button add">+</div>
    </div>
  `
});