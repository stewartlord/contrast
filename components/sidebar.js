'use strict';

const electron = require('electron');
const Vue = require('vue/dist/vue');
const path = require('path');
const { REPOSITORY_COLORS } = require('../constants');

Vue.component('sidebar', {
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
      return REPOSITORY_COLORS[repository.color] || REPOSITORY_COLORS[0];
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
    },
    selectRepository: function () {
      const dialog = electron.remote.dialog;

      dialog.showOpenDialog(
        electron.remote.getCurrentWindow(),
        { properties: ['openDirectory'] },
        (paths) => {
          if (paths && paths.length) {
            let directory = paths.pop();
            this.$store.commit('addRepository', {
              path: directory,
              name: path.basename(directory)
            });
          }
        }
      );
    }
  },
  template: `
    <div class="sidebar">
      <div class="repositories">
        <div
          v-for="repository in repositories"
          v-bind:class="['button', { active: activeRepository && activeRepository.path === repository.path }]"
          v-bind:style="{ backgroundColor: getColor(repository), borderColor: getColor(repository) }"
          v-bind:title="repository.name"
          v-on:click="activateRepository(repository)"
          v-on:contextmenu="contextMenu(repository)">
          {{ repository.name.substr(0,2) }}
        </div>
      </div>
      <div class="button add" v-on:click="selectRepository()">+</div>
    </div>
  `
});