'use strict';

const NodeGit = require('nodegit');
const Vue     = require('vue/dist/vue');

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

      // Create a new tree based on head.
      // Insert staged files that are checked.
      // @todo: handle initial commit case (no parent)
      // @todo: check for conflicts
      let repo     = await NodeGit.Repository.open(this.activeRepository.path);
      let author   = NodeGit.Signature.default(repo);
      let index    = await repo.refreshIndex();
      let head     = await NodeGit.Reference.nameToId(repo, "HEAD");
      let parent   = await repo.getCommit(head);
      let headTree = await parent.getTree();
      let newTree  = await NodeGit.Treebuilder.create(repo, headTree);

      for (let file of this.checkedFiles) {
        let indexEntry = index.getByPath(file);
        newTree.insert(indexEntry.path, indexEntry.id, indexEntry.mode);
      }

      await repo.createCommit('HEAD', author, author, this.description, newTree.write(), [parent]);

      this.$store.commit('showCommitDialog', false)
      this.$emit('statusChanged');
    }
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