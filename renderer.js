'use strict';

const electron = require('electron');
const jQuery   = require('jquery');
const NodeGit  = require("nodegit");
const Vue      = require('vue/dist/vue');

const legacy   = require('./legacy');
const fileList = require('./components/file-list');
const sidebar  = require('./components/sidebar');
const toolbar  = require('./components/toolbar');

window.jQuery  = jQuery;
window.$       = jQuery;

// instantiate the Vue.js application
let app = new Vue({
  el: 'app',
  data: function () {
    return {
      activeRepository: null,
      activeDiff: null,
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
    let body = $('body');
    body.on('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();

      let deltaY = event.originalEvent.deltaY;
      let deltaX = event.originalEvent.deltaX;

      requestAnimationFrame(() => {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          legacy.scrollX(this, body[0], event.originalEvent.deltaX);
        } else {
          legacy.scrollY(this, body[0], event.originalEvent.deltaY);
        }
      });
    });
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
    activateDiff: function (diff) {
      this.activeDiff = diff;
    },
    deactivateDiff: function (diff) {
      if (this.activeDiff === diff) {
        this.activeDiff = null;
      }
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
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Staged'"
        v-bind:files="files.index"
        v-bind:isIndexView="true"
        v-on:activateDiff="activateDiff"
        v-on:deactivateDiff="deactivateDiff">
      </file-list>
      <file-list
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Unstaged'"
        v-bind:files="files.working"
        v-bind:isIndexView="false"
        v-on:activateDiff="activateDiff"
        v-on:deactivateDiff="deactivateDiff">
      </file-list>
    </div>
  `
});