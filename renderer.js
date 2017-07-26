'use strict';

const electron = require('electron');
const jQuery   = require('jquery');
const NodeGit  = require("nodegit");
const persist  = require('vuex-persistedstate');
const Vue      = require('vue/dist/vue');
const Vuex     = require('vuex');

const legacy   = require('./legacy');
const fileList = require('./components/file-list');
const sidebar  = require('./components/sidebar');
const toolbar  = require('./components/toolbar');

window.jQuery  = jQuery;
window.$       = jQuery;

// setup state storage
Vue.use(Vuex);
const store = new Vuex.Store({
  state: {
    repositories: []
  },
  mutations: {
    updateRepositories (state, repositories) {
      state.repositories = repositories;
    }
  },
  plugins: [
    persist()
  ]
});

// instantiate the Vue.js application
let app = new Vue({
  el: 'app',
  store,
  data: function () {
    return {
      activeRepository: null,
      files: {
        index: [],
        working: []
      },
      toolbarButtons: [{
        label: 'Refresh',
        className: 'refresh',
        iconClass: 'fa fa-refresh',
        click: legacy.refresh
      }, {
        label: 'Theme',
        className: 'theme',
        iconClass: 'fa fa-paint-brush',
        menu: legacy.getThemeMenu
      }]
    };
  },
  mounted: function () {
    // take over scrolling via mouse 'wheel' events
    $(document.body).on('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();

      requestAnimationFrame(() => {
        Math.abs(event.originalEvent.deltaX) > Math.abs(event.originalEvent.deltaY)
          ? this.scrollX(event)
          : this.scrollY(event);
      });
    });

    // find all git repositories in the user's home directory
    let gitWorker = new Worker('workers/find-repos.js');
    gitWorker.onmessage = (event) => {
      this.$store.commit('updateRepositories', event.data);
    }
  },
  methods: {
    activateRepository: async function (repository) {
      this.activeRepository = repository;

      // get status of this repository (staged/unstaged files)
      this.files   = {index: [], working: []};
      const repo   = await NodeGit.Repository.open(repository.path);
      const status = await repo.getStatus();
      status.forEach((file) => {
        if (file.inIndex())       this.files.index.push(file);
        if (file.inWorkingTree()) this.files.working.push(file);
      });
    },
    scrollX: function (event) {
      let clientX = event.originalEvent.clientX;
      let clientY = event.originalEvent.clientY;
      let diff    = this.getHoveredDiff(clientX, clientY);
      if (!diff) return;

      let target = $(diff.$el);
      let left   = target.find('.file-left .file-contents')[0];
      let right  = target.find('.file-right .file-contents')[0];
      let master = left.scrollWidth > right.scrollWidth ? left  : right;
      let slave  = left.scrollWidth > right.scrollWidth ? right : left;

      master.scrollLeft += event.originalEvent.deltaX;
      slave.scrollLeft   = master.scrollLeft;
    },
    scrollY: function (event) {
      document.body.scrollTop += event.originalEvent.deltaY;
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
    }
  },
  template: `
    <div class="app">
      <sidebar
        v-bind:activeRepository="activeRepository"
        v-on:activateRepository="activateRepository">
      </sidebar>
      <toolbar v-bind:buttons="toolbarButtons"></toolbar>
      <file-list
        ref="stagedList"
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Staged'"
        v-bind:files="files.index"
        v-bind:isIndexView="true">
      </file-list>
      <file-list
        ref="unstagedList"
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Unstaged'"
        v-bind:files="files.working"
        v-bind:isIndexView="false">
      </file-list>
    </div>
  `
});