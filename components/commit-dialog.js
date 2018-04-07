'use strict';

const { execFile } = require('child_process');
const NodeGit = require('nodegit');
const Vue = require('vue/dist/vue');

Vue.component('commit-dialog', {
  props: [
    'activeRepository',
    'files'
  ],
  data: function () {
    return {
      description: ''
    };
  },
  methods: {
    stageFile: async function (file) {
      await this.$git.stageFile(this.activeRepository.path, file);
      this.$emit('statusChanged');
    },
    unstageFile: async function (file) {
      await this.$git.unstageFile(this.activeRepository.path, file);
      this.$emit('statusChanged');
    },
    closeDialog: function () {
      this.$store.commit('showCommitDialog', false)
    },
    commit: async function () {
      await this.$git.commit(this.activeRepository.path, this.description);
      this.$store.commit('showCommitDialog', false);
      this.$emit('statusChanged');
    }
  },
  template: `
    <div class="commit-dialog">
      <div class="dialog">
        <div class="message">
          <div class="summary">{{
            description.slice(0, description.indexOf('\\n') > -1 ? description.indexOf('\\n') : 50)
          }}</div>
          <textarea placeholder="Description" v-model="description"/>
        </div>
        <div class="files">
          <div class="index-files">
            <label v-for="file in files.index" v-bind:key="file.path()" class="file">
              <input
                type="checkbox"
                v-bind:value="file.path()"
                v-on:click="unstageFile(file)"
                checked>
              {{ file.path() }}
            </label>
          </div>
          <div class="working-files">
            <label v-for="file in files.working" v-bind:key="file.path()" class="file">
              <input
                type="checkbox"
                v-bind:value="file.path()"
                v-on:click="stageFile(file)">
              {{ file.path() }}
            </label>
          </div>
        </div>
        <div class="buttons">
          <div class="cancel button" v-on:click="closeDialog">Cancel</div>
          <div class="commit button" v-bind:class="files.index.length === 0 && 'disabled'" v-on:click="commit">Commit</div>
        </div>
      </div>
    </div>
  `
});