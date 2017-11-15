'use strict';

const electron = require('electron');
const Vue      = require('vue/dist/vue');

Vue.component('toolbar', {
  props: ['buttons'],
  data: function () {
    return {};
  },
  methods: {
    click: function (event, button) {
      if (button.click) {
        return button.click();
      } else if (button.menu) {
        let buttonElement = $(event.target).closest('.button');
        button.menu().popup(
          electron.remote.getCurrentWindow(),
          Math.round(buttonElement.offset().left),
          buttonElement.outerHeight()
        );
      }
    }
  },
  template: `
    <div class="toolbar">
      <span
        v-for="button in buttons"
        v-bind:title="button.label"
        v-bind:class="['button', button.className]"
        v-on:click.stop="click($event, button)">
        <i v-bind:class="button.iconClass"></i>
        <i v-if="button.menu" class="fa fa-caret-down"></i>
      </span>
    </div>
  `
});