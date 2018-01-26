'use strict';

const Vue = require('vue/dist/vue');

Vue.component('commit-dialog', {
  props: [
    'files'
  ],
  data: function () {
    return {
      description: ''
    };
  },
  methods: {
    closeDialog: function () {
      this.$store.commit('showCommitDialog', false)
    },
  },
  template: `
    <div class="commit-dialog">
      <div class="dialog">
        <div class="message">
          <div class="summary">{{ description.slice(0, 50) }}</div>
          <textarea placeholder="Description" v-model="description"/>
        </div>
        <div class="files">
          <label v-for="file in files" class="file">
           <input type="checkbox" checked="checked"> {{ file.path() }}
          </label>
        </div>
        <div class="buttons">
          <div class="cancel button" v-on:click="closeDialog">Cancel</div>
          <div class="commit button">Commit</div>
        </div>
      </div>
    </div>
  `
});