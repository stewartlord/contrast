'use strict';

const fs       = require('fs-extra');
const NodeGit  = require('nodegit');
const path     = require('path');

const GitPlugin = {
  stageFile: async function (repoPath, file) {
    const repo  = await NodeGit.Repository.open(repoPath);
    const index = await repo.refreshIndex();

    if (file.status().includes('WT_DELETED')) {
      await index.removeByPath(file.path());
    } else {
      await index.addByPath(file.path());
    }
    await index.write();
    await index.writeTree();
  },
  unstageFile: async function (repoPath, file) {
    let repo = await NodeGit.Repository.open(repoPath)

    if (file.isNew()) {
      const index = await repo.refreshIndex();
      await index.removeByPath(file.path());
      await index.write();
      await index.writeTree();
    } else {
      const commit = await repo.getHeadCommit();
      const result = await NodeGit.Reset.default(repo, commit, [file.path()]);
    }
  },
  commit: async function (repoPath, description) {
    let repo      = await NodeGit.Repository.open(repoPath);
    let author    = NodeGit.Signature.default(repo);
    let index     = await repo.refreshIndex();
    let indexTree = await index.writeTree();
    let head      = await NodeGit.Reference.nameToId(repo, "HEAD");
    let parent    = await repo.getCommit(head);

    await repo.createCommit('HEAD', author, author, description, indexTree, [parent]);
  }
};

module.exports = {
  install: (Vue, options) => {
    Vue.prototype.$git = GitPlugin;
  },
}
