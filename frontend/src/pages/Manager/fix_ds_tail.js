const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, 'Datasets.jsx');
let c = fs.readFileSync(f, 'utf8');
const marker = '</Dialog>';
const searchStr = '\n      ' + marker + '\nexport default Datasets;';
const replaceStr = '\n      ' + marker + '\n\n      {/* Toast notification */}\n      <Snackbar\n        open={toast.open}\n        autoHideDuration={4000}\n        onClose={() => setToast({ ...toast, open: false })}\n        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}\n      >\n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === "error" ? "#7f1d1d" : "#14532d", color: "#fff" }}>\n          {toast.message}\n        </Alert>\n      </Snackbar>\n    </Box>\n  );\n};\n\nexport default Datasets;';
if (c.includes(searchStr)) {
  const result = c.replace(searchStr, replaceStr);
  fs.writeFileSync(f, result);
  console.log('SUCCESS');
} else {
  console.log('Pattern not found. Checking lines near end...');
  const lines = c.split('\n');
  console.log('Total lines:', lines.length);
  console.log('Last 5 lines:');
  for (let i = lines.length - 5; i < lines.length; i++) {
    console.log((i + 1) + ': ' + lines[i]);
  }
}
