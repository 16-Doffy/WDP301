const fs = require('fs');
const f = 'd:/Desktop/WDP/WDP301/frontend/src/pages/Manager/Datasets.jsx';
const c = fs.readFileSync(f, 'utf8');
const s = '\r\n      </Dialog>\r\nexport default Datasets;';
const r = '\r\n      </Dialog>\r\n\r\n      {/* Toast notification */}\r\n      <Snackbar\r\n        open={toast.open}\r\n        autoHideDuration={4000}\r\n        onClose={() => setToast({ ...toast, open: false })}\r\n        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}\r\n      >\r\n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === "error" ? "#7f1d1d" : "#14532d", color: "#fff" }}>\r\n          {toast.message}\r\n        </Alert>\r\n      </Snackbar>\r\n    </Box>\r\n  );\r\n};\r\n\r\nexport default Datasets;';
if (c.includes(s)) {
  fs.writeFileSync(f, c.replace(s, r));
  console.log('SUCCESS');
} else {
  console.log('NOT FOUND');
}