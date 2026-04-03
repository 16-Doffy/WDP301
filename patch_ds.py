#!/usr/bin/env python3
import sys
fp = r'd:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    c = f.read()
orig = c
n = 0

def p(what, frm, to):
    global c, n
    if frm not in c:
        print(f'  [SKIP] {what}')
        return
    c = c.replace(frm, to, 1)
    n += 1
    print(f'  [OK] {what}')

p('useLocation', "import { useNavigate } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';")
p('Snackbar', 'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip,\n} from', 'TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, Snackbar,\n} from')
p('location', 'const Datasets = () => {\n  const navigate = useNavigate();\n  const { user } = useAuth();', "const Datasets = () => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const { user } = useAuth();")
p('toast', 'const [statusByDs, setStatusByDs] = useState({});', "const [statusByDs, setStatusByDs] = useState({});\n  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });\n  const highlightedDsId = location.state?.highlightDsId || null;")
p('scroll', 'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\n  const fetchTopics', 'useEffect(() => { fetchDatasets(); fetchTopics(); }, []);\n\n  // Auto-scroll + toast when returning after creating a dataset\n  useEffect(() => {\n    if (highlightedDsId && datasets.length > 0 && !loading) {\n      setTimeout(() => {\n        const el = document.getElementById("dataset-card-" + highlightedDsId);\n        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });\n        setToast({ open: true, message: "Dataset \\"" + (location.state?.highlightDsName || "") + "\\" da duoc tao thanh cong!", severity: "success" });\n      }, 400);\n    }\n  }, [datasets, highlightedDsId, loading]);\n\n  const fetchTopics')
p('card', '                    <Card sx={cardSx}>\n                      <CardContent>', "                    <Card sx={{ ...cardSx, border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }} id={'dataset-card-' + ds._id}>\n                      <CardContent>")
p('nav', "        navigate('/manager/projects/create', {\n          state: { refreshDatasets: true, datasetName: created.name, datasetType: created.type, preselectedDatasetIds: [created._id] },\n        });", "        navigate('/manager/topics', {\n          state: {\n            highlightDsId: created._id,\n            highlightDsName: created.name,\n            selectedTopicId: selectedTopicId,\n            selectedSubtopicId: selectedSubtopicId,\n            autoTab: 'datasets',\n          },\n        });")
p('snack', '    </Box>\n  );\n};\n\nexport default Datasets;', '''    </Box>

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

export default Datasets;''')

if c != orig:
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'\n{n}/8 applied -> saved.')
else:
    print(f'\n{n}/8 applied -> no changes.')
