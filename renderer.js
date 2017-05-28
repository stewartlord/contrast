'use strict';

const electron   = require('electron');
const jQuery     = require('jquery');
const NodeGit    = require("nodegit");
const Vue        = require('vue/dist/vue');

const legacy     = require('./legacy');
const fileList   = require('./components/file-list');
const sidebar    = require('./components/sidebar');
const toolbar    = require('./components/toolbar');

window.jQuery    = jQuery;
window.$         = jQuery;

$(function(){
  // take over scrolling via mouse 'wheel' events
  // align changes when they scroll to a point 1/3 of the way down the window
  // find the line that corresponds to this point based on line-height
  let body = $('body');
  body.on('wheel', function(event){
    event.preventDefault();
    event.stopPropagation();

    let deltaY = event.originalEvent.deltaY;
    let deltaX = event.originalEvent.deltaX;

    requestAnimationFrame(function() {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        legacy.scrollX(body[0], event.originalEvent.deltaX);
      } else {
        legacy.scrollY(body[0], event.originalEvent.deltaY);
      }
    });
  });
});

// instantiate the Contrast (Vue.js) application
let contrast = new Vue({
  el: 'contrast',
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
    }
  },
  template: `
    <div class="contrast">
      <sidebar
        v-bind:activeRepository="activeRepository"
        v-on:activateRepository="activateRepository">
      </sidebar>
      <toolbar v-bind:buttons="toolbarButtons"></toolbar>
      <file-list
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Staged'"
        v-bind:files="files.index"
        v-bind:isIndexView="true">
      </file-list>
      <file-list
        v-bind:activeRepository="activeRepository"
        v-bind:heading="'Unstaged'"
        v-bind:files="files.working"
        v-bind:isIndexView="false">
      </file-list>
    </div>
  `
});