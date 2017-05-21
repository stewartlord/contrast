const fs   = require('fs');
const os   = require('os');
const path = require('path');

let repos = [];

function findRepos(directory) {
  let entries = fs.readdirSync(directory);
  for (let entry of entries) {
    fullPath = path.join(directory, entry);
    try {
      isDirectory = fs.statSync(fullPath).isDirectory();
    } catch (error) {
      // we expect some files will come and go
      continue;
    }

    if (!isDirectory) {
      continue;
    }

    if (entry === '.git') {
      repos.push(directory);
      continue;
    }

    // don't explore hidden directories or Library
    if (entry.charAt(0) === '.' || entry === 'Library') {
      continue;
    }

    findRepos(fullPath);
  }
}

findRepos(os.homedir());

postMessage(repos);