const fs = require('fs');
let c = fs.readFileSync('Datasets.jsx', 'utf8');
const p = '\n      </Dialog>\nexport default Datasets;';
const r = '\n      </Dialog>\n\n      {/* Toast notification */}\n      <Snackbar\n        open={toast.open}\n        autoHideDuration={4000}\n        onClose={() => setToast({ ...toast, open: false })}\n        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}\n      >\n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === "error" ? "#7f1d1d" : "#14532d", color: "#fff" }}>\n          {toast.message}\n        </Alert>\n      </Snackbar>\n    </Box>\n  );\n};\n\nexport default Datasets;';
if (c.includes(p)) {
  c = c.replace(p, r);
  console.log('OK - replaced');
} else {
  console.log('NOT FOUND');
}
fs.writeFileSync('Datasets.jsx', c);