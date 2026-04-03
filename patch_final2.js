// patch_final2.js - Fix Datasets.jsx
const fs = require('fs');
const fp = 'd:/Desktop/WDP/WDP301/frontend/src/pages/Manager/Datasets.jsx';
let c = fs.readFileSync(fp, 'utf8');
let n = 0;
const P = (w, f, t) => {
  if (!c.includes(f)) { console.log('  [SKIP] ' + w); return; }
  c = c.replace(f, t); n++;
  console.log('  [OK] ' + w);
};

// 1. useLocation + Snackbar
P('useLocation',
  "import { useNavigate } from 'react-router-dom';",
  "import { useNavigate, useLocation } from 'react-router-dom';"
);
P('Snackbar',
  'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip,\n} from',
  'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, Snackbar,\n} from'
);

// 2. location + toast + highlightedDsId
P('location',
  'const Datasets = () => {\n  const navigate = useNavigate();\n  const { user } = useAuth();',
  "const Datasets = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const { user } = useAuth();"
);
P('toast+highlightedDsId',
  'const [statusByDs, setStatusByDs] = useState({});',
  "const [statusByDs, setStatusByDs] = useState({});\n  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });\n  const highlightedDsId = location.state?.highlightDsId || null;"
);

// 3. Auto-scroll effect
P('auto-scroll effect',
  'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\n  const fetchTopics',
  `useEffect(() => { fetchDatasets(); fetchTopics(); }, []);

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

  const fetchTopics`
);

// 4. Card highlight
P('card highlight',
  '                    <Card sx={cardSx}>\n                      <CardContent>',
  "                    <Card sx={{ ...cardSx, border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }} id={'dataset-card-' + ds._id}>\n                      <CardContent>"
);

// 5. navigate -> /manager/topics
P('navigate fix',
  "        navigate('/manager/projects/create', {\n          state: { refreshDatasets: true, datasetName: created.name, datasetType: created.type, preselectedDatasetIds: [created._id] },\n        });",
  "        navigate('/manager/topics', {\n          state: {\n            highlightDsId: created._id,\n            highlightDsName: created.name,\n            selectedTopicId: selectedTopicId,\n            selectedSubtopicId: selectedSubtopicId,\n            autoTab: 'datasets',\n          },\n        });"
);

// 6. Toast Snackbar
P('Toast Snackbar',
  '    </Box>\n  );\n};\n\nexport default Datasets;',
  `    </Box>

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

export default Datasets;`
);

fs.writeFileSync(fp, c);
console.log('\n' + n + '/6 applied -> saved.');
