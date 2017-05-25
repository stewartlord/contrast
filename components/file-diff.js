'use strict';

const Vue = require('vue/dist/vue');

Vue.component('file-diff', {
  props: ['file'],
  data: function () {
    return {};
  },
  mounted: function () {
    console.log('mounted outer');
  },
  template: `
    <div class="file-diff">
      <div class="file file-left">
        <div class="file-offset">
          <div class="file-gutter"></div>
          <div class="file-contents"></div>
        </div>
      </div>
      <div class="river"></div>
      <div class="file file-right">
        <div class="file-offset">
          <div class="file-gutter"></div>
          <div class="file-contents"></div>
        </div>
      </div>
    </div>
  `
});