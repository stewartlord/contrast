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
      checkedFiles: this.files.map(file => file.path()),
      description: ''
    };
  },
  methods: {
    closeDialog: function () {
      this.$store.commit('showCommitDialog', false)
    },
    commit: async function () {
      if (this.checkedFiles.length === 0) return;

      // Using the command-line client, because NodeGit is too flakey :/
      const child = execFile(
        'git',
        ['commit', '-m', this.description, '--', ...this.checkedFiles],
        {
          cwd: this.activeRepository.path,
          windowsHide: true
        },
        (error) => {
          if (error) {
            alert(error);
          } else {
            this.$store.commit('showCommitDialog', false)
            this.$emit('statusChanged');
          }
        }
      );
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
          <label v-for="file in files" class="file">
           <input type="checkbox" v-bind:value="file.path()" v-model="checkedFiles"> {{ file.path() }}
          </label>
        </div>
        <div class="buttons">
          <div class="cancel button" v-on:click="closeDialog">Cancel</div>
          <div class="commit button" v-bind:class="checkedFiles.length === 0 && 'disabled'" v-on:click="commit">Commit</div>
        </div>
      </div>
    </div>
  `
});