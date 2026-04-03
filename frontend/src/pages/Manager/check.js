// check.js - reads the tail of Datasets.jsx
const fs = require('fs');
const lines = fs.readFileSync('d:/Desktop/WDP/WDP301/frontend/src/pages/Manager/Datasets.jsx', 'utf8').split('\n');
console.log('Total lines:', lines.length);
for (let i = Math.max(0, lines.length - 20); i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
