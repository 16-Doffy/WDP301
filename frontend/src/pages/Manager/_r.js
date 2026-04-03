const fs = require('fs');
const f = 'd:/Desktop/WDP/WDP301/frontend/src/pages/Manager/Datasets.jsx';
let c = fs.readFileSync(f, 'utf8');
const s = '\n      </Dialog>\nexport default Datasets;';
const r = '\n      </Dialog>\n\n      {/* Toast notification */}\n      <Snackbar\n        open={toast.open}\n        autoHideDuration={4000}\n        onClose={() => setToast({ ...toast, open: false })}\n        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}\n      >\n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === "error" ? "#7f1d1d" : "#14532d", color: "#fff" }}>\n          {toast.message}\n        </Alert>\n      </Snackbar>\n    </Box>\n  );\n};\n\nexport default Datasets;';
if (c.includes(s)) {
  c = c.replace(s, r);
  fs.writeFileSync(f, c);
  console.log('SUCCESS');
} else {
  const idx = c.indexOf('export default Datasets;');
  if (idx > 0) {
    const before = c.substring(idx - 80, idx);
    console.log('Before export: ' + JSON.stringify(before));
  }
}
