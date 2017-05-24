'use strict';

const Vue = require('vue/dist/vue');

Vue.component('changed-file', {
  props: ['file'],
  data: function () {
    return {};
  },
  template: `
    <div class="changed-file">
      <div class="header"><span class="filename">{{ file.path() }}</span></div>
    </div>
  `
});