'use strict';

const persist  = require('vuex-persistedstate');
const Vue      = require('vue/dist/vue');
const Vuex     = require('vuex');
const { REPOSITORY_COLORS, THEMES } = require('./constants');

Vue.use(Vuex);

const findRepository = (repository, repositories) => {
  return repositories.findIndex(candidate => candidate.path === repository.path);
}

const addRepository = (repository, repositories) => {
  let index = findRepository(repository, repositories);
  if (index > -1) {
    repositories.splice(index, 1);
  }
  repository.color = Math.floor(Math.random() * REPOSITORY_COLORS.length);
  repositories.push(repository);
  return repositories;
}

const getAccessScore = (repository) => {
  // Score the repository based on how frequently and how recently it was accessed.
  // Start with the accessCount and divide by number of weeks of inactivity.
  // Note: we use weeks + 1 so score decays immediately and we don't overly boost recent items.
  if (!repository.accessCount || !repository.accessTime) return 0
  let score = repository.accessCount
  let weeksInactive = Date.now() - repository.accessTime / (7 * 24 * 60 * 60 * 1000);
  return score / (weeksInactive + 1)
}

const store = new Vuex.Store({
  state: {
    activeRepository: null,
    repositories: [],
    showCommitDialog: false,
    theme: THEMES[0]
  },
  mutations: {
    activateRepository (state, repository) {
      let repositories = state.repositories;
      let index = findRepository(repository, repositories);
      if (index === -1) return;

      state.activeRepository = repository;

      repository = repositories[index];
      repository.accessCount = isNaN(repository.accessCount) ? 1 : repository.accessCount + 1;
      repository.accessTime = Date.now();
      Vue.set(state.repositories, index, repository);
    },
    addRepository (state, repository) {
      state.repositories = addRepository(repository, state.repositories);
    },
    removeRepository (state, repository) {
      let repositories = state.repositories;
      let index = findRepository(repository, repositories);
      if (index === -1) return;

      repository = repositories[index];
      repository.removed = true;
      Vue.set(state.repositories, index, repository);

      let activeRepository = state.activeRepository;
      if (activeRepository && activeRepository.path === repository.path) {
        state.activeRepository = null;
      }
    },
    showCommitDialog (state, show) {
      state.showCommitDialog = show;
    },
    setRepositories (state, found) {
      let repositories = state.repositories;
      for (let repository of found) {
        if (findRepository(repository, repositories) > -1) continue;
        repositories = addRepository(repository, repositories);
      }
      state.repositories = repositories;
    },
    setStatusCount (state, { count, repository }) {
      let repositories = state.repositories;
      let index = findRepository(repository, repositories);
      if (index === -1) return;

      repository = repositories[index];
      repository.statusCount = count;
      Vue.set(state.repositories, index, repository);
    },
    setTheme (state, theme) {
      state.theme = theme;
    }
  },
  getters: {
    repositories: state => {
      let repositories = state.repositories;

      // Filter out deleted repos
      repositories = repositories.filter(repository => !repository.removed)

      // Normalize repositories to always contain the basic properties we expect
      return state.repositories.map(repository => Object.assign({
        accessCount: 0,
        accessTime: 0,
        statusCount: 0
      }, repository));
    },
    sortedRepositories: (state, getters) => {
      return getters.repositories.sort((a, b) => {
        let aScore = getAccessScore(a);
        let bScore = getAccessScore(b);
        if (aScore !== bScore) {
          return bScore - aScore;
        }
        return a.name.localeCompare(b.name);
      })
    }
  },
  plugins: [
    persist()
  ]
});

module.exports = store