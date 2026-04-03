// patch_final.js - Fix Datasets.jsx: redirect after create Dataset
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, 'frontend/src/pages/Manager/Datasets.jsx');
let c = fs.readFileSync(fp, 'utf8');
const orig = c;
let n = 0;

const patch = (what, from, to) => {
  if (!c.includes(from)) { console.log('  [SKIP] ' + what); return; }
  c = c.replace(from, to);
  console.log('  [OK] ' + what);
  n++;
};

// 1. useLocation + Snackbar imports
patch('useLocation import',
  "import { useNavigate } from 'react-router-dom';",
  "import { useNavigate, useLocation } from 'react-router-dom';"
);
patch('Snackbar import',
  'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip,\n} from',
  'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, Snackbar,\n} from'
);

// 2. location + toast + highlightedDsId state
patch('location state',
  'const Datasets = () => {\n  const navigate = useNavigate();\n  const { user } = useAuth();',
  "const Datasets = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const { user } = useAuth();"
);
patch('toast state',
  'const [statusByDs, setStatusByDs] = useState({});',
  "const [statusByDs, setStatusByDs] = useState({});\n  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });\n  const highlightedDsId = location.state?.highlightDsId || null;"
);

// 3. Auto-scroll + toast effect
const fetchEffectOld = 'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\nconst fetchTopics';
const fetchEffectNew = `useEffect(() => { fetchDatasets(); fetchTopics(); }, []);

  // Auto-scroll + toast when returning after creating a dataset
  useEffect(() => {
    if (highlightedDsId && datasets.length > 0 && !loading) {
      setTimeout(() => {
        const el = document.getElementById('dataset-card-' + highlightedDsId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setToast({ open: true, message: 'Dataset "' + (location.state?.highlightDsName || '') + '" da duoc tao thanh cong!', severity: 'success' });
      }, 400);
    }
  }, [datasets, highlightedDsId, loading]);

const fetchTopics`;
patch('auto-scroll effect', fetchEffectOld, fetchEffectNew);

// 4. Card highlight
const cardOld = '                    <Card sx={cardSx}>\n                      <CardContent>';
const cardNew = "                    <Card sx={{ ...cardSx, border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }} id={'dataset-card-' + ds._id}>\n                      <CardContent>";
patch('card highlight', cardOld, cardNew);

// 5. navigate -> /manager/topics (the critical fix)
const navOld = "navigate('/manager/projects/create', {\n          state: { refreshDatasets: true, datasetName: created.name, datasetType: created.type, preselectedDatasetIds: [created._id] },\n        });";
const navNew = "navigate('/manager/topics', {\n          state: {\n            highlightDsId: created._id,\n            highlightDsName: created.name,\n            selectedTopicId: selectedTopicId,\n            selectedSubtopicId: selectedSubtopicId,\n            autoTab: 'datasets',\n          },\n        });";
patch('navigate to /manager/topics', navOld, navNew);

// 6. Toast Snackbar before final export
const endOld = '    </Box>\n  );\n};\n\nexport default Datasets;';
const endNew = `    </Box>

      {/* Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === 'error' ? '#7f1d1d' : '#14532d', color: '#fff' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Datasets;`;
patch('Toast Snackbar', endOld, endNew);

if (n === 6) {
  fs.writeFileSync(fp, c);
  console.log('\nDONE: ' + n + '/6 patches applied. File saved.');
} else {
  console.log('\nWARNING: only ' + n + '/6 patches applied. NOT saving.');
}
