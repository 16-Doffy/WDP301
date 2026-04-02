// TopicManagement.jsx - 3-panel layout: Topics | Subtopics | Labels
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, Card, Grid, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Alert, CircularProgress, Tooltip } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Folder as FolderIcon, ListAlt as ListIcon } from '@mui/icons-material';
import { getTopics, createTopic, updateTopic, deleteTopic, getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic, getLabelSets, createLabelSet, updateLabelSet, deleteLabelSet } from '../../services/TopicService';
import { useAuth } from '../../context/AuthContext';

const TopicManagement = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [labelSets, setLabelSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topicDialog, setTopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', color: '#3b82f6' } });
  const [subtopicDialog, setSubtopicDialog] = useState({ open: false, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } });
  const [labelDialog, setLabelDialog] = useState({ open: false, edit: false, data: { name: '', labels: [], allowMultiple: false } });
  const [labelInput, setLabelInput] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  useEffect(() => { loadTopics(); }, []);
  useEffect(() => { if (selectedTopic) loadSubtopics(selectedTopic._id); else { setSubtopics([]); setSelectedSubtopic(null); } }, [selectedTopic]);
  useEffect(() => { if (selectedSubtopic) loadLabelSets(selectedSubtopic._id); else setLabelSets([]); }, [selectedSubtopic]);

  const loadTopics = async () => {
    setLoading(true);
    try { const r = await getTopics(); setTopics(Array.isArray(r) ? r : []); } catch { setTopics([]); }
    setLoading(false);
  };
  const loadSubtopics = async (id) => {
    try { const r = await getSubtopics(id); setSubtopics(Array.isArray(r) ? r : []); } catch { setSubtopics([]); }
  };
  const loadLabelSets = async (id) => {
    try { const r = await getLabelSets(id); setLabelSets(Array.isArray(r) ? r : []); } catch { setLabelSets([]); }
  };

  const saveTopic = async () => {
    try {
      if (topicDialog.edit) await updateTopic(selectedTopic._id, topicDialog.data);
      else await createTopic(topicDialog.data);
      setTopicDialog({ ...topicDialog, open: false });
      loadTopics();
    } catch (e) { alert('Loi: ' + e.message); }
  };
  const saveSubtopic = async () => {
    if (!selectedTopic) return;
    try {
      if (subtopicDialog.edit) await updateSubtopic(selectedSubtopic._id, subtopicDialog.data);
      else await createSubtopic({ ...subtopicDialog.data, topicId: selectedTopic._id });
      setSubtopicDialog({ ...subtopicDialog, open: false });
      loadSubtopics(selectedTopic._id);
    } catch (e) { alert('Loi: ' + e.message); }
  };
  const saveLabelSet = async () => {
    if (!selectedSubtopic) return;
    try {
      if (labelDialog.edit) await updateLabelSet(labelDialog.data._id, labelDialog.data);
      else await createLabelSet({ ...labelDialog.data, subtopicId: selectedSubtopic._id });
      setLabelDialog({ ...labelDialog, open: false, data: { name: '', labels: [], allowMultiple: false } });
      loadLabelSets(selectedSubtopic._id);
    } catch (e) { alert('Loi: ' + e.message); }
  };
  const addLabel = () => {
    if (!labelInput.trim()) return;
    setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, labels: [...labelDialog.data.labels, { name: labelInput.trim(), color: labelColor, description: '', shortcut: '' }] } });
    setLabelInput('');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Chu de</Typography>
          <Typography variant="body2" color="text.secondary">Quan ly chu de lon va chu de nho</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTopicDialog({ open: true, edit: false, data: { name: '', description: '', color: '#3b82f6' } })}>Tao Topic</Button>
      </Box>
      <Grid container spacing={3} sx={{ height: 'calc(100vh - 220px)' }}>
        {/* Panel 1: Topics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Topics ({topics.length})</Typography>
            {loading ? <CircularProgress /> : topics.length === 0 ? <Alert severity="info">Chua co topic nao</Alert> : (
              <List>{topics.map((t) => (
                <ListItem key={t._id} selected={selectedTopic?._id === t._id} onClick={() => setSelectedTopic(t)} sx={{ mb: 1, borderRadius: 2, cursor: 'pointer', border: '1px solid', borderColor: 'divider', '&.Mui-selected': { bgcolor: 'primary.dark', borderColor: 'primary.main' } }}>
                  <FolderIcon sx={{ mr: 1, color: t.color || '#3b82f6' }} />
                  <ListItemText primary={t.name} secondary={t.description || `${t.subtopics || 0} subtopics`} primaryTypographyProps={{ fontWeight: 600 }} />
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setTopicDialog({ open: true, edit: true, data: t }); setSelectedTopic(t); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); if (confirm('Xoa topic?')) deleteTopic(t._id).then(loadTopics); }}><DeleteIcon fontSize="small" /></IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}</List>
            )}
          </Paper>
        </Grid>
        {/* Panel 2: Subtopics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Subtopics {selectedTopic ? `(${selectedTopic.name})` : ''}</Typography>
              {selectedTopic && <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setSubtopicDialog({ open: true, edit: false, data: { name: '', description: '', guideline: '', taskType: 'classification' } })}>Add</Button>}
            </Box>
            {!selectedTopic ? <Alert severity="warning">Chon topic ben trai</Alert> : subtopics.length === 0 ? <Alert severity="info">Chua co subtopic</Alert> : (
              <List>{subtopics.map((s) => (
                <ListItem key={s._id} selected={selectedSubtopic?._id === s._id} onClick={() => setSelectedSubtopic(s)} sx={{ mb: 1, borderRadius: 2, cursor: 'pointer', border: '1px solid', borderColor: 'divider', '&.Mui-selected': { bgcolor: 'secondary.dark', borderColor: 'secondary.main' } }}>
                  <ListIcon sx={{ mr: 1 }} />
                  <ListItemText primary={s.name} secondary={s.taskType} primaryTypographyProps={{ fontWeight: 600 }} />
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSubtopicDialog({ open: true, edit: true, data: s }); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); if (confirm('Xoa subtopic?')) deleteSubtopic(s._id).then(() => { loadSubtopics(selectedTopic._id); setSelectedSubtopic(null); }); }}><DeleteIcon fontSize="small" /></IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}</List>
            )}
          </Paper>
        </Grid>
        {/* Panel 3: Labels */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Labels {selectedSubtopic ? `(${selectedSubtopic.name})` : ''}</Typography>
              {selectedSubtopic && <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setLabelDialog({ open: true, edit: false, data: { name: 'Default', labels: [], allowMultiple: false } })}>Add LabelSet</Button>}
            </Box>
            {!selectedSubtopic ? <Alert severity="warning">Chon subtopic</Alert> : labelSets.length === 0 ? <Alert severity="info">Chua co labelset</Alert> : labelSets.map((ls) => (
              <Card key={ls._id} sx={{ mb: 2, p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>{ls.name}</Typography>
                  <Box>
                    <IconButton size="small" onClick={() => setLabelDialog({ open: true, edit: true, data: ls })}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm('Xoa labelset?')) deleteLabelSet(ls._id).then(() => loadLabelSets(selectedSubtopic._id)); }}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {ls.labels && ls.labels.map((lbl, i) => (
                    <Chip key={i} label={lbl.name} size="small" sx={{ bgcolor: lbl.color + '33', color: lbl.color, fontWeight: 600 }} />
                  ))}
                </Box>
              </Card>
            ))}
          </Paper>
        </Grid>
      </Grid>

      {/* Topic Dialog */}
      <Dialog open={topicDialog.open} onClose={() => setTopicDialog({ ...topicDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{topicDialog.edit ? 'Sua Topic' : 'Tao Topic'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten" value={topicDialog.data.name} onChange={(e) => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2 }} />
          <TextField fullWidth label="Mo ta" value={topicDialog.data.description} onChange={(e) => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, description: e.target.value } })} multiline rows={2} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField label="Mau" type="color" value={topicDialog.data.color} onChange={(e) => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: e.target.value } })} sx={{ width: 80 }} />
            {COLORS.map((c) => <Box key={c} onClick={() => setTopicDialog({ ...topicDialog, data: { ...topicDialog.data, color: c } })} sx={{ width: 28, height: 28, bgcolor: c, borderRadius: 1, cursor: 'pointer', border: topicDialog.data.color === c ? '2px solid white' : 'none' }} />)}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setTopicDialog({ ...topicDialog, open: false })}>Huy</Button><Button variant="contained" onClick={saveTopic}>{topicDialog.edit ? 'Luu' : 'Tao'}</Button></DialogActions>
      </Dialog>

      {/* Subtopic Dialog */}
      <Dialog open={subtopicDialog.open} onClose={() => setSubtopicDialog({ ...subtopicDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{subtopicDialog.edit ? 'Sua Subtopic' : 'Tao Subtopic'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten" value={subtopicDialog.data.name} onChange={(e) => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2 }} />
          <TextField fullWidth label="Mo ta" value={subtopicDialog.data.description} onChange={(e) => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, description: e.target.value } })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Guideline" value={subtopicDialog.data.guideline} onChange={(e) => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, guideline: e.target.value } })} multiline rows={2} sx={{ mb: 2 }} />
          <TextField fullWidth select SelectProps={{ native: true }} label="Loai Task" value={subtopicDialog.data.taskType} onChange={(e) => setSubtopicDialog({ ...subtopicDialog, data: { ...subtopicDialog.data, taskType: e.target.value } })}>
            <option value="classification">Classification</option>
            <option value="bbox">Bounding Box</option>
            <option value="ner">NER</option>
            <option value="sentiment">Sentiment</option>
            <option value="multi_label">Multi-label</option>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={() => setSubtopicDialog({ ...subtopicDialog, open: false })}>Huy</Button><Button variant="contained" onClick={saveSubtopic}>{subtopicDialog.edit ? 'Luu' : 'Tao'}</Button></DialogActions>
      </Dialog>

      {/* Label Dialog */}
      <Dialog open={labelDialog.open} onClose={() => setLabelDialog({ ...labelDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{labelDialog.edit ? 'Sua LabelSet' : 'Tao LabelSet'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten LabelSet" value={labelDialog.data.name} onChange={(e) => setLabelDialog({ ...labelDialog, data: { ...labelDialog.data, name: e.target.value } })} sx={{ mt: 2, mb: 2 }} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Nhan</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField size="small" placeholder="Ten nhan" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} sx={{ width: 60 }} />
              <Button size="small" variant="outlined" onClick={addLabel}>Them</Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {labelDialog.data.labels.map((lbl, i) => (
                <Chip key={i} label={lbl.name} size="small" sx={{ bgcolor: lbl.color + '33', color: lbl.color, fontWeight: 600 }} />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setLabelDialog({ ...labelDialog, open: false })}>Huy</Button><Button variant="contained" onClick={saveLabelSet}>{labelDialog.edit ? 'Luu' : 'Tao'}</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default TopicManagement;
