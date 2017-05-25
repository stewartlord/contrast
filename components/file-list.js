'use strict';

const Vue  = require('vue/dist/vue');

const file = require('./file-status');

Vue.component('file-list', {
  props: ['files', 'heading'],
  data: function () {
    return {};
  },
  template: `
    <div class="file-list">
      <div class="header"><span class="heading">{{ heading }}</span></div>
      <file-status v-for="file in files" v-bind:file="file" v-bind:key="file.path()"></file-status>
    </div>
  `
});