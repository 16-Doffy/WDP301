// patch_ds_v3.js - Fix Datasets.jsx
var fs = require('fs');
var fp = 'd:/Desktop/WDP/WDP301/frontend/src/pages/Manager/Datasets.jsx';
var c = fs.readFileSync(fp, 'utf8');
var n = 0;
var P = function(w, f, t) {
  if (c.indexOf(f) === -1) { console.log('  [SKIP] ' + w); return; }
  c = c.replace(f, t); n++;
  console.log('  [OK] ' + w);
};
P('useLocation', "import { useNavigate } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';");
P('Snackbar', 'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip,\n} from', 'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, Snackbar,\n} from');
P('location', 'const Datasets = () => {\n  const navigate = useNavigate();\n  const { user } = useAuth();', "const Datasets = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const { user } = useAuth();");
P('toast', 'const [statusByDs, setStatusByDs] = useState({});', "const [statusByDs, setStatusByDs] = useState({});\n  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });\n  const highlightedDsId = location.state && location.state.highlightDsId || null;");
P('scroll', 'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\n  const fetchTopics', 'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\n  useEffect(function() {\n    if (highlightedDsId && datasets.length > 0 && !loading) {\n      setTimeout(function() {\n        var el = document.getElementById("dataset-card-" + highlightedDsId);\n        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });\n        setToast({ open: true, message: "Dataset \"" + (location.state && location.state.highlightDsName || "") + "\" da duoc tao thanh cong!", severity: "success" });\n      }, 400);\n    }\n  }, [datasets, highlightedDsId, loading]);\n\n  const fetchTopics');
P('card', '                    <Card sx={cardSx}>\n                      <CardContent>', "                    <Card sx={{ ...cardSx, border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }} id={'dataset-card-' + ds._id}>\n                      <CardContent>");
P('nav', "        navigate('/manager/projects/create', {\n          state: { refreshDatasets: true, datasetName: created.name, datasetType: created.type, preselectedDatasetIds: [created._id] },\n        });", "        navigate('/manager/topics', {\n          state: {\n            highlightDsId: created._id,\n            highlightDsName: created.name,\n            selectedTopicId: selectedTopicId,\n            selectedSubtopicId: selectedSubtopicId,\n            autoTab: 'datasets',\n          },\n        });");
P('snack', '    </Box>\n  );\n};\n\nexport default Datasets;', "    </Box>\n\n      {/* Toast notification */}\n      <Snackbar\n        open={toast.open}\n        autoHideDuration={4000}\n        onClose={function() { setToast({ open: false, message: '', severity: 'success' }); }}\n        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}\n      >\n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === 'error' ? '#7f1d1d' : '#14532d', color: '#fff' }}>\n          {toast.message}\n        </Alert>\n      </Snackbar>\n    </Box>\n  );\n};\n\nexport default Datasets;");
fs.writeFileSync(fp, c);
console.log('\n' + n + '/6 applied -> saved.');
