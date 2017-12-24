'use strict';

const electron = require('electron');
const Vue = require('vue/dist/vue');

const SIDEBAR_COLORS = [
  '#ef5350', // red lighten-1
  '#ec407a', // pink lighten-1
  '#ab47bc', // purple lighten-1
  '#7e57c2', // deep-purple lighten-1
  '#5c6bc0', // indigo lighten-1
  '#42a5f5', // blue lighten-1
  '#29b6f6', // light-blue lighten-1
  '#26c6da', // cyan lighten-1
  '#26a69a', // teal lighten-1
  '#66bb6a', // green lighten-1
  '#9ccc65', // light-green lighten-1
  '#d4e157', // lime lighten-1
  '#fbc02d', // yellow darken-2
  '#ffca28', // amber lighten-1
  '#ffa726', // orange lighten-1
  '#ff7043', // deep-orange lighten-1
  '#8d6e63'  // brown lighten-1
];

const sidebar = Vue.component('sidebar', {
 props: ['activeRepository'],
  computed: {
    repositories: function () {
      return this.$store.state.repositories.filter(repository => !repository.removed);
    }
  },
  methods: {
    activateRepository: function (repository) {
      this.$store.commit('activateRepository', repository)
    },
    getColor: function (repository) {
      return SIDEBAR_COLORS[repository.color] || SIDEBAR_COLORS[0];
    },
    contextMenu: function (repository) {
      const Menu = electron.remote.Menu;
      const Item = electron.remote.MenuItem;

      let menu = new Menu();
      menu.append(new Item({
        label: 'Remove',
        click: () => this.$store.commit('removeRepository', repository)
      }));

      menu.popup(electron.remote.getCurrentWindow());
    }
  },
  template: `
    <div class="sidebar">
      <div class="repositories">
        <div
          v-for="repository in repositories"
          v-bind:class="['button', { active: repository.path === activeRepository.path }]"
          v-bind:style="{ backgroundColor: getColor(repository), borderColor: getColor(repository) }"
          v-bind:title="repository.name"
          v-on:click="activateRepository(repository)"
          v-on:contextmenu="contextMenu(repository)">
          {{ repository.name.substr(0,2) }}
        </div>
      </div>
      <div class="button add">+</div>
    </div>
  `
});

module.exports = { sidebar, SIDEBAR_COLORS };