'use strict';

const electron = require('electron');
const jQuery   = require('jquery');
const NodeGit  = require("nodegit");
const persist  = require('vuex-persistedstate');
const Vue      = require('vue/dist/vue');

const legacy   = require('./legacy');
const fileList = require('./components/file-list');
const sidebar  = require('./components/sidebar');
const store    = require('./store');
const toolbar  = require('./components/toolbar');
const welcome  = require('./components/welcome');
const { THEMES } = require('./constants');

window.jQuery  = jQuery;
window.$       = jQuery;

// instantiate the Vue.js application
let app = new Vue({
  el: 'app',
  store,
  computed: {
    activeRepository: function () {
      return this.$store.state.activeRepository;
    },
    theme: function () {
      return this.$store.state.theme;
    }
  },
  data: function () {
    return {
      files: {
        index: [],
        working: []
      },
      toolbarButtons: [{
        label: 'Refresh',
        className: 'refresh',
        iconClass: 'fa fa-refresh',
        click: this.getStatus,
        disabled: () => !this.activeRepository
      }, {
        label: 'Theme',
        className: 'theme',
        iconClass: 'fa fa-paint-brush',
        menu: this.getThemeMenu
      }]
    };
  },
  watch: {
    activeRepository: function (repository) {
      // Anytime the repository changes, check its status
      this.getStatus();
    }
  },
  mounted: function () {
    // If we have an active repository, get status on it
    if (this.activeRepository) {
      this.getStatus();
    }

    // Find all git repositories in the user's home directory
    let gitWorker = new Worker('workers/find-repos.js');
    gitWorker.onmessage = (event) => {
      this.$store.commit('setRepositories', event.data);
    }
  },
  methods: {
    getStatus: async function () {
      const repo   = await NodeGit.Repository.open(this.activeRepository.path);
      const status = await repo.getStatus();
      this.files   = {index: [], working: []};
      status.forEach((file) => {
        if (file.inIndex())       this.files.index.push(file);
        if (file.inWorkingTree()) this.files.working.push(file);
      });
    },
    scrollFiles: function (event) {
      event.preventDefault();
      event.stopPropagation();

      requestAnimationFrame(() => {
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? this.scrollX(event)
          : this.scrollY(event);
      });
    },
    scrollX: function (event) {
      let clientX = event.clientX;
      let clientY = event.clientY;
      let diff    = this.getHoveredDiff(clientX, clientY);
      if (!diff) return;

      let target = $(diff.$el);
      let left   = target.find('.file-left .file-contents')[0];
      let right  = target.find('.file-right .file-contents')[0];
      let master = left.scrollWidth > right.scrollWidth ? left  : right;
      let slave  = left.scrollWidth > right.scrollWidth ? right : left;

      master.scrollLeft += event.deltaX;
      slave.scrollLeft   = master.scrollLeft;
    },
    scrollY: function (event) {
      document.body.scrollTop += event.deltaY;
      let diffs = this.getVisibleDiffs();
      for (let diff of diffs) {
        legacy.scrollY(diff, document.body.scrollTop);
      }
    },
    getHoveredDiff: function (x, y) {
      let element = document.elementFromPoint(x, y);
      let diffElement = $(element).closest('.file-diff')[0];
      if (!diffElement) return;

      for (let diff of this.getActiveDiffs()) {
        if (diff.$el === diffElement) {
          return diff;
        }
      }
    },
    getActiveDiffs: function () {
      if (!this.activeRepository) return [];
      let activeDiffs = [];
      for (let list of [this.$refs.stagedList, this.$refs.unstagedList]) {
        if (!list.$refs || !list.$refs.fileStatuses) continue;
        for (let status of list.$refs.fileStatuses) {
          if (status.active) {
            activeDiffs.push(status.$refs.fileDiff);
          }
        }
      }
      return activeDiffs;
    },
    getVisibleDiffs: function () {
      let visible = [];
      let scrollTop = document.body.scrollTop;
      let scrollBottom = scrollTop + document.body.clientHeight;
      for (let diff of this.getActiveDiffs()) {
        let top = diff.$el.offsetTop;
        let bottom = diff.$el.offsetTop + diff.$el.clientHeight;
        if ((top >= scrollTop && top <= scrollBottom)
          || (bottom >= scrollTop && bottom <= scrollBottom)
          || (top <= scrollTop && bottom >= scrollBottom)
        ) {
          visible.push(diff);
        }
      }
      return visible;
    },
    getThemeMenu: function () {
      const Menu = electron.remote.Menu;
      const Item = electron.remote.MenuItem;

      let menu = new Menu();
      for (let theme of THEMES) {
        menu.append(new Item({
          label:   theme.label,
          type:    'checkbox',
          checked: theme.file === this.$store.state.theme.file,
          click:   () => this.$store.commit('setTheme', theme)
        }));
      }

      return menu;
    }
  },
  template: `
    <div v-bind:class="[
      'app',
      theme.label.toLowerCase() + '-theme',
      activeRepository ? 'active-repository': ''
    ]">
      <link v-bind:href="theme.file" rel="stylesheet">
      <sidebar v-bind:activeRepository="activeRepository"/>
      <toolbar v-bind:buttons="toolbarButtons"/>
      <template v-if="activeRepository">
        <div v-on:wheel="scrollFiles">
          <file-list
            ref="stagedList"
            v-bind:activeRepository="activeRepository"
            v-bind:heading="'Staged'"
            v-bind:files="files.index"
            v-bind:isIndexView="true"
            v-on:statusChanged="getStatus">
          </file-list>
          <file-list
            ref="unstagedList"
            v-bind:activeRepository="activeRepository"
            v-bind:heading="'Unstaged'"
            v-bind:files="files.working"
            v-bind:isIndexView="false"
            v-on:statusChanged="getStatus">
          </file-list>
        </div>
      </template>
      <template v-else>
        <welcome/>
      </template>
    </div>
  `
});