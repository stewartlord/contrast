# Contrast

This is a work in progress. This is very early in development.
![Screenshot](/screenshot.png)

## Features

- Syntax highlighting
- Magic scrolling
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

- Make file gutter background extend top to bottom
- Fix scroll to top such that left/right align on line 0
- Sub-line diffing
- Synchronize side-scrolling
- Everything else

#### License [MIT](LICENSE)
