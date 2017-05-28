'use strict';

const Vue    = require('vue/dist/vue');

const legacy = require('../legacy');

Vue.component('file-diff', {
  props: ['getLeft', 'getRight'],
  data: function () {
    return {};
  },
  mounted: function () {
    legacy.loadDiff(this.getLeft(), this.getRight());
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