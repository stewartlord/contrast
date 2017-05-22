'use strict';

const Vue  = require('vue/dist/vue');

const file = require('./changed-file');

Vue.component('file-list', {
  props: ['files', 'heading'],
  data: function () {
    return {};
  },
  template: `
    <div class="file-list">
      <div class="header"><span class="heading">{{ heading }}</span></div>
      <changed-file v-for="file in files" v-bind:file="file" v-bind:key="file.filename"></changed-file>
    </div>
  `
});