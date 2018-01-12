'use strict';

const legacy = require('../legacy');
const Vue    = require('vue/dist/vue');

Vue.component('image-diff', {
  props: ['file', 'getLeft', 'getRight'],
  data: function () {
    return {};
  },
  methods: {
    refresh: function () {
    },
    scrollX: function (event) {
    },
    scrollY: function (event, scrollTop) {
    }
  },
  template: `
    <div class="diff-viewer image-diff">
      <div class="file file-left">
      IMAGE
      </div>
      <div class="river"></div>
      <div class="file file-right">
      IMAGE
      </div>
    </div>
  `
});