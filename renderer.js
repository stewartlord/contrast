'use strict';

const electron = require('electron');
const jQuery   = require('jquery');
const NodeGit  = require("nodegit");
const persist  = require('vuex-persistedstate');
const Vue      = require('vue/dist/vue');

const commitDialog = require('./components/commit-dialog');
const legacy       = require('./legacy');
const fileList     = require('./components/file-list');
const GitPlugin    = require('./plugins/git');
const sidebar      = require('./components/sidebar');
const store        = require('./store');
const toolbar      = require('./components/toolbar');
const welcome      = require('./components/welcome');
const { THEMES }   = require('./constants');

window.jQuery  = jQuery;
window.$       = jQuery;

Vue.use(GitPlugin);

// instantiate the Vue.js application
let app = new Vue({
  el: 'app',
  store,
  computed: {
    activeRepository: function () {
      return this.$store.state.activeRepository;
    },
    repositories: function () {
      return this.$store.state.repositories;
    },
    showCommitDialog: function () {
      return this.$store.state.showCommitDialog;
    },
    theme: function () {
      return this.$store.state.theme;
    }
  },
  data: function () {
    return {
      currentBranch: '',
      files: {
        index: [],
        working: []
      },
      toolbarButtons: [{
        label: 'Refresh',
        className: 'refresh',
        iconClass: 'fa fa-refresh',
        click: this.getStatus,
        disabled: () => !this.activeRepository
      }, {
        label: 'Theme',
        className: 'theme',
        iconClass: 'fa fa-adjust',
        click: this.toggleTheme,
      }, {
        label: 'Commit',
        className: 'commit',
        iconClass: 'fa fa-database',
        click: () => this.$store.commit('showCommitDialog', true),
        disabled: () => !this.activeRepository
      }]
    };
  },
  watch: {
    activeRepository: function (repository) {
      // Anytime the repository changes, check its status and branch
      this.getStatus();
      this.getCurrentBranch();
    },
    repositories: function (newRepositories, oldRepositories) {
      // Anytime a repository is added, stat it
      let added = newRepositories.filter(repository => oldRepositories.indexOf(repository) < 0);
      this.statRepositories(added);
    }
  },
  mounted: function () {
    // If we have an active repository, get status on it
    if (this.activeRepository) {
      this.getStatus();
    }

    // Stat repos periodically (every 60s)
    this.statRepositories();
    setInterval(this.statRepositories, 1000 * 60);

    // Check the current branch periodically (every 15s)
    this.getCurrentBranch();
    setInterval(this.getCurrentBranch, 1000 * 15);

    // Find all git repositories in the user's home directory
    let findRepoWorker = new Worker('workers/find-repos.js');
    findRepoWorker.onmessage = (event) => {
      this.$store.commit('setRepositories', event.data);
    }
  },
  methods: {
    getStatus: async function (repository, quiet = false) {
      repository = repository || this.activeRepository;
      let files = {index: [], working: []};
      try {
        const repo   = await NodeGit.Repository.open(repository.path);
        const status = await repo.getStatus();
        status.forEach((file) => {
          if (file.inIndex())       files.index.push(file);
          if (file.inWorkingTree()) files.working.push(file);
        });
        this.$store.commit('setStatusCount', {
          count: files.index.length + files.working.length,
          repository: repository
        });
        if (repository === this.activeRepository) {
          this.files = files;
        }
      } catch (error) {
        quiet ? console.error(error) : alert(error);
      }
    },
    getCurrentBranch: async function (repository, quiet = false) {
      repository = repository || this.activeRepository;
      if (!repository) return;
      try {
        const repo   = await NodeGit.Repository.open(repository.path);
        const branch = await repo.getCurrentBranch();
        this.currentBranch = branch.shorthand();
      } catch (error) {
        quiet ? console.error(error) : alert(error);
      }
    },
    scrollFiles: function (event) {
      event.preventDefault();
      event.stopPropagation();

      requestAnimationFrame(() => {
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? this.scrollX(event)
          : this.scrollY(event);
      });
    },
    scrollX: function (event) {
      let clientX = event.clientX;
      let clientY = event.clientY;
      let diff    = this.getHoveredDiff(clientX, clientY);
      if (diff) {
        diff.scrollX(event);
      }
    },
    scrollY: function (event) {
      document.body.scrollTop += event.deltaY;
      let diffs = this.getVisibleDiffs();
      for (let diff of diffs) {
        diff.scrollY(event, document.body.scrollTop);
      }
    },
    getHoveredDiff: function (x, y) {
      let element = document.elementFromPoint(x, y);
      let diffElement = $(element).closest('.file-diff')[0];
      if (!diffElement) return;

      for (let diff of this.getActiveDiffs()) {
        if (diff.$el === diffElement) {
          return diff;
        }
      }
    },
    getActiveDiffs: function () {
      if (!this.activeRepository) return [];
      let activeDiffs = [];
      for (let list of [this.$refs.stagedList, this.$refs.unstagedList]) {
        if (!list.$refs || !list.$refs.fileStatuses) continue;
        for (let status of list.$refs.fileStatuses) {
          if (status.active) {
            activeDiffs.push(status.$refs.fileDiff);
          }
        }
      }
      return activeDiffs;
    },
    getVisibleDiffs: function () {
      let visible = [];
      let scrollTop = document.body.scrollTop;
      let scrollBottom = scrollTop + document.body.clientHeight;
      for (let diff of this.getActiveDiffs()) {
        let top = diff.$el.offsetTop;
        let bottom = diff.$el.offsetTop + diff.$el.clientHeight;
        if ((top >= scrollTop && top <= scrollBottom)
          || (bottom >= scrollTop && bottom <= scrollBottom)
          || (top <= scrollTop && bottom >= scrollBottom)
        ) {
          visible.push(diff);
        }
      }
      return visible;
    },
    statRepositories: async function (repositories) {
      repositories = repositories || this.repositories;
      for (let repository of repositories) {
        if (!repository.removed) {
          await this.getStatus(repository, true);
        }
      }
    },
    toggleTheme: function () {
      let currentTheme = THEMES.findIndex((theme) => theme.file === this.$store.state.theme.file);
      let nextTheme = ++currentTheme % THEMES.length;
      this.$store.commit('setTheme', THEMES[nextTheme]);
    }
  },
  template: `
    <div v-bind:class="[
      'app',
      theme.label.toLowerCase() + '-theme',
      activeRepository ? 'active-repository': ''
    ]">
      <link v-bind:href="theme.file" rel="stylesheet">
      <sidebar v-bind:activeRepository="activeRepository"/>
      <toolbar v-bind:buttons="toolbarButtons">
        <template v-if="activeRepository" slot="title">
          <span class="repository">{{ activeRepository.name }}</span>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <line vector-effect="non-scaling-stroke" x1="0" y1="0" x2="100" y2="50" />
            <line vector-effect="non-scaling-stroke" x1="0" y1="100" x2="100" y2="50" />
          </svg>
          <span class="branch">{{ currentBranch }}</span>
        </template>
      </toolbar>
      <template v-if="activeRepository">
        <div v-on:wheel="scrollFiles">
          <file-list
            ref="stagedList"
            v-bind:activeRepository="activeRepository"
            v-bind:heading="'Staged'"
            v-bind:files="files.index"
            v-bind:isIndexView="true"
            v-on:statusChanged="getStatus()"
          />
          <file-list
            ref="unstagedList"
            v-bind:activeRepository="activeRepository"
            v-bind:heading="'Unstaged'"
            v-bind:files="files.working"
            v-bind:isIndexView="false"
            v-on:statusChanged="getStatus()"
          />
        </div>
      </template>
      <template v-else>
        <welcome/>
      </template>
      <commit-dialog
        v-if="showCommitDialog"
        v-bind:activeRepository="activeRepository"
        v-bind:files="files"
        v-on:statusChanged="getStatus()"
      />
    </div>
  `
});