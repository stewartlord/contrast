'use strict';

const imageDiff = require('./image-diff');
const path     = require('path');
const textDiff = require('./text-diff');
const Vue      = require('vue/dist/vue');

Vue.component('file-diff', {
  props: ['file', 'getLeft', 'getRight'],
  methods: {
    isImage: function () {
      let imageTypes = [
        '.apng',
        '.bmp',
        '.gif',
        '.ico',
        '.jpg',
        '.jpeg',
        '.png',
        '.svg',
        '.tif',
        '.tiff',
        '.webp',
        '.xbm'
      ];
      let ext = path.extname(this.file.path());
      return imageTypes.indexOf(ext.toLowerCase()) > -1;
    },
    refresh: function () {
      this.$refs.diffViewer.refresh();
    },
    scrollX: function (event) {
      this.$refs.diffViewer.scrollX(event);
    },
    scrollY: function (event, scrollTop) {
      this.$refs.diffViewer.scrollY(event, scrollTop);
    }
  },
  template: `
    <div class="file-diff">
      <template v-if="isImage()">
        <image-diff
          ref="diffViewer"
          v-bind:file="file"
          v-bind:getLeft="getLeft"
          v-bind:getRight="getRight"
        />
      </template>
      <template v-else>
        <text-diff
          ref="diffViewer"
          v-bind:file="file"
          v-bind:getLeft="getLeft"
          v-bind:getRight="getRight"
        />
      </template>
    </div>
  `
});