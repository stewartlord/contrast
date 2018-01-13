'use strict';

const legacy = require('../legacy');
const path   = require('path');
const Vue    = require('vue/dist/vue');

Vue.component('image-diff', {
  props: ['file', 'getLeft', 'getRight'],
  data: function () {
    return {
      leftImageUrl: '',
      rightImageUrl: ''
    };
  },
  mounted: function () {
    this.getLeft().then((buffer) => {
      this.leftImageUrl = this.getObjectUrl(buffer);
    });
    this.getRight().then((buffer) => {
      this.rightImageUrl = this.getObjectUrl(buffer);
    });
  },
  beforeDestroy: function () {
    URL.revokeObjectURL(this.leftImageUrl);
    URL.revokeObjectURL(this.rightImageUrl);
  },
  methods: {
    refresh: function () {
    },
    scrollX: function (event) {
    },
    scrollY: function (event, scrollTop) {
    },
    getObjectUrl: function (buffer) {
      let blob = new Blob([buffer], {type: `image/${path.extname(this.file.path()).slice(1)}`});
      return URL.createObjectURL(blob);
    }
  },
  template: `
    <div class="diff-viewer image-diff">
      <div class="file file-left">
        <img v-bind:src="leftImageUrl">
      </div>
      <div class="river"></div>
      <div class="file file-right">
        <img v-bind:src="rightImageUrl">
      </div>
    </div>
  `
});