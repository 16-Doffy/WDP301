// TopicManagement.jsx - 2-panel: Topics list + Subtopic Detail (Labels | Datasets | Assets tabs)
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Grid, IconButton, List, ListItem,
  ListItemText, ListItemSecondaryAction, Alert, CircularProgress, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Chip, Tooltip, Snackbar
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Folder as FolderIcon, Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { getTopics, createTopic, updateTopic, deleteTopic, getSubtopics } from '../../services/TopicService';
import SubtopicDetail from './SubtopicDetail';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const panelSx = { borderRadius: 3, boxShadow: '0 16px 32px rgba(0,0,0,0.35)', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' };
const inputSx = { '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: '10px', '& fieldset': { borderColor: '#475569' }, '&:hover fieldset': { borderColor: '#64748b' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiSvgIcon-root': { color: '#94a3b8' } };
const btnPrimary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', color: 'white', '&:hover': { bgcolor: '#3b82f6' } };
const btnSecondary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#334155', color: '#e2e8f0', border: '1px solid #475569', '&:hover': { bgcolor: '#475569' } };
const modalSx = { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' };

const TopicManagement = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicDialog, setTopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', color: '#3b82f6' } });
  const [subtopicDialog, setSubtopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  useEffect(() => { loadTopics(); }, []);
  useEffect(() => {
    if (selectedTopic) loadSubtopics(selectedTopic._id);
    else { setSubtopics([]); setSelectedSubtopic(null); }
  }, [selectedTopic]);

  const loadTopics = async () => {
    setLoading(true);
    try { const r = await getTopics(); setTopics(Array.isArray(r) ? r : []); } catch { setTopics([]); }
    setLoading(false);
  };

  const loadSubtopics = async (id) => {
    try { const r = await getSubtopics(id); setSubtopics(Array.isArray(r) ? r : []); } catch { setSubtopics([]); }
  };

  const saveTopic = async () => {
    try {
      if (topicDialog.edit) await updateTopic(selectedTopic._id, topicDialog.data);
      else await createTopic(topicDialog.data);
      setTopicDialog({ ...topicDialog, open: false });
      loadTopics();
      setSnackbar({ open: true, message: topicDialog.edit ? 'Cap nhat topic thanh cong!' : 'Tao topic thanh cong!', severity: 'success' });
    } catch (e) { setSnackbar({ open: true, message: 'Loi: ' + e.message, severity: 'error' }); }
  };

  const handleDeleteTopic = async (id) => {
    if (!confirm('Xoa topic nay?')) return;
    try {
      await deleteTopic(id);
      if (selectedTopic?._id === id) { setSelectedTopic(null); setSelectedSubtopic(null); }
      loadTopics();
    } catch (e) { setSnackbar({ open: true, message: 'Loi: ' + e.message, severity: 'error' }); }
  };

  const saveSubtopic = async () => {
    if (!selectedTopic) return;
    try {
      if (subtopicDialog.edit) {
        await axios.put(API_URL + '/api/subtopics/' + selectedSubtopic._id, subtopicDialog.data, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      } else {
        await axios.post(API_URL + '/api/subtopics', { ...subtopicDialog.data, topicId: selectedTopic._id }, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      }
      setSubtopicDialog({ ...subtopicDialog, open: false });
      loadSubtopics(selectedTopic._id);
      setSnackbar({ open: true, message: subtopicDialog.edit ? 'Cap nhat subtopic thanh cong!' : 'Tao subtopic thanh cong!', severity: 'success' });
    } catch (e) { setSnackbar({ open: true, message: 'Loi: ' + e.message, severity: 'error' }); }
  };

  const handleDeleteSubtopic = async (id) => {
    if (!confirm('Xoa subtopic nay?')) return;
    try {
      await axios.delete(API_URL + '/api/subtopics/' + id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      if (selectedSubtopic?._id === id) setSelectedSubtopic(null);
      loadSubtopics(selectedTopic._id);
    } catch (e) { setSnackbar({ open: true, message: 'Loi: ' + e.message, severity: 'error' }); }
  };



  const filteredTopics = topics.filter(t => !topicSearch.trim() || t.name.toLowerCase().includes(topicSearch.toLowerCase()));

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, bgcolor: '#0f172a' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', bgcolor: '#0f172a' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>Chu de</Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>Quan ly chu de lon va chu de nho</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTopicDialog({ open: true, edit: false, data: { name: '', description: '', color: '#3b82f6' } })} sx={btnPrimary}>Tao Topic</Button>
      </Box>

      <Grid container spacing={3} sx={{ height: 'calc(100vh - 220px)' }}>
        {/* LEFT: Topics + Subtopics */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ ...panelSx, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #334155', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>Topics ({topics.length})</Typography>
                <Tooltip title="Tao Topic moi"><IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setTopicDialog({ open: true, edit: false, data: { name: '', description: '', color: '#3b82f6' } })}><AddIcon fontSize="small" /></IconButton></Tooltip>
              </Box>
              <TextField size="small" placeholder="Search topics..." value={topicSearch} onChange={e => setTopicSearch(e.target.value)} fullWidth sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 36 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} />
            </Box>
            <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
              {filteredTopics.length === 0 ? <Alert severity="info" sx={{ borderRadius: 2 }}>Chua co topic nao</Alert> : filteredTopics.map(t => (
                <Box key={t._id} sx={{ mb: 1 }}>
                  <Box onClick={() => setSelectedTopic(prev => prev?._id === t._id ? null : t)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: selectedTopic?._id === t._id ? 'rgba(59,130,246,0.15)' : 'transparent', border: '1px solid', borderColor: selectedTopic?._id === t._id ? '#3b82f6' : '#334155', '&:hover': { borderColor: '#3b82f6', bgcolor: selectedTopic?._id === t._id ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.05)' } }}>
                    <FolderIcon sx={{ color: t.color || '#3b82f6', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{t.description || 'Khong co mo ta'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={e => { e.stopPropagation(); setTopicDialog({ open: true, edit: true, data: t }); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" sx={{ color: '#f87171' }} onClick={e => { e.stopPropagation(); handleDeleteTopic(t._id); }}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
                  </Box>
                  {selectedTopic?._id === t._id && (
                    <Box sx={{ pl: 3, mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#60a5fa', textTransform: 'uppercase', fontSize: '0.65rem' }}>Subtopics ({subtopics.length})</Typography>
                        <Tooltip title="Add Subtopic"><IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => setSubtopicDialog({ open: true, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } })}><AddIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                      {subtopics.length === 0 ? <Typography variant="caption" sx={{ color: '#64748b', pl: 1 }}>Chua co subtopic</Typography> : subtopics.map(s => (
                        <Box key={s._id} onClick={() => setSelectedSubtopic(prev => prev?._id === s._id ? null : s)} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer', mb: 0.5, bgcolor: selectedSubtopic?._id === s._id ? 'rgba(59,130,246,0.2)' : 'transparent', border: '1px solid', borderColor: selectedSubtopic?._id === s._id ? '#3b82f6' : 'transparent', '&:hover': { bgcolor: selectedSubtopic?._id === s._id ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)' } }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: selectedSubtopic?._id === s._id ? '#3b82f6' : '#64748b', flexShrink: 0 }} />
                          <Typography variant="caption" fontWeight={600} sx={{ color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</Typography>
                          <IconButton size="small" sx={{ color: '#60a5fa', width: 20, height: 20 }} onClick={e => { e.stopPropagation(); setSubtopicDialog({ open: true, edit: true, data: s }); }}><EditIcon sx={{ fontSize: 12 }} /></IconButton>
                          <IconButton size="small" sx={{ color: '#f87171', width: 20, height: 20 }} onClick={e => { e.stopPropagation(); handleDeleteSubtopic(s._id); }}><DeleteIcon sx={{ fontSize: 12 }} /></IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
                  ))}
                </Box>
          </Paper>
        </Grid>

        {/* RIGHT: Subtopic Detail */}
        <Grid item xs={12} md={9}>
          <SubtopicDetail selectedSubtopic={selectedSubtopic} onSubtopicUpdate={() => loadSubtopics(selectedTopic?._id)} topics={topics} />
        </Grid>
      </Grid>

      {/* Topic Dialog */}
      <Dialog open={topicDialog.open} onClose={() => setTopicDialog({ ...topicDialog, open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{topicDialog.edit ? 'Sua Topic' : 'Tao Topic'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Topic" value={topicDialog.data.name} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <TextField fullWidth label="Mo ta" value={topicDialog.data.description} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, description: e.target.value } })} multiline rows={2} sx={{ mb: 2, ...inputSx }} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>Mau sac</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField type="color" value={topicDialog.data.color} onChange={e => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: e.target.value } })} sx={{ width: 60, '& input': { p: 0.5, height: 36 } }} />
              {COLORS.map(c => <Box key={c} onClick={() => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: c } })} sx={{ width: 28, height: 28, bgcolor: c, borderRadius: 1, cursor: 'pointer', border: topicDialog.data.color === c ? '2px solid white' : '2px solid transparent' }} />)}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTopicDialog({ ...topicDialog, open: false })} sx={btnSecondary}>Huy</Button>
          <Button variant="contained" onClick={saveTopic} sx={btnPrimary}>{topicDialog.edit ? 'Luu' : 'Tao'}</Button>
        </DialogActions>
      </Dialog>

      {/* Subtopic Dialog */}
      <Dialog open={subtopicDialog.open} onClose={() => setSubtopicDialog({ ...subtopicDialog, open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{subtopicDialog.edit ? 'Sua Subtopic' : 'Add Subtopic'}</DialogTitle>
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

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} sx={{ bgcolor: snackbar.severity === 'error' ? '#7f1d1d' : '#14532d', color: '#fff' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default TopicManagement;
