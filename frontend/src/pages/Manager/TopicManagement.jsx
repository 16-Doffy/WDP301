import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Button, Grid, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Chip, Tooltip, Snackbar, Alert, CircularProgress, InputAdornment } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Folder as FolderIcon, Search as SearchIcon, Image as ImageIcon, Label as LabelIcon, LocalOffer as TagIcon, Upload as UploadIcon, Description as TextFileIcon, AudioFile as AudioIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const panelSx = { borderRadius: 3, boxShadow: '0 16px 32px rgba(0,0,0,0.35)', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' };
const inputSx = { '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: '10px', '& fieldset': { borderColor: '#475569' }, '&:hover fieldset': { borderColor: '#64748b' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiSvgIcon-root': { color: '#94a3b8' } };
const btnPrimary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', color: 'white', '&:hover': { bgcolor: '#3b82f6' } };
const btnSecondary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#334155', color: '#e2e8f0', border: '1px solid #475569', '&:hover': { bgcolor: '#475569' } };
const modalSx = { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' };
const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const getImgUrl = (path) => {
  if (!path) return '';
  const base = API_URL.replace(/\/+$/, '');
  return base + '/' + path.replace(/^\/+/, '');
};

const getFileIcon = (filename) => {
  if (!filename) return <ImageIcon sx={{ color: '#64748b', fontSize: 32 }} />;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return <ImageIcon sx={{ color: '#f59e0b', fontSize: 32 }} />;
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return <AudioIcon sx={{ color: '#f472b6', fontSize: 32 }} />;
  if (['txt', 'csv', 'json', 'xml', 'pdf', 'doc', 'docx'].includes(ext)) return <TextFileIcon sx={{ color: '#34d399', fontSize: 32 }} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FolderIcon sx={{ color: '#a78bfa', fontSize: 32 }} />;
  return <TextFileIcon sx={{ color: '#64748b', fontSize: 32 }} />;
};

const AssetThumb = ({ asset, onDelete, onPreview }) => {
  const url = getImgUrl(asset.path);
  const filename = asset.originalName || asset.path || '';
  const ext = filename.split('.').pop()?.toLowerCase();
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);

  return (
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid #334155', '&:hover .del-btn': { opacity: 1 }, '&:hover': { borderColor: '#3b82f6', cursor: 'pointer' } }}>
      <Box onClick={() => isImg && onPreview && onPreview(asset)}>
        {isImg && url ? (
          <img src={url} alt={filename} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}>
            {getFileIcon(filename)}
          </Box>
        )}
      </Box>
      <Box className="del-btn" sx={{ position: 'absolute', top: 2, right: 2, opacity: 0, transition: 'opacity 0.2s' }}>
        <IconButton size="small" sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: '#f87171', '&:hover': { bgcolor: 'rgba(239,68,68,0.3)' } }} onClick={() => onDelete(asset._id)}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Box sx={{ p: 0.5, bgcolor: '#0f172a' }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.6rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </Typography>
      </Box>
    </Box>
  );
};

const SubtopicCard = ({ subtopic, selected, onSelect, onEdit, onDelete }) => (
  <Box onClick={onSelect} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, cursor: 'pointer', mb: 0.5, border: '1px solid', borderColor: selected ? '#3b82f6' : 'transparent', bgcolor: selected ? 'rgba(59,130,246,0.15)' : 'transparent', '&:hover': { bgcolor: selected ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.05)' } }}>
    <ImageIcon sx={{ color: '#60a5fa', fontSize: 20, flexShrink: 0 }} />
    <Box sx={{ flex: 1, overflow: 'hidden' }}>
      <Typography variant="body2" fontWeight={600} sx={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtopic.name}</Typography>
      <Typography variant="caption" sx={{ color: '#64748b' }}>{subtopic.assetsCount || 0} Assets</Typography>
    </Box>
    <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={e => { e.stopPropagation(); onEdit(subtopic); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
    <IconButton size="small" sx={{ color: '#f87171' }} onClick={e => { e.stopPropagation(); onDelete(subtopic._id); }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
  </Box>
);

const LabelChip = ({ label }) => (
  <Chip
    label={label.name}
    size="small"
    sx={{ bgcolor: label.color + '30', color: label.color, border: '1px solid ' + label.color, fontWeight: 600, mr: 0.5, mb: 0.5 }}
  />
);

const SubtopicPanel = ({ selectedSubtopic, onSubtopicUpdate }) => {
  const fileInputRef = useRef();
  const [labelSets, setLabelSets] = useState([]);
  const [labelSetsLoading, setLabelSetsLoading] = useState(false);
  const [labelDialog, setLabelDialog] = useState({ open: false, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } });
  const [labelInput, setLabelInput] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (selectedSubtopic) {
      setDataLoaded(false);
      loadLabelSets();
      loadAssets();
    }
  }, [selectedSubtopic?._id]);

  const loadLabelSets = async () => {
    setLabelSetsLoading(true);
    try {
      const r = await axios.get(API_URL + '/api/labelsets?subtopicId=' + selectedSubtopic._id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setLabelSets(Array.isArray(r.data) ? r.data : []);
    } catch { setLabelSets([]); }
    setLabelSetsLoading(false);
    setDataLoaded(true);
  };

  const loadAssets = async () => {
    setAssetsLoading(true);
    try {
      const r = await axios.get(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setAssets(Array.isArray(r.data) ? r.data : []);
    } catch { setAssets([]); }
    setAssetsLoading(false);
    setDataLoaded(true);
  };

  const saveLabelSet = async () => {
    try {
      if (labelDialog.edit)
        await axios.put(API_URL + '/api/labelsets/' + labelDialog.data._id, labelDialog.data, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      else
        await axios.post(API_URL + '/api/labelsets', { ...labelDialog.data, subtopicId: selectedSubtopic._id }, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setLabelDialog({ open: false, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } });
      loadLabelSets();
      setSnackbar({ open: true, message: 'Luu labelset thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const addLabel = () => {
    if (!labelInput.trim()) return;
    setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, labels: [...labelDialog.data.labels, { name: labelInput.trim(), color: labelColor, description: '', shortcut: '' }] } });
    setLabelInput('');
  };

  const removeLabel = (name) => setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, labels: labelDialog.data.labels.filter(l => l.name !== name) } });

  const handleDeleteLabelSet = async (id) => {
    if (!confirm('Xoa labelset?')) return;
    try {
      await axios.delete(API_URL + '/api/labelsets/' + id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      loadLabelSets();
      setSnackbar({ open: true, message: 'Xoa labelset thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
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
      await axios.post(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets', fd, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setUploadFiles([]);
      loadAssets();
      onSubtopicUpdate();
      setSnackbar({ open: true, message: 'Upload thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
    setUploading(false);
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Xoa asset?')) return;
    try {
      await axios.delete(API_URL + '/api/subtopics/' + selectedSubtopic._id + '/assets/' + assetId, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      loadAssets();
      onSubtopicUpdate();
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const filteredAssets = assetSearch ? assets.filter(a => (a.originalName || '').toLowerCase().includes(assetSearch.toLowerCase())) : assets;
  const totalLabels = labelSets.reduce((acc, ls) => acc + (ls.labels?.length || 0), 0);
  const totalAssets = assets.length;

  if (!selectedSubtopic) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
      <Box sx={{ textAlign: 'center' }}>
        <FolderIcon sx={{ fontSize: 64, color: '#334155', mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#475569' }}>Chon 1 subtopic de xem chi tiet</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #334155' }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>Subtopic: {selectedSubtopic.name}</Typography>
        {selectedSubtopic.guideline && (
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>{selectedSubtopic.guideline}</Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box sx={{ display: dataLoaded ? 'flex' : 'none', gap: 2, mb: 3 }}>
          {[
            { icon: <ImageIcon />, label: 'Assets', value: totalAssets, color: '#3b82f6' },
            { icon: <TagIcon />, label: 'Labels', value: totalLabels, color: '#22c55e' },
          ].map(s => (
            <Box key={s.label} sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ color: s.color }}>{s.icon}</Box>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#e2e8f0', lineHeight: 1 }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{s.label}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ ...panelSx, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0' }}>Asset Gallery</Typography>
                <Button size="small" variant="contained" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()} sx={{ ...btnPrimary, py: 0.5, px: 1.5, fontSize: '0.75rem' }}>Upload</Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*,.zip,.rar,.7z,.tar,.gz,.csv,.json,.xml,.txt,.pdf,.doc,.docx"
                />
              </Box>

              {uploadFiles.length > 0 && (
                <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px dashed #3b82f6' }}>
                  <Typography variant="caption" sx={{ color: '#60a5fa', mb: 1, display: 'block' }}>{uploadFiles.length} files cho upload</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {uploadFiles.map((f, i) => (
                      <Chip key={i} label={f.name} size="small" onDelete={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))} sx={{ bgcolor: '#334155', color: '#e2e8f0' }} />
                    ))}
                  </Box>
                  <Button size="small" variant="contained" onClick={handleUploadAssets} disabled={uploading} sx={btnPrimary}>
                    {uploading ? 'Dang upload...' : 'Upload'}
                  </Button>
                </Box>
              )}

              <TextField size="small" placeholder="Filter..." value={assetSearch} onChange={e => setAssetSearch(e.target.value)} fullWidth sx={{ ...inputSx, mb: 2 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} />

              {assetsLoading ? (
                <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 4 }} />
              ) : filteredAssets.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, border: '2px dashed #334155', borderRadius: 2, cursor: 'pointer', bgcolor: dragOver ? 'rgba(59,130,246,0.1)' : 'transparent', borderColor: dragOver ? '#3b82f6' : '#334155' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <UploadIcon sx={{ fontSize: 40, color: '#475569', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#64748b' }}>Drop files here or click Upload</Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 1 }}>Ho tro: hinh anh, audio, text, zip, rar, pdf...</Typography>
                </Box>
              ) : (
                <Grid container spacing={1}>
                  {filteredAssets.map(a => (
                    <Grid item xs={4} sm={3} key={a._id}>
                      <AssetThumb asset={a} onDelete={handleDeleteAsset} onPreview={setPreviewAsset} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper sx={{ ...panelSx, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0' }}>Label Management</Typography>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setLabelDialog({ open: true, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } })} sx={{ ...btnPrimary, py: 0.5, px: 1.5, fontSize: '0.75rem' }}>Define</Button>
              </Box>
              {labelSetsLoading ? (
                <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 4 }} />
              ) : labelSets.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <TagIcon sx={{ fontSize: 40, color: '#334155', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#64748b' }}>Chua co labelset nao</Typography>
                </Box>
              ) : labelSets.map(ls => (
                <Box key={ls._id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#60a5fa', textTransform: 'uppercase' }}>{ls.name} ({ls.labels?.length || 0})</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setLabelDialog({ open: true, edit: true, data: ls })}><EditIcon sx={{ fontSize: 14 }} /></IconButton>
                      <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => handleDeleteLabelSet(ls._id)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                    {(ls.labels || []).map(l => <LabelChip key={l.name} label={l} />)}
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={labelDialog.open} onClose={() => setLabelDialog({ ...labelDialog, open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{labelDialog.edit ? 'Sua Labelset' : 'Tao Labelset'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Labelset" value={labelDialog.data.name} onChange={e => setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Labels</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}>
              {(labelDialog.data.labels || []).map(l => (
                <Chip key={l.name} label={l.name} size="small" sx={{ bgcolor: l.color + '30', color: l.color, border: '1px solid ' + l.color, mr: 0.5, mb: 0.5 }} onDelete={() => removeLabel(l.name)} deleteIcon={<DeleteIcon sx={{ fontSize: 14 }} />} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" placeholder="Label name" value={labelInput} onChange={e => setLabelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLabel()} sx={{ flex: 1, ...inputSx }} />
              <TextField type="color" value={labelColor} onChange={e => setLabelColor(e.target.value)} sx={{ width: 50, '& input': { p: 0.5, height: 40 } }} />
              <Button onClick={addLabel} variant="outlined" sx={{ border: '1px solid #3b82f6', color: '#3b82f6', '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' }, borderRadius: 2, py: 0.5 }}>Add</Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLabelDialog({ ...labelDialog, open: false })} sx={btnSecondary}>Huy</Button>
          <Button variant="contained" onClick={saveLabelSet} sx={btnPrimary}>{labelDialog.edit ? 'Luu' : 'Tao'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ bgcolor: '#1e293b', color: '#e2e8f0' }}>{snackbar.message}</Alert>
      </Snackbar>

      <Dialog open={!!previewAsset} onClose={() => setPreviewAsset(null)} maxWidth="lg" PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', border: 'none', borderRadius: 2, maxWidth: '90vw' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {previewAsset && (
            <img
              src={getImgUrl(previewAsset.path)}
              alt={previewAsset.originalName || 'preview'}
              style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 8, border: '2px solid #334155', objectFit: 'contain', cursor: 'pointer' }}
              onClick={() => setPreviewAsset(null)}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
};

const TopicManagement = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicDialog, setTopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', color: '#3b82f6' } });
  const [subtopicDialog, setSubtopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadTopics(); }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const r = await axios.get(API_URL + '/api/topics', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setTopics(Array.isArray(r.data) ? r.data : []);
    } catch { setTopics([]); }
    setLoading(false);
  };

  const loadSubtopicsForTopic = async (topic) => {
    try {
      const r = await axios.get(API_URL + '/api/subtopics?topicId=' + topic._id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      return Array.isArray(r.data) ? r.data : [];
    } catch { return []; }
  };

  const saveTopic = async () => {
    try {
      if (topicDialog.edit)
        await axios.put(API_URL + '/api/topics/' + selectedTopic._id, topicDialog.data, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      else
        await axios.post(API_URL + '/api/topics', topicDialog.data, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setTopicDialog({ ...topicDialog, open: false });
      loadTopics();
      setSnackbar({ open: true, message: topicDialog.edit ? 'Cap nhat topic thanh cong!' : 'Tao topic thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const handleDeleteTopic = async (id) => {
    if (!confirm('Xoa topic nay?')) return;
    try {
      await axios.delete(API_URL + '/api/topics/' + id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      if (selectedTopic?._id === id) {
        setSelectedTopic(null);
        setSelectedSubtopic(null);
      }
      loadTopics();
      setSnackbar({ open: true, message: 'Xoa topic thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const saveSubtopic = async () => {
    if (!selectedTopic) return;
    try {
      if (subtopicDialog.edit)
        await axios.put(API_URL + '/api/subtopics/' + selectedSubtopic._id, subtopicDialog.data, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      else
        await axios.post(API_URL + '/api/subtopics', { ...subtopicDialog.data, topicId: selectedTopic._id }, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setSubtopicDialog({ ...subtopicDialog, open: false });
      const subs = await loadSubtopicsForTopic(selectedTopic);
      setExpandedTopic({ ...selectedTopic, subtopics: subs });
      setSelectedSubtopic(null);
      loadTopics();
      setSnackbar({ open: true, message: subtopicDialog.edit ? 'Cap nhat subtopic thanh cong!' : 'Tao subtopic thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const handleDeleteSubtopic = async (id) => {
    if (!confirm('Xoa subtopic nay?')) return;
    try {
      await axios.delete(API_URL + '/api/subtopics/' + id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      if (selectedSubtopic?._id === id) setSelectedSubtopic(null);
      if (expandedTopic) {
        const subs = await loadSubtopicsForTopic(expandedTopic);
        setExpandedTopic({ ...expandedTopic, subtopics: subs });
      }
      loadTopics();
      setSnackbar({ open: true, message: 'Xoa subtopic thanh cong!', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Loi: ' + (e.response?.data?.message || e.message), severity: 'error' });
    }
  };

  const handleTopicClick = async (topic) => {
    if (selectedTopic?._id === topic._id) {
      setSelectedTopic(null);
      setSelectedSubtopic(null);
      setExpandedTopic(null);
      return;
    }
    setSelectedTopic(topic);
    setSelectedSubtopic(null);
    const subs = await loadSubtopicsForTopic(topic);
    setExpandedTopic({ ...topic, subtopics: subs });
  };

  const filteredTopics = topics.filter(t => !topicSearch.trim() || t.name.toLowerCase().includes(topicSearch.toLowerCase()));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, bgcolor: '#0f172a' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', bgcolor: '#0f172a' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>Topic Management</Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>Quan ly chu de lon, chu de nho, upload assets va tao nhan</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTopicDialog({ open: true, edit: false, data: { name: '', description: '', color: '#3b82f6' } })} sx={btnPrimary}>+ Tao Topic</Button>
      </Box>

      <Grid container spacing={3} sx={{ minHeight: 'calc(100vh - 220px)' }}>
        <Grid item xs={12} md={selectedSubtopic ? 4 : 3}>
          <Paper sx={{ ...panelSx, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #334155', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>Topics ({topics.length})</Typography>
                <Tooltip title="Tao Topic moi">
                  <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setTopicDialog({ open: true, edit: false, data: { name: '', description: '', color: '#3b82f6' } })}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField size="small" placeholder="Search topics..." value={topicSearch} onChange={e => setTopicSearch(e.target.value)} fullWidth sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 36 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} />
            </Box>
            <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
              {filteredTopics.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Chua co topic nao</Alert>
              ) : filteredTopics.map(t => (
                <Box key={t._id} sx={{ mb: 1 }}>
                  <Box onClick={() => handleTopicClick(t)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: selectedTopic?._id === t._id ? 'rgba(59,130,246,0.15)' : 'transparent', border: '1px solid', borderColor: selectedTopic?._id === t._id ? '#3b82f6' : '#334155', '&:hover': { borderColor: '#3b82f6', bgcolor: selectedTopic?._id === t._id ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.05)' } }}>
                    <FolderIcon sx={{ color: t.color || '#3b82f6', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{t.description || 'Khong co mo ta'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={e => { e.stopPropagation(); setTopicDialog({ open: true, edit: true, data: t }); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" sx={{ color: '#f87171' }} onClick={e => { e.stopPropagation(); handleDeleteTopic(t._id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {selectedTopic?._id === t._id && expandedTopic && (
                    <Box sx={{ pl: 3, mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#60a5fa', textTransform: 'uppercase', fontSize: '0.65rem' }}>Subtopics ({expandedTopic.subtopics?.length || 0})</Typography>
                        <Tooltip title="Add Subtopic">
                          <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setSubtopicDialog({ open: true, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } })}>
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      {(!expandedTopic.subtopics || expandedTopic.subtopics.length === 0) ? (
                        <Typography variant="caption" sx={{ color: '#64748b', pl: 1 }}>Chua co subtopic</Typography>
                      ) : expandedTopic.subtopics.map(s => (
                        <SubtopicCard key={s._id} subtopic={s} selected={selectedSubtopic?._id === s._id} onSelect={() => setSelectedSubtopic(prev => prev?._id === s._id ? null : s)} onEdit={() => setSubtopicDialog({ open: true, edit: true, data: s })} onDelete={handleDeleteSubtopic} />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={selectedSubtopic ? 8 : 9}>
          <Paper sx={{ ...panelSx, height: '100%' }}>
            <SubtopicPanel selectedSubtopic={selectedSubtopic} onSubtopicUpdate={loadTopics} />
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={topicDialog.open} onClose={() => setTopicDialog({ ...topicDialog, open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{topicDialog.edit ? 'Sua Topic' : 'Tao Topic'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Topic" value={topicDialog.data.name} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <TextField fullWidth label="Mo ta" value={topicDialog.data.description} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, description: e.target.value } })} multiline rows={2} sx={{ mb: 2, ...inputSx }} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Mau sac</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField type="color" value={topicDialog.data.color} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: e.target.value } })} sx={{ width: 60, '& input': { p: 0.5, height: 36 } }} />
              {COLORS.map(c => (
                <Box key={c} onClick={() => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: c } })} sx={{ width: 28, height: 28, bgcolor: c, borderRadius: 1, cursor: 'pointer', border: topicDialog.data.color === c ? '2px solid white' : '2px solid transparent' }} />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTopicDialog({ ...topicDialog, open: false })} sx={btnSecondary}>Huy</Button>
          <Button variant="contained" onClick={saveTopic} sx={btnPrimary}>{topicDialog.edit ? 'Luu' : 'Tao'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={subtopicDialog.open} onClose={() => setSubtopicDialog({ ...subtopicDialog, open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{subtopicDialog.edit ? 'Sua Subtopic' : 'Tao Subtopic'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Subtopic" value={subtopicDialog.data.name} onChange={e => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <TextField fullWidth label="Mo ta" value={subtopicDialog.data.description} onChange={e => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, description: e.target.value } })} multiline rows={2} sx={{ mb: 2, ...inputSx }} />
          <TextField fullWidth label="Guideline" value={subtopicDialog.data.guideline} onChange={e => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, guideline: e.target.value } })} multiline rows={2} sx={{ mb: 2, ...inputSx }} />
          <FormControl fullWidth sx={{ mb: 2, ...inputSx }}>
            <InputLabel>Loai Task</InputLabel>
            <Select value={subtopicDialog.data.taskType} label="Loai Task" onChange={e => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, taskType: e.target.value } })}>
              <MenuItem value="classification">Classification</MenuItem>
              <MenuItem value="bbox">Bounding Box</MenuItem>
              <MenuItem value="ner">NER</MenuItem>
              <MenuItem value="sentiment">Sentiment</MenuItem>
              <MenuItem value="multi_label">Multi-label</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSubtopicDialog({ ...subtopicDialog, open: false })} sx={btnSecondary}>Huy</Button>
          <Button variant="contained" onClick={saveSubtopic} sx={btnPrimary}>{subtopicDialog.edit ? 'Luu' : 'Tao'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ bgcolor: '#1e293b', color: '#e2e8f0' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default TopicManagement;
