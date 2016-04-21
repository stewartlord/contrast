# Contrast

This is a work in progress. This is very early in development.
![Screenshot Dark](/screenshot-dark.png)
![Screenshot Light](/screenshot-light.png)

## Features

- Syntax highlighting
- Magic scrolling
- Sub-line diffing
- Support for Atom themes

## To Use

- npm install
- npm start left-file right-file

## To Use with Git

- git config --global diff.tool contrast
- git config --global difftool.contrast.cmd 'export O_PWD=$PWD; npm --prefix=/path/to/contrast start $LOCAL $REMOTE"
cd /Users/slord/Git/contrast/; npm start $LOCAL $REMOTE'
- git config --global difftool.prompt false
- git difftool

## To Do

- Add persistent config (preferences)
- Fix growing list of reproducible bugs
- Clean-up code (start using modules)
- Add prev/next buttons
- Change app name in menu
- Make release build
- Add ability to edit content
- Everything else

#### License [MIT](LICENSE)
