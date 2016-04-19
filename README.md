# Contrast

This is a work in progress. This is very early in development.
![Screenshot](/screenshot.png)

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
- git config --global difftool.contrast.cmd 'cd /Users/slord/Git/contrast/; npm start $LOCAL $REMOTE'
- git config --global difftool.prompt false
- git difftool

## To Do

- Change app name in menu
- Make release build
- Add another theme and a way to switch themes
- Add a refresh button
- Add ability to edit content
- Everything else

#### License [MIT](LICENSE)
