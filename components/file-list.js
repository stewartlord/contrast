'use strict';

const Vue  = require('vue/dist/vue');

const file = require('./file-status');

Vue.component('file-list', {
  props: [
    'activeRepository',
    'files',
    'heading',
    'isIndexView'
  ],
  data: function () {
    return {};
  },
  template: `
    <div class="file-list">
      <div class="header"><span class="heading">{{ heading }}</span></div>
      <file-status
        v-for="file in files"
        v-bind:activeRepository="activeRepository"
        v-bind:file="file"
        v-bind:isIndexView="isIndexView"
        v-bind:key="file.path()">
      </file-status>
    </div>
  `
});