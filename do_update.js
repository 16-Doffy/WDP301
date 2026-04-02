const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, 'frontend/src/components/LayoutTailwind.jsx');
let c = fs.readFileSync(layoutPath, 'utf8');

if (!c.includes('AccountTreeIcon')) {
  const importLine = "import AccountTreeIcon from '@mui/icons-material/AccountTree';";
  const lastImportMatch = c.match(/import .+ from '@mui\/icons-material';/g);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    c = c.replace(lastImport, lastImport + '\n' + importLine);
  }
}

if (!c.includes('/manager/topics')) {
  const datasetsPattern = /menuItems\.push\(\{ text: "Datasets",\s*icon:\s*<StorageIcon\s*\/>,?\s*path:\s*"\/manager\/datasets"\s*\}\);/;
  if (datasetsPattern.test(c)) {
    c = c.replace(datasetsPattern, 'menuItems.push({ text: "Datasets", icon: <StorageIcon />, path: "/manager/datasets" });\n      menuItems.push({ text: "Topics", icon: <AccountTreeIcon />, path: "/manager/topics" });');
  }
}

fs.writeFileSync(layoutPath, c);
console.log('LayoutTailwind.jsx updated: ' + c.length + ' chars');
