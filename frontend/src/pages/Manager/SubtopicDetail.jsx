// SubtopicDetail.jsx - Right panel: Labels | Datasets | Assets tabs
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, Card, Grid, IconButton, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Alert, CircularProgress, InputAdornment, LinearProgress, Snackbar } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CloudUpload as CloudUploadIcon, Image as ImageIcon, Search as SearchIcon, Folder as FolderIcon, ListAlt as ListIcon, Upload as UploadIcon, FolderZip as ZipIcon, Article as ArticleIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');
const getFullImageUrl = (path) => {
  if (!path) return '';
  const base = API_URL.replace(/\/+$/, '');
  const clean = (path || '').replace(/^\/+/, '');
  return base + '/' + clean;
};

const panelSx = { borderRadius: 3, boxShadow: '0 16px 32px rgba(0,0,0,0.35)', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' };
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: '10px',
    '& fieldset': { borderColor: '#475569' },
    '&:hover fieldset': { borderColor: '#64748b' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
  },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
  '& .MuiSvgIcon-root': { color: '#94a3b8' }
};
const btnPrimary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', color: 'white', '&:hover': { bgcolor: '#3b82f6' } };
const btnOutline = { borderRadius: 2, textTransform: 'none', fontWeight: 700, border: '1px solid #3b82f6', color: '#3b82f6', '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' } };
const modalSx = { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' };
const cardSx = { borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', transition: 'all 0.2s', '&:hover': { borderColor: '#3b82f6' } };

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const SubtopicDetail = ({ selectedSubtopic, onSubtopicUpdate, topics, autoHighlightDs }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [labelSets, setLabelSets] = useState([]);
  const [labelSetsLoading, setLabelSetsLoading] = useState(false);
  const [labelDialog, setLabelDialog] = useState({ open: false, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } });
  const [labelInput, setLabelInput] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [highlightedDsId, setHighlightedDsId] = useState(null);

  useEffect(() => {
    if (selectedSubtopic) {
      loadLabelSets();
      loadDatasets();
      loadAssets();
    }
  }, [selectedSubtopic?._id]);

  // Handle auto-highlight from TopicManagement
  useEffect(() => {
    if (!autoHighlightDs) return;
    if (autoHighlightDs.tab === 'datasets') {
      setActiveTab(1); // Switch to Datasets tab
      setTimeout(() => setHighlightedDsId(autoHighlightDs.id), 300);
    }
  }, [autoHighlightDs]);

  const loadLabelSets = async () => {
    setLabelSetsLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/labelsets?subtopicId=' + selectedSubtopic._id, {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      setLabelSets(Array.isArray(res.data) ? res.data : []);
    } catch { setLabelSets([]); }
    setLabelSetsLoading(false);
  };

  const loadDatasets = async () => {
    setDatasetsLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/datasets?subtopicId=' + selectedSubtopic._id, {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      setDatasets(Array.isArray(res.data) ? res.data : []);
    } catch { setDatasets([]); }
    setDatasetsLoading(false);
  };

  const loadAssets = async () => {
    setAssetsLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets', {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch { setAssets([]); }
    setAssetsLoading(false);
  };

  const saveLabelSet = async () => {
    try {
      if (labelDialog.edit) {
        await axios.put(API_URL + '/api/labelsets/' + labelDialog.data._id, labelDialog.data, {
          headers: { Authorization: 'Bearer ' + getAuthToken() }
        });
      } else {
        await axios.post(API_URL + '/api/labelsets', { ...labelDialog.data, subtopicId: selectedSubtopic._id }, {
          headers: { Authorization: 'Bearer ' + getAuthToken() }
        });
      }
      setLabelDialog({ open: false, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } });
      loadLabelSets();
      setSnackbar({ open: true, message: 'Luu labelset thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + e.message, severity: 'error' });
    }
  };

  const addLabel = () => {
    if (!labelInput.trim()) return;
    setLabelDialog({
      ...labelDialog,
      data: {
        ...labelDialog.data,
        labels: [...labelDialog.data.labels, { name: labelInput.trim(), color: labelColor, description: '', shortcut: '' }]
      }
    });
    setLabelInput('');
  };

  const handleDeleteLabelSet = async (id) => {
    if (!confirm('Xoa labelset?')) return;
    try {
      await axios.delete(API_URL + '/api/labelsets/' + id, {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      loadLabelSets();
    } catch (e) { alert('Loi: ' + e.message); }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setUploadFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) setUploadFiles(prev => [...prev, ...files]);
  };

  const handleUploadAssets = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      uploadFiles.forEach(f => fd.append('files', f));
      await axios.post(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets', fd, {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      setUploadFiles([]);
      loadAssets();
      setSnackbar({ open: true, message: 'Upload thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi upload: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
    setUploading(false);
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Xoa asset nay?')) return;
    try {
      await axios.delete(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets/' + assetId, {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      loadAssets();
      setSnackbar({ open: true, message: 'Xoa asset thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi xoa: ' + e.message, severity: 'error' });
    }
  };

  const imageCount = assets.filter(a => a.type === 'image').length;
  const textCount = assets.filter(a => a.type === 'text').length;
  const lastUpload = assets.length > 0 ? assets.reduce((latest, a) => new Date(a.uploadedAt) > new Date(latest.uploadedAt) ? a : latest).uploadedAt : null;
  const timeSinceUpload = lastUpload
    ? ((Date.now() - new Date(lastUpload)) / 1000 / 60 < 60
      ? Math.round((Date.now() - new Date(lastUpload)) / 1000 / 60) + ' phut truoc'
      : Math.round((Date.now() - new Date(lastUpload)) / 1000 / 60 / 60) + ' gio truoc')
    : 'Chua co';
  const filteredAssets = assets.filter(a => {
    if (!assetSearch.trim()) return true;
    const fn = (a.originalName || a.filename || '').toLowerCase();
    return fn.includes(assetSearch.toLowerCase());
  });
  const filteredDatasets = datasets.filter(d => {
    if (!datasetSearch.trim()) return true;
    return (d.name || '').toLowerCase().includes(datasetSearch.toLowerCase());
  });

  if (!selectedSubtopic) {
    return (
      <Box sx={{ ...panelSx, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <FolderIcon sx={{ fontSize: 64, color: '#334155' }} />
        <Typography variant="h6" sx={{ color: '#64748b' }}>Chon mot subtopic de xem chi tiet</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ...panelSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>
            Subtopic Detail: {selectedSubtopic.name}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search"
          fullWidth
          sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 36 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
        />
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        sx={{
          borderBottom: '1px solid #334155', px: 2,
          '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600, textTransform: 'none', minHeight: 44 },
          '& .Mui-selected': { color: '#3b82f6' },
          '& .MuiTabs-indicator': { bgcolor: '#3b82f6' }
        }}
      >
        <Tab label={'Labels (' + labelSets.length + ')'} />
        <Tab label={'Datasets (' + datasets.length + ')'} />
        <Tab label={'Assets (' + assets.length + ')'} />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

        {/* ===== LABELS TAB ===== */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0' }}>Labels</Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setLabelDialog({ open: true, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } })}
              sx={btnPrimary}
            >
              Define Labels
            </Button>
          </Box>
          {labelSetsLoading ? (
            <CircularProgress size={20} />
          ) : labelSets.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Chua co labelset nao. Click Define Labels de tao moi.</Alert>
          ) : (
            labelSets.map(ls => (
              <Card key={ls._id} sx={{ mb: 2, p: 2, bgcolor: '#0f172a', border: '1px solid #334155', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ListIcon sx={{ fontSize: 16, color: '#60a5fa' }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0' }}>{ls.name}</Typography>
                  </Box>
                  <Box>
                    <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setLabelDialog({ open: true, edit: true, data: ls })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => handleDeleteLabelSet(ls._id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {ls.labels && ls.labels.map((lbl, i) => (
                    <Chip
                      key={i}
                      label={lbl.name}
                      size="small"
                      sx={{
                        bgcolor: lbl.color + '20',
                        color: lbl.color,
                        border: '1px solid ' + lbl.color + '50',
                        fontWeight: 700,
                        fontSize: '0.7rem'
                      }}
                    />
                  ))}
                  {(!ls.labels || ls.labels.length === 0) && (
                    <Typography variant="caption" sx={{ color: '#64748b' }}>Chua co nhan</Typography>
                  )}
                </Box>
              </Card>
            ))
          )}
        </TabPanel>

        {/* ===== DATASETS TAB ===== */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0' }}>Datasets</Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search..."
            fullWidth
            value={datasetSearch}
            onChange={e => setDatasetSearch(e.target.value)}
            sx={{ mb: 2, ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 36 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
          {datasetsLoading ? (
            <CircularProgress size={20} />
          ) : filteredDatasets.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>Chua co dataset nao. Create dataset tu kho asset cua subtopic nay.</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {filteredDatasets.map(ds => (
                <Grid item xs={12} key={ds._id}>
                  <Card
                    onClick={() => navigate('/manager/datasets/' + ds._id)}
                    sx={{ ...cardSx, p: 1.5, cursor: 'pointer', border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <FolderIcon sx={{ color: '#60a5fa', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ds.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {ds.type || ds.datasetType || 'Classification'}
                        </Typography>
                      </Box>
                      <Chip
                        label={ds.status === 'active' ? 'Active' : ds.status || 'Active'}
                        size="small"
                        sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: 700, fontSize: '0.65rem' }}
                      />
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* ===== ASSETS TAB ===== */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0', mb: 0.5 }}>Assets</Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Total: <strong style={{ color: '#e2e8f0' }}>{assets.length} files</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>{imageCount} images</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>{textCount} texts</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Last: <strong style={{ color: '#60a5fa' }}>{timeSinceUpload}</strong>
              </Typography>
            </Box>
          </Box>

          {/* Upload Area */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#94a3b8' }}>Upload to Repository</Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => document.getElementById('subtopic-asset-upload').click()}
                sx={btnPrimary}
              >
                Upload Assets
              </Button>
            </Box>
            <input
              id="subtopic-asset-upload"
              type="file"
              multiple
              accept="image/*,.zip,.rar,.csv,.txt,.json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <Box
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('subtopic-asset-upload').click()}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? '#3b82f6' : '#334155',
                borderRadius: 2, p: 3, textAlign: 'center',
                bgcolor: dragOver ? 'rgba(59,130,246,0.05)' : 'transparent',
                transition: 'all 0.2s', cursor: 'pointer',
                '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59,130,246,0.05)' }
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 40, color: '#3b82f6', mb: 1 }} />
              <Typography variant="body2" fontWeight={600} sx={{ color: '#60a5fa', mb: 0.5 }}>
                Keo tha anh hoac chon file ZIP
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Anh / File ZIP se duoc tai len va to chuc tap trung trong kho cua subtopic
              </Typography>
            </Box>
          </Box>

          {/* Upload Preview */}
          {uploadFiles.length > 0 && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#0f172a', borderRadius: 2, border: '1px solid #334155' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#60a5fa' }}>
                  {uploadFiles.length} file cho upload
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleUploadAssets}
                  disabled={uploading}
                  sx={{ ...btnPrimary, height: 28, fontSize: '0.75rem' }}
                >
                  {uploading ? 'Dang upload...' : 'Confirm Upload'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 100, overflowY: 'auto' }}>
                {uploadFiles.map((f, i) => (
                  <Chip
                    key={i}
                    label={f.name}
                    size="small"
                    onDelete={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))}
                    sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
              {uploading && <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />}
            </Box>
          )}

          {/* Asset Filter */}
          <TextField
            size="small"
            placeholder="Filter..."
            fullWidth
            value={assetSearch}
            onChange={e => setAssetSearch(e.target.value)}
            sx={{ mb: 2, ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 36 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
          />

          {/* Asset Grid */}
          {assetsLoading ? (
            <CircularProgress />
          ) : filteredAssets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ImageIcon sx={{ fontSize: 48, color: '#334155', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {assetSearch ? 'Khong tim thay file' : 'Chua co asset nao'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={1}>
              {filteredAssets.map((asset, idx) => {
                const src = getFullImageUrl(asset.path);
                const fn = asset.originalName || asset.filename || 'Unknown';
                const isText = asset.type === 'text' || /\.(txt|csv|json|xml)$/i.test(fn);
                const isZip = /\.(zip|rar)$/i.test(fn);
                return (
                  <Grid item xs={4} sm={3} md={4} key={asset._id || asset.id || idx}>
                    <Box sx={{
                      position: 'relative', width: '100%', paddingTop: '100%',
                      overflow: 'hidden', borderRadius: 2, border: '1px solid #334155',
                      bgcolor: '#0f172a', transition: 'all 0.2s',
                      '&:hover': { borderColor: '#3b82f6', transform: 'scale(1.03)' }
                    }}>
                      {src && !isText && !isZip ? (
                        <Box component="img" src={src} alt={fn} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : isZip ? (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b' }}>
                          <ZipIcon sx={{ fontSize: 28, color: '#a78bfa' }} />
                          <Typography sx={{ color: '#94a3b8', fontSize: 8 }}>ZIP</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b' }}>
                          <ArticleIcon sx={{ fontSize: 28, color: '#60a5fa' }} />
                          <Typography sx={{ color: '#94a3b8', fontSize: 8 }}>Text</Typography>
                        </Box>
                      )}
                      <Box sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.2s', '&:hover': { opacity: 1 } }}>
                        <IconButton
                          size="small"
                          sx={{ bgcolor: 'rgba(220,38,38,0.8)', color: 'white', '&:hover': { bgcolor: '#dc2626' }, width: 24, height: 24 }}
                          onClick={() => handleDeleteAsset(asset._id || asset.id)}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.7)', px: 0.5, py: 0.25, opacity: 0, transition: 'opacity 0.2s', '&:hover': { opacity: 1 } }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {fn}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </TabPanel>
      </Box>

      {/* Label Dialog */}
      <Dialog
        open={labelDialog.open}
        onClose={() => setLabelDialog({ ...labelDialog, open: false })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: modalSx }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {labelDialog.edit ? 'Edit Labels' : 'Define Labels'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Ten LabelSet"
            value={labelDialog.data.name}
            onChange={e => setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, name: e.target.value } })}
            sx={{ mt: 2, mb: 2, ...inputSx }}
          />
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Nhan</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                placeholder="Ten nhan"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                sx={{ flex: 1, ...inputSx }}
                onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
              />
              <TextField
                size="small"
                type="color"
                value={labelColor}
                onChange={e => setLabelColor(e.target.value)}
                sx={{ width: 60 }}
              />
              <Button size="small" variant="outlined" onClick={addLabel} sx={btnOutline}>Them</Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {labelDialog.data.labels.map((lbl, i) => (
                <Chip
                  key={i}
                  label={lbl.name}
                  size="small"
                  onDelete={() => setLabelDialog({
                    ...labelDialog,
                    data: { ...labelDialog.data, labels: labelDialog.data.labels.filter((_, idx) => idx !== i) }
                  })}
                  sx={{
                    bgcolor: lbl.color + '20',
                    color: lbl.color,
                    border: '1px solid ' + lbl.color + '50',
                    fontWeight: 600
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setLabelDialog({ ...labelDialog, open: false })}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#334155', color: '#e2e8f0', border: '1px solid #475569' }}
          >
            Huy
          </Button>
          <Button variant="contained" onClick={saveLabelSet} sx={btnPrimary}>
            {labelDialog.edit ? 'Luu' : 'Tao'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} sx={{ bgcolor: snackbar.severity === 'error' ? '#7f1d1d' : '#14532d', color: '#fff' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SubtopicDetail;
