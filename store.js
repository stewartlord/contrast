'use strict';

const persist  = require('vuex-persistedstate');
const Vue      = require('vue/dist/vue');
const Vuex     = require('vuex');
const { REPOSITORY_COLORS, THEMES } = require('./constants');

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    activeRepository: null,
    repositories: [],
    theme: THEMES[0]
  },
  mutations: {
    setRepositories (state, found) {
      let known = state.repositories;
      for (let repository of found) {
       if (known.find(existing => existing.path === repository.path)) return;
       repository.color = Math.floor(Math.random() * REPOSITORY_COLORS.length);
       known.push(repository);
      }
      state.repositories = known;
    },
    activateRepository (state, repository) {
      state.activeRepository = repository;
    },
    removeRepository (state, repository) {
      let repositories = state.repositories;
      let index = repositories.findIndex(candidate => candidate.path === repository.path);
      if (index > -1) {
        repository = repositories[index];
        repository.removed = true;
        Vue.set(state.repositories, index, repository);
      }
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