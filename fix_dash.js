const fs = require('fs');
let c = fs.readFileSync('c:/Users/PC/Downloads/wdp/WDP301/frontend/src/pages/Reviewer/Dashboard.jsx', 'utf8');
c = c.replace(/navigate\('\/reviewer\/tasks\/\?anns='\);/g, 'navigate("/reviewer/tasks/" + eligible[0]._id + "?anns=" + anns);');
fs.writeFileSync('c:/Users/PC/Downloads/wdp/WDP301/frontend/src/pages/Reviewer/Dashboard.jsx', c, 'utf8');
console.log('done dash');

// fix History.jsx - remove escaped quotes
let h = fs.readFileSync('c:/Users/PC/Downloads/wdp/WDP301/frontend/src/pages/Reviewer/History.jsx', 'utf8');
h = h.replace(/\\"/g, '"');
fs.writeFileSync('c:/Users/PC/Downloads/wdp/WDP301/frontend/src/pages/Reviewer/History.jsx', h, 'utf8');
console.log('done history');
