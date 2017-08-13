'use strict';

const Vue    = require('vue/dist/vue');

const legacy = require('../legacy');

Vue.component('file-diff', {
  props: ['file', 'getLeft', 'getRight'],
  data: function () {
    return {
      chunks: [],
      chunkIndex: [],
      lastOffset: {left: 0, right: 0}
    };
  },
  mounted: function () {
    legacy.loadDiff(this, this.getLeft(), this.getRight(), 10);
  },
  methods: {
    refresh: function () {
      this.chunkIndex = [];
      $(this.$el).find('.file-contents, .file-gutter, .river').html("");
      legacy.loadDiff(this, this.getLeft(), this.getRight(), 10);
    }
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