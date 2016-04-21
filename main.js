'use strict';

const electron = require('electron');
const path     = require('path');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

var dev  = process.argv.indexOf('--dev');
var args = process.argv.slice(dev !== -1 ? 2 : 1);

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1280, height: 800});

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // Open the DevTools in dev mode
  if (dev > 0) {
    mainWindow.webContents.openDevTools();
  }

  // Diff given files
  mainWindow.webContents.on('did-finish-load', function() {
    // In dev mode the working directory changes, so absolutize paths to O_PWD
    if (dev > 0 && process.env.O_PWD) {
      if (args[1] && !path.isAbsolute(args[1])) args[1] = path.join(process.env.O_PWD, args[1]);
      if (args[2] && !path.isAbsolute(args[2])) args[2] = path.join(process.env.O_PWD, args[2]);
    }
    mainWindow.webContents.send('args', args);
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    app.quit();
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
