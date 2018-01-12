'use strict';

const legacy = require('../legacy');
const Vue    = require('vue/dist/vue');

Vue.component('text-diff', {
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
    },
    scrollX: function (event) {
      let target = $(this.$el);
      let left   = target.find('.file-left .file-contents')[0];
      let right  = target.find('.file-right .file-contents')[0];
      let master = left.scrollWidth > right.scrollWidth ? left  : right;
      let slave  = left.scrollWidth > right.scrollWidth ? right : left;

      master.scrollLeft += event.deltaX;
      slave.scrollLeft   = master.scrollLeft;
    },
    scrollY: function (event, scrollTop) {
      legacy.scrollY(this, scrollTop);
    }
  },
  template: `
    <div class="diff-viewer text-diff">
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