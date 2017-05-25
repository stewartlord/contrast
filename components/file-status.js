'use strict';

const Vue      = require('vue/dist/vue');

const fileDiff = require('./file-diff');

Vue.component('file-status', {
  props: ['file'],
  data: function () {
    return { active: false };
  },
  methods: {
    activate: function () {
      this.active = !this.active;
    }
  },
  template: `
    <div v-bind:class="['file-status', { active: active }]">
      <div class="header" v-on:click="activate">
        <span class="filename">
          <i v-bind:class="['fa', { 'fa-caret-right': !active, 'fa-caret-down': active }]"></i>
          {{ file.path() }}
        </span>
      </div>
      <file-diff v-if="active"></file-diff>
    </div>
  `
});