'use strict';

const THEMES = [
  {label: 'Dark',  file: 'themes/atom-dark-syntax.css'},
  {label: 'Light', file: 'themes/atom-light-syntax.css'}
];

const REPOSITORY_COLORS = [
  '#ef5350', // red lighten-1
  '#ec407a', // pink lighten-1
  '#ab47bc', // purple lighten-1
  '#7e57c2', // deep-purple lighten-1
  '#5c6bc0', // indigo lighten-1
  '#42a5f5', // blue lighten-1
  '#29b6f6', // light-blue lighten-1
  '#26c6da', // cyan lighten-1
  '#26a69a', // teal lighten-1
  '#66bb6a', // green lighten-1
  '#9ccc65', // light-green lighten-1
  '#d4e157', // lime lighten-1
  '#fbc02d', // yellow darken-2
  '#ffca28', // amber lighten-1
  '#ffa726', // orange lighten-1
  '#ff7043', // deep-orange lighten-1
  '#8d6e63'  // brown lighten-1
];

module.exports = {
  REPOSITORY_COLORS,
  THEMES
};