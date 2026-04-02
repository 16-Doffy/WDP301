const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'frontend/src/components/LayoutTailwind.jsx');
let c = fs.readFileSync(p, 'utf8');

// Add Topics menu after Datasets
if (!c.includes('/manager/topics')) {
  // Find the Datasets push block and add Topics after
  const oldText = `{
        text: 'Datasets',
        icon: <img src={datasetsIcon} alt="Datasets" className="h-5 w-5" />,
        path: '/manager/datasets',
      }`;
  const newText = oldText + `
      });
      baseItems.push({
        text: 'Topics',
        icon: '🗂️',
        path: '/manager/topics',
      });`;
  c = c.replace(oldText, newText);
}

fs.writeFileSync(p, c);
console.log('done: ' + c.length);
