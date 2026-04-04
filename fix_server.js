const fs = require('fs');
const content = fs.readFileSync('D:/Desktop/WDP/WDP301/backend/server.js', 'utf8');
const fixed = content.replace(/datasets_new/g, 'datasets');
fs.writeFileSync('D:/Desktop/WDP/WDP301/backend/server.js', fixed);
console.log('Fixed server.js - datasets_new -> datasets');
