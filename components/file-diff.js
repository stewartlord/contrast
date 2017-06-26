'use strict';

const Vue    = require('vue/dist/vue');

const legacy = require('../legacy');

Vue.component('file-diff', {
  props: ['getLeft', 'getRight'],
  data: function () {
    return {
      chunkIndex: []
    };
  },
  mounted: function () {
    legacy.loadDiff(this, this.getLeft(), this.getRight());
  },
  methods: {
    activate: function (event) {
      this.$emit('activate', this);
    },
    deactivate: function (event) {
      this.$emit('deactivate', this);
    }
  },
  template: `
    <div class="file-diff" v-on:mouseenter="activate" v-on:mouseleave="deactivate">
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