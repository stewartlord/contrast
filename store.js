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

const store = new Vuex.Store({
  state: {
    activeRepository: null,
    repositories: [],
    theme: THEMES[0]
  },
  mutations: {
    activateRepository (state, repository) {
      state.activeRepository = repository;
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
    setRepositories (state, found) {
      let repositories = state.repositories;
      for (let repository of found) {
        if (findRepository(repository, repositories) > -1) continue;
        repositories = addRepository(repository, repositories);
      }
      state.repositories = repositories;
    },
    setTheme (state, theme) {
      state.theme = theme;
    }
  },
  plugins: [
    persist()
  ]
});

module.exports = store