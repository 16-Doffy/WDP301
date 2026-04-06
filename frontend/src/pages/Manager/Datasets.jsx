import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, CircularProgress, Stack, LinearProgress, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, Snackbar,
  Checkbox, ListItemText,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  Search as SearchIcon, Download as DownloadIcon, CheckCircle as CheckCircleIcon,
  Dataset as DatasetIcon, Visibility as VisibilityIcon, Image as ImageIcon,
  AudioFile as AudioIcon, Description as TextIcon, Summarize as StatsIcon,
  FilterList as FilterIcon, Sort as SortIcon, AccessTime as TimeIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { getTopics, getSubtopics } from '../../services/TopicService';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const getFullImageUrl = (path, imageUrl, filename) => {
  const base = API_URL.replace(/\/+$/, '');
  if (imageUrl) return base + '/' + imageUrl.replace(/^\/+/, '');
  if (path) {
    const clean = path.replace(/^\/+/, '');
    if (filename && clean.endsWith(filename)) return base + '/' + clean;
    if (clean.startsWith('uploads/')) return base + '/' + clean;
    return base + '/' + (filename ? clean + '/' + filename : 'uploads/datasets/' + clean);
  }
  return filename ? base + '/uploads/datasets/' + filename : '';
};

const fmtDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return 'Vua xong';
  if (m < 60) return `${m}p truoc`;
  if (h < 24) return `${h}h truoc`;
  if (days < 30) return `${days}ngay truoc`;
  return fmtDate(d);
};

const panelSx = { borderRadius: 3, boxShadow: '0 16px 32px rgba(0,0,0,0.35)', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' };
const cardSx = { borderRadius: 3, boxShadow: '0 12px 24px rgba(0,0,0,0.28)', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', transition: 'all 0.2s', '&:hover': { borderColor: '#3b82f6', transform: 'translateY(-2px)' } };
const inputSx = { '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: '10px', '& fieldset': { borderColor: '#475569' }, '&:hover fieldset': { borderColor: '#64748b' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: '#94a3b8' } };
const modalSx = { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' };
const btnPrimary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', color: 'white', '&:hover': { bgcolor: '#3b82f6' } };
const btnSecondary = { borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#334155', color: '#e2e8f0', border: '1px solid #475569', '&:hover': { bgcolor: '#475569' } };

const ChartBar = ({ label, value, max, color = '#3b82f6' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 120, shrink: 0 }}><Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>{label}</Typography></Box>
      <Box sx={{ flex: 1, height: 18, borderRadius: 1, bgcolor: '#0f172a', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 1, display: 'flex', alignItems: 'center', px: 0.5, transition: 'width 0.5s' }}>
          {pct > 20 && <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>{value}</Typography>}
        </Box>
        {pct <= 20 && value > 0 && <Typography sx={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, color }}>{value}</Typography>}
      </Box>
      <Typography variant="caption" sx={{ width: 36, textAlign: 'right', color: '#64748b', fontSize: '0.65rem' }}>{pct}%</Typography>
    </Box>
  );
};

const TypeBadge = ({ type }) => {
  const t = { image: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }, audio: { bg: 'rgba(244,114,182,0.15)', color: '#f472b6' }, text: { bg: 'rgba(52,211,153,0.15)', color: '#34d399' } }[type] || { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
  return <Chip label={type?.toUpperCase() || 'IMAGE'} size="small" sx={{ bgcolor: t.bg, color: t.color, fontWeight: 700, fontSize: '0.65rem', height: 20 }} />;
};

const Datasets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDs, setSelectedDs] = useState(null);
  const [editingDs, setEditingDs] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'image', subtopicId: '' });
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState([]);
  const [editTopicName, setEditTopicName] = useState('');
  const [subtopicData, setSubtopicData] = useState({});
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDs, setDetailDs] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detailItems, setDetailItems] = useState([]);
  const [detailSubtopicSummary, setDetailSubtopicSummary] = useState([]);
  const [detailSubtopicFilter, setDetailSubtopicFilter] = useState('__all__');
  const [detailItemsLoading, setDetailItemsLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDs, setExportDs] = useState(null);
  const [exportFormat, setExportFormat] = useState('JSON');
  const [exportPreview, setExportPreview] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [statusByDs, setStatusByDs] = useState({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const highlightedDsId = location.state?.highlightDsId || null;

  const getDsStatus = (stat) => {
    if (!stat) return { status: 'not_started', label: 'Chua bat dau', color: '#64748b' };
    const { totalRawItems = 0, counts = {} } = stat;
    const approved = counts.approved || 0;
    const submitted = counts.submitted || 0;
    const pending = counts.pendingAnnotation || 0;
    if (totalRawItems === 0 || approved === 0) {
      return pending > 0 || submitted > 0 ? { status: 'annotating', label: 'Dang ghi nhan', color: '#3b82f6' } : { status: 'not_started', label: 'Chua bat dau', color: '#64748b' };
    }
    const pct = Math.min((approved / totalRawItems) * 100, 100);
    if (pct >= 100) return { status: 'ready', label: 'San sang AI', color: '#22c55e' };
    if (submitted > 0) return { status: 'under_review', label: 'Dang review', color: '#f59e0b' };
    return { status: 'annotating', label: 'Dang ghi nhan', color: '#3b82f6' };
  };

  const fetchDatasets = async () => {
    try {
      const res = await axios.get(API_URL + '/api/datasets', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      const all = res.data || [];
      setDatasets(all);
      const entries = await Promise.all(all.map(async (ds) => {
        try {
          const s = await axios.get(API_URL + '/api/datasets/' + ds._id + '/status', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
          return [ds._id, s.data];
        } catch { return [ds._id, null]; }
      }));
      setStatusByDs(Object.fromEntries(entries));
    } catch (err) {
      setError('Khong tai duoc danh sach');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDatasets(); fetchTopics(); }, []);

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

  const fetchTopics = async () => {
    try {
      const res = await getTopics();
      const data = Array.isArray(res) ? res : (res?.error ? [] : []);
      setTopics(data);
    } catch { setTopics([]); }
  };

  const loadSubtopicsForTopic = async (topicId) => {
    try {
      const res = await getSubtopics(topicId);
      const subs = Array.isArray(res) ? res : [];
      setSubtopics(subs);
    } catch { setSubtopics([]); }
  };

  useEffect(() => {
    if (selectedTopicId) {
      if (!editOpen) {
        setSelectedSubtopicId('');
        setSelectedSubtopicIds([]);
        setForm(f => ({ ...f, subtopicId: '' }));
      }
      setSubtopicData({});
      loadSubtopicsForTopic(selectedTopicId);
    } else {
      setSubtopics([]);
      setSubtopicData({});
    }
  }, [selectedTopicId, editOpen]);

  const loadSubtopicPool = async (subtopicIds) => {
    const ids = Array.isArray(subtopicIds) ? subtopicIds.filter(Boolean) : (subtopicIds ? [subtopicIds] : []);
    if (!ids.length) {
      setSubtopicData({});
      return;
    }
    try {
      const results = {};
      await Promise.all(ids.map(async (id) => {
        const [assetRes, labelRes] = await Promise.all([
          axios.get(API_URL + '/api/subtopics/' + id + '/assets', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
          axios.get(API_URL + '/api/labelsets?subtopicId=' + id, { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
        ]);
        const assets = Array.isArray(assetRes.data) ? assetRes.data : [];
        const labels = Array.isArray(labelRes.data) ? labelRes.data : [];
        const imgs = assets.filter(a => a.type === 'image').length;
        const txts = assets.filter(a => a.type === 'text').length;
        const auds = assets.filter(a => a.type === 'audio').length;
        results[id] = {
          total: assets.length,
          images: imgs,
          texts: txts,
          audios: auds,
          labels: labels,
        };
      }));
      setSubtopicData(results);
    } catch {
      setSubtopicData({});
    }
  };

  useEffect(() => {
    if (selectedSubtopicIds.length > 0) {
      loadSubtopicPool(selectedSubtopicIds);
    } else {
      setSubtopicData({});
    }
  }, [selectedSubtopicIds]);

  const filtered = useMemo(() => {
    let r = [...datasets];
    if (search.trim()) {
      const t = search.toLowerCase();
      r = r.filter(ds => ds.name?.toLowerCase().includes(t) || ds.description?.toLowerCase().includes(t));
    }
    if (filterType !== 'all') r = r.filter(ds => ds.type === filterType);
    if (filterStatus !== 'all') r = r.filter(ds => getDsStatus(statusByDs[ds._id]).status === filterStatus);
    r.sort((a, b) => {
      let av, bv;
      if (sortBy === 'name') { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
      if (sortBy === 'items') { av = statusByDs[a._id]?.totalRawItems || 0; bv = statusByDs[b._id]?.totalRawItems || 0; } else
      if (sortBy === 'approved') { av = statusByDs[a._id]?.counts?.approved || 0; bv = statusByDs[b._id]?.counts?.approved || 0; } else
      if (sortBy === 'progress') {
        const sg = (id) => { const s = statusByDs[id]; const raw = s?.totalRawItems || 0; const ap = s?.counts?.approved || 0; return raw > 0 ? (ap / raw) * 100 : 0; };
        av = sg(a._id); bv = sg(b._id);
      } else { av = new Date(a.createdAt || 0); bv = new Date(b.createdAt || 0); }
      if (typeof av === 'number') return sortOrder === 'asc' ? av - bv : bv - av;
      return sortOrder === 'asc' ? av - bv : bv - av;
    });
    return r;
  }, [datasets, search, filterType, filterStatus, sortBy, sortOrder, statusByDs]);

  const stats = useMemo(() => {
    const vals = Object.values(statusByDs);
    return {
      totalItems: vals.reduce((s, v) => s + (v?.totalRawItems || 0), 0),
      totalApproved: vals.reduce((s, v) => s + (v?.counts?.approved || 0), 0),
      totalRejected: vals.reduce((s, v) => s + (v?.counts?.rejected || 0), 0),
      ready: vals.filter(v => getDsStatus(v).status === 'ready').length,
      annotating: vals.filter(v => getDsStatus(v).status === 'annotating').length,
      review: vals.filter(v => getDsStatus(v).status === 'under_review').length,
    };
  }, [statusByDs]);

  const handleOpenCreate = () => {
    setForm({ name: '', description: '', type: 'image', subtopicId: '' });
    setSelectedTopicId('');
    setSelectedSubtopicId('');
    setSelectedSubtopicIds([]);
    setSubtopics([]);
    setSubtopicData({});
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return alert('Nhap ten dataset');
    if (!selectedSubtopicIds.length) return alert('Chon Topic va it nhat 1 Subtopic');
    setCreating(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        subtopicId: selectedSubtopicIds[0],
        subtopicIds: selectedSubtopicIds,
        description: form.description.trim(),
      };
      const cr = await axios.post(API_URL + '/api/datasets', payload, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      const created = cr.data;
      setForm({ name: '', description: '', type: 'image', subtopicId: '' });
      setSelectedTopicId('');
      setSelectedSubtopicId('');
      setSelectedSubtopicIds([]);
      setSubtopicData({});
      setCreateOpen(false);
      await fetchDatasets();
      if (created?._id) {
        navigate('/manager/projects', {
          state: {
            highlightDsId: created._id,
            highlightDsName: created.name,
            selectedTopicId: selectedTopicId,
            selectedSubtopicId: selectedSubtopicIds[0] || '',
            autoTab: 'datasets',
          },
        });
      }
    } catch (err) {
      setError('Loi tao dataset: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDs) return;
    try {
      await axios.delete(API_URL + '/api/datasets/' + selectedDs._id, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setDeleteOpen(false);
      setSelectedDs(null);
      fetchDatasets();
    } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
  };

  const handleOpenEdit = async (ds) => {
    setEditingDs(ds);
    setForm({ name: ds.name || '', description: ds.description || '', type: ds.type || 'image', subtopicId: ds.subtopicId || '' });
    setSelectedTopicId('');
    setEditTopicName('');
    const existingSubtopicIds = Array.isArray(ds.subtopicIds) && ds.subtopicIds.length > 0
      ? ds.subtopicIds.map(id => String(id))
      : (ds.subtopicId ? [String(ds.subtopicId)] : []);
    setSelectedSubtopicId(existingSubtopicIds[0] || '');
    setSelectedSubtopicIds(existingSubtopicIds);
    setSubtopicData({});

    if (ds.subtopicId) {
      try {
        const subRes = await axios.get(API_URL + '/api/subtopics/' + ds.subtopicId, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
        const topicId = subRes?.data?.subtopic?.topicId?._id || subRes?.data?.subtopic?.topicId || '';
        const topicName = subRes?.data?.subtopic?.topicId?.name || '';
        if (topicId) {
          setSelectedTopicId(topicId);
          setEditTopicName(topicName);
          await loadSubtopicsForTopic(topicId);
        }
        await loadSubtopicPool(ds.subtopicId);
      } catch {
        setSelectedTopicId('');
        setEditTopicName('');
      }
    }

    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDs) return;
    if (!form.name.trim()) return alert('Nhap ten dataset');

    setUpdating(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || '',
        subtopicIds: selectedSubtopicIds,
      };

      await axios.put(API_URL + '/api/datasets/' + editingDs._id, payload, { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setEditOpen(false);
      setEditingDs(null);
      await fetchDatasets();
      setToast({ open: true, message: 'Cap nhat dataset thanh cong', severity: 'success' });
    } catch (err) {
      alert('Loi cap nhat dataset: ' + (err.response?.data?.message || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDetail = async (ds) => {
    setDetailDs(ds);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailItemsLoading(true);
    setDetailTab(0);
    setDetailSubtopicFilter('__all__');
    try {
      const [sRes, iRes] = await Promise.all([
        axios.get(API_URL + '/api/datasets/' + ds._id + '/status', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
        axios.get(API_URL + '/api/datasets/' + ds._id + '/items', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
      ]);
      setDetailDs(prev => ({ ...prev, statusData: sRes.data }));
      setDetailItems(iRes.data?.items || []);
      setDetailSubtopicSummary(iRes.data?.subtopicSummary || []);
    } catch {} finally { setDetailLoading(false); setDetailItemsLoading(false); }
  };

  const handleOpenExport = async (ds) => {
    setExportDs(ds);
    setExportOpen(true);
    setExportFormat('JSON');
    setExportLoading(true);
    setExportPreview(null);
    try {
      const s = statusByDs[ds._id];
      const previewItems = (s?.finalItems || []).slice(0, 5).map(item => {
        const labels = item.labels?.objects || item.labels?.spans || item.labels?.label || [];
        const arr = Array.isArray(labels) ? labels : [labels];
        return { filename: item.dataItem?.originalName || item.dataItem?.filename || 'unknown', labels: arr.filter(Boolean).map(l => typeof l === 'string' ? l : l.label || l.text || l) };
      });
      const dist = {};
      (s?.finalItems || []).forEach(item => {
        const lbls = item.labels?.objects || item.labels?.spans || [];
        lbls.forEach(l => { const k = typeof l === 'string' ? l : l.label || l.text || 'unknown'; dist[k] = (dist[k] || 0) + 1; });
      });
      setExportPreview({ dataset: { name: ds.name, type: ds.type, totalRawItems: s?.totalRawItems || 0, totalApproved: s?.counts?.approved || 0, labelDistribution: dist, sampleItems: previewItems }, formats: ['JSON', 'YOLO', 'VOC', 'COCO', 'CSV'] });
    } catch {} finally { setExportLoading(false); }
  };

  const handleExport = async () => {
    if (!exportDs) return;
    try {
      const resp = await axios.get(API_URL + '/api/datasets/' + exportDs._id + '/final-export', { responseType: 'blob', headers: { Authorization: 'Bearer ' + getAuthToken() } });
      const blob = new Blob([resp.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dataset_${exportDs.name}_${exportFormat}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportOpen(false);
    } catch (err) { alert(err.response?.data?.message || 'Loi export'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, bgcolor: '#0f172a' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', bgcolor: '#0f172a' }}>
      <Box sx={panelSx}>
        {/* Header */}
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #334155' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>Datasets</Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>Quan ly bo du lieu cho AI Training</Typography>
            </Box>
            {!isAdmin && <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={btnPrimary}>Tao Dataset</Button>}
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ p: 2, borderBottom: '1px solid #334155', display: 'flex', gap: 3, flexWrap: 'wrap', bgcolor: '#0f172a' }}>
          {[
            { label: 'Tong Datasets', value: datasets.length, color: '#60a5fa' },
            { label: 'Raw Items', value: stats.totalItems, color: '#e2e8f0' },
            { label: 'Da Duyet', value: stats.totalApproved, color: '#22c55e' },
            { label: 'Tu Choi', value: stats.totalRejected, color: '#ef4444' },
            { label: 'San sang AI', value: stats.ready, color: '#a78bfa' },
            { label: 'Dang GN', value: stats.annotating, color: '#3b82f6' },
            { label: 'Cho Review', value: stats.review, color: '#fbbf24' },
          ].map(s => (
            <Box key={s.label} sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Filter Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid #334155' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField placeholder="Tim kiem..." size="small" value={search} onChange={e => setSearch(e.target.value)} sx={{ ...inputSx, minWidth: 200, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 38 } }} InputProps={{ startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 18 }} /> }} />
            <Button size="small" startIcon={<FilterIcon />} onClick={() => setShowFilters(!showFilters)} sx={btnSecondary}>Loc {showFilters ? '(Bat)' : ''}</Button>
            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
              <Chip label={`${filtered.length} / ${datasets.length}`} size="small" sx={{ bgcolor: '#334155', color: '#94a3b8', fontWeight: 700 }} />
              <IconButton size="small" onClick={() => setViewMode(v => v === 'card' ? 'table' : 'card')} sx={{ color: '#94a3b8' }}><DatasetIcon /></IconButton>
            </Box>
          </Box>
          {showFilters && (
            <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel sx={{ color: '#94a3b8' }}>Loai</InputLabel>
                <Select value={filterType} label="Loai" onChange={e => setFilterType(e.target.value)} sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 38, color: '#e2e8f0' } }}>
                  <MenuItem value="all">Tat ca</MenuItem><MenuItem value="image">Image</MenuItem><MenuItem value="audio">Audio</MenuItem><MenuItem value="text">Text</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: '#94a3b8' }}>Trang thai</InputLabel>
                <Select value={filterStatus} label="Trang thai" onChange={e => setFilterStatus(e.target.value)} sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 38, color: '#e2e8f0' } }}>
                  <MenuItem value="all">Tat ca</MenuItem><MenuItem value="ready">San sang AI</MenuItem><MenuItem value="under_review">Cho Review</MenuItem><MenuItem value="annotating">Dang ghi nhan</MenuItem><MenuItem value="not_started">Chua bat dau</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel sx={{ color: '#94a3b8' }}>Sap xep</InputLabel>
                <Select value={sortBy} label="Sap xep" onChange={e => setSortBy(e.target.value)} sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 38, color: '#e2e8f0' } }}>
                  <MenuItem value="createdAt">Ngay tao</MenuItem><MenuItem value="name">Ten</MenuItem><MenuItem value="items">So items</MenuItem><MenuItem value="approved">Da duyet</MenuItem><MenuItem value="progress">Tien do</MenuItem>
                </Select>
              </FormControl>
              <Button size="small" variant="outlined" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} startIcon={<SortIcon />} sx={{ ...btnSecondary, height: 38 }}>{sortOrder === 'desc' ? 'Giam dan' : 'Tang dan'}</Button>
              <Button size="small" onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); setSortBy('createdAt'); setSortOrder('desc'); }} sx={{ color: '#94a3b8', textTransform: 'none', fontWeight: 600 }}>Xoa loc</Button>
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          {viewMode === 'card' ? (
            <Grid container spacing={2.5}>
              {filtered.map(ds => {
                const stat = statusByDs[ds._id];
                const raw = stat?.totalRawItems || ds.totalItems || ds.files?.length || 0;
                const approved = stat?.counts?.approved || 0;
                const pct = raw > 0 ? Math.min(Math.round((approved / raw) * 100), 100) : 0;
                const si = getDsStatus(stat);
                return (
                  <Grid item xs={12} sm={6} lg={4} key={ds._id}>
                    <Card sx={{ ...cardSx, border: highlightedDsId === ds._id ? '2px solid #22c55e' : cardSx.border, boxShadow: highlightedDsId === ds._id ? '0 0 20px rgba(34,197,94,0.4)' : cardSx.boxShadow }} id={'dataset-card-' + ds._id}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                            {ds.type === 'audio' ? <AudioIcon sx={{ fontSize: 20, color: '#f472b6' }} /> : ds.type === 'text' ? <TextIcon sx={{ fontSize: 20, color: '#34d399' }} /> : <ImageIcon sx={{ fontSize: 20, color: '#f59e0b' }} />}
                            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</Typography>
                          </Box>
                          {!isAdmin && <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => { setSelectedDs(ds); setDeleteOpen(true); }}><DeleteIcon fontSize="small" /></IconButton>}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          <TimeIcon sx={{ fontSize: 12, color: '#64748b' }} />
                          <Typography variant="caption" sx={{ color: '#64748b' }}>Tao: {fmtDate(ds.createdAt)}</Typography>
                          <Typography variant="caption" sx={{ color: '#475569' }}>|</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{timeAgo(ds.createdAt)}</Typography>
                        </Box>
                        <Stack direction="row" spacing={0.8} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                          <TypeBadge type={ds.type} />
                          <Chip label={`${raw} items`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                          {ds.description && <Tooltip title={ds.description}><Chip label="Co mo ta" size="small" sx={{ bgcolor: 'rgba(168,85,247,0.15)', color: '#a78bfa', fontWeight: 700, fontSize: '0.65rem', height: 20 }} /></Tooltip>}
                        </Stack>
                        <Box sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tien do</Typography>
                            <Typography variant="caption" sx={{ color: si.color, fontWeight: 700, fontSize: '0.7rem' }}>{pct}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: si.color, borderRadius: 3 } }} />
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.6rem', mt: 0.3 }}>Duyet: {approved} | Tu choi: {stat?.counts?.rejected || 0} | Review: {(stat?.counts?.submitted || 0) + (stat?.counts?.pendingAnnotation || 0)}</Typography>
                        </Box>
                        <Box sx={{ mb: 2, p: 1.2, borderRadius: 1.5, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: si.color }} />
                          <Typography variant="caption" fontWeight={700} sx={{ color: si.color }}>{si.label}</Typography>
                          <Box sx={{ flex: 1 }} />
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{(stat?.votes?.approveVotes || 0) + (stat?.votes?.rejectVotes || 0)}/{stat?.votes?.totalVotes || 0} votes</Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => handleOpenDetail(ds)} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderColor: '#3b82f6', color: '#3b82f6', fontSize: '0.75rem' }}>Chi tiet</Button>
                          {!isAdmin && <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleOpenEdit(ds)} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderColor: '#f59e0b', color: '#f59e0b', fontSize: '0.75rem' }}>Sua</Button>}
                          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleOpenExport(ds)} disabled={si.status !== 'ready'} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderColor: si.status === 'ready' ? '#22c55e' : '#475569', color: si.status === 'ready' ? '#22c55e' : '#64748b', fontSize: '0.75rem' }}>Export</Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: '#0f172a', border: '1px solid #334155', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: '#1e293b' }}>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Dataset</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Loai</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Items</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Da duyet</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Tu choi</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Tien do</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Trang thai</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Ngay tao</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(ds => {
                    const stat = statusByDs[ds._id];
                    const raw = stat?.totalRawItems || ds.totalItems || ds.files?.length || 0;
                    const approved = stat?.counts?.approved || 0;
                    const rejected = stat?.counts?.rejected || 0;
                    const pct = raw > 0 ? Math.min(Math.round((approved / raw) * 100), 100) : 0;
                    const si = getDsStatus(stat);
                    return (
                      <TableRow key={ds._id} hover sx={{ '&:hover': { bgcolor: '#1e293b' } }}>
                        <TableCell sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{ds.name}</TableCell>
                        <TableCell><TypeBadge type={ds.type} /></TableCell>
                        <TableCell sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>{raw}</TableCell>
                        <TableCell sx={{ color: '#22c55e', fontWeight: 700, fontSize: '0.75rem' }}>{approved}</TableCell>
                        <TableCell sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>{rejected}</TableCell>
                        <TableCell sx={{ width: 120 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#334155', overflow: 'hidden' }}>
                              <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: si.color, borderRadius: 3 }} />
                            </Box>
                            <Typography sx={{ color: si.color, fontSize: '0.7rem', fontWeight: 700, minWidth: 32 }}>{pct}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell><Chip label={si.label} size="small" sx={{ bgcolor: `${si.color}20`, color: si.color, fontWeight: 700, fontSize: '0.65rem', height: 20 }} /></TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          <div>{fmtDate(ds.createdAt)}</div>
                          <div style={{ color: '#475569', fontSize: '0.6rem' }}>{timeAgo(ds.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" sx={{ color: '#60a5fa' }} onClick={() => handleOpenDetail(ds)}><VisibilityIcon fontSize="small" /></IconButton>
                            {!isAdmin && <IconButton size="small" sx={{ color: '#f59e0b' }} onClick={() => handleOpenEdit(ds)}><EditIcon fontSize="small" /></IconButton>}
                            <IconButton size="small" sx={{ color: '#22c55e' }} onClick={() => handleOpenExport(ds)} disabled={si.status !== 'ready'}><DownloadIcon fontSize="small" /></IconButton>
                            {!isAdmin && <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => { setSelectedDs(ds); setDeleteOpen(true); }}><DeleteIcon fontSize="small" /></IconButton>}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {filtered.length === 0 && <Box sx={{ textAlign: 'center', py: 8 }}><DatasetIcon sx={{ fontSize: 64, color: '#475569', mb: 2 }} /><Typography variant="h6" sx={{ color: '#94a3b8' }}>Khong tim thay dataset</Typography></Box>}
        </Box>
      </Box>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DatasetIcon sx={{ color: '#3b82f6' }} />{detailDs?.name}<Box sx={{ flex: 1 }} /><TypeBadge type={detailDs?.type} />
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {detailLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
            <Box>
              <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box><Typography variant="caption" sx={{ color: '#64748b' }}>Ngay tao</Typography><Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{fmtDate(detailDs?.createdAt)}</Typography></Box>
                <Box><Typography variant="caption" sx={{ color: '#64748b' }}>Cap nhat lan cuoi</Typography><Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{fmtDate(detailDs?.updatedAt)}</Typography></Box>
                <Box><Typography variant="caption" sx={{ color: '#64748b' }}>Tao</Typography><Typography variant="body2" sx={{ color: '#94a3b8' }}>{timeAgo(detailDs?.createdAt)}</Typography></Box>
              </Box>
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 3, '& .MuiTab-root': { color: '#94a3b8', textTransform: 'none', fontWeight: 600 }, '& .Mui-selected': { color: '#60a5fa' }, '& .MuiTabs-indicator': { bgcolor: '#60a5fa' } }}>
                <Tab label="Thong ke" icon={<StatsIcon />} iconPosition="start" />
                <Tab label="Nhan" icon={<DatasetIcon />} iconPosition="start" />
                <Tab label="Items" icon={<ImageIcon />} iconPosition="start" />
              </Tabs>
              {detailTab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: '#e2e8f0' }}>Thong ke chi tiet</Typography>
                      {detailDs?.statusData && (
                        <Stack spacing={1.5}>
                          {[
                            { label: 'Tong Items', value: detailDs.statusData.totalRawItems, color: '#e2e8f0' },
                            { label: 'Da ghi nhan', value: detailDs.statusData.counts?.completed || 0, color: '#60a5fa' },
                            { label: 'Dang review', value: detailDs.statusData.counts?.submitted || 0, color: '#fbbf24' },
                            { label: 'Da duyet', value: detailDs.statusData.counts?.approved || 0, color: '#22c55e' },
                            { label: 'Tu choi', value: detailDs.statusData.counts?.rejected || 0, color: '#ef4444' },
                            { label: 'Tong Votes', value: detailDs.statusData.votes?.totalVotes || 0, color: '#a78bfa' },
                            { label: 'Vote duyet', value: detailDs.statusData.votes?.approveVotes || 0, color: '#22c55e' },
                            { label: 'Vote tu choi', value: detailDs.statusData.votes?.rejectVotes || 0, color: '#ef4444' },
                          ].map(item => <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" sx={{ color: '#94a3b8' }}>{item.label}</Typography><Typography variant="body2" fontWeight={700} sx={{ color: item.color }}>{item.value}</Typography></Box>)}
                        </Stack>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: '#e2e8f0' }}>Phan bo nhan</Typography>
                      {detailDs?.statusData?.finalItems && detailDs.statusData.finalItems.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {(() => {
                            const dist = {};
                            const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                            let ci = 0;
                            detailDs.statusData.finalItems.forEach(item => {
                              const lbls = item.labels?.objects || item.labels?.spans || [];
                              lbls.forEach(l => {
                                const k = l.label || l.text || 'unknown';
                                dist[k] = { count: (dist[k]?.count || 0) + 1, color: dist[k]?.color || colors[ci++ % colors.length] };
                              });
                            });
                            const sorted = Object.entries(dist).sort((a, b) => b[1].count - a[1].count);
                            const max = sorted[0]?.[1].count || 1;
                            return sorted.map(([k, v]) => <ChartBar key={k} label={k} value={v.count} max={max} color={v.color} />);
                          })()}
                        </Box>
                      ) : <Typography variant="body2" sx={{ color: '#94a3b8' }}>Chua co nhan nao</Typography>}
                    </Box>
                  </Grid>
                </Grid>
              )}
              {detailTab === 1 && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>Tat ca nhan da ghi nhan trong dataset</Typography>
                  {detailDs?.statusData?.finalItems && detailDs.statusData.finalItems.length > 0 ? (
                    <Grid container spacing={1}>
                      {(() => {
                        const dist = {};
                        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                        let ci = 0;
                        detailDs.statusData.finalItems.forEach(item => {
                          const lbls = item.labels?.objects || item.labels?.spans || [];
                          lbls.forEach(l => {
                            const k = l.label || l.text || 'unknown';
                            if (!dist[k]) dist[k] = { count: 0, color: colors[ci++ % colors.length] };
                            dist[k].count++;
                          });
                        });
                        return Object.entries(dist).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => (
                          <Grid item xs="auto" key={k}>
                            <Chip label={`${k} (${v.count})`} sx={{ bgcolor: `${v.color}25`, color: v.color, border: `1px solid ${v.color}60`, fontWeight: 700, fontSize: '0.75rem' }} />
                          </Grid>
                        ));
                      })()}
                    </Grid>
                  ) : <Box sx={{ textAlign: 'center', py: 8, color: '#64748b' }}><Typography>Chua co nhan nao</Typography></Box>}
                </Box>
              )}
              {detailTab === 2 && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                    Hien thi items ({detailSubtopicFilter === '__all__' ? detailItems.length : detailItems.filter(it => (it.subtopicId?.toString?.() || it.subtopicId || '__none__') === detailSubtopicFilter).length})
                  </Typography>

                  {!detailItemsLoading && detailSubtopicSummary.length > 0 && (
                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#e2e8f0' }}>Chi tiet theo Subtopic</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        <Chip
                          clickable
                          onClick={() => setDetailSubtopicFilter('__all__')}
                          label={`Tat ca: ${detailItems.length} items`}
                          sx={{
                            bgcolor: detailSubtopicFilter === '__all__' ? 'rgba(34,197,94,0.2)' : 'rgba(71,85,105,0.35)',
                            color: detailSubtopicFilter === '__all__' ? '#4ade80' : '#cbd5e1',
                            border: detailSubtopicFilter === '__all__' ? '1px solid rgba(74,222,128,0.7)' : '1px solid rgba(148,163,184,0.45)',
                            fontWeight: 700,
                          }}
                        />
                        {detailSubtopicSummary.map((s, idx) => {
                          const key = s.subtopicId?.toString?.() || s.subtopicId || '__none__';
                          const active = detailSubtopicFilter === key;
                          return (
                            <Chip
                              clickable
                              onClick={() => setDetailSubtopicFilter(key)}
                              key={s.subtopicId || idx}
                              label={`${s.subtopicName || 'Khong ro'}: ${s.totalItems} items (OK ${s.approved}, cho ${s.pending + s.inReview}, reject ${s.rejected})`}
                              sx={{
                                bgcolor: active ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.12)',
                                color: active ? '#bfdbfe' : '#93c5fd',
                                border: active ? '1px solid rgba(96,165,250,0.9)' : '1px solid rgba(59,130,246,0.4)',
                                fontWeight: 700,
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  {detailItemsLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
                    <Grid container spacing={1.5}>
                      {detailItems
                        .filter((item) => detailSubtopicFilter === '__all__' || (item.subtopicId?.toString?.() || item.subtopicId || '__none__') === detailSubtopicFilter)
                        .map((item, idx) => {
                        const src = getFullImageUrl(item.path, item.imageUrl, item.filename);
                        const fn = item.originalName || item.filename || item.path || 'Unknown';
                        const isText = /\.(txt|csv|json|xml)$/i.test(fn) || item.mimeType?.startsWith('text/');
                        const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fn) || item.mimeType?.startsWith('audio/');
                        const anns = (item.annotations || []).filter(a => a.status === 'approved');
                        return (
                          <Grid item xs={4} sm={3} md={2} key={item.id || idx}>
                            <Box onClick={() => navigate(`/manager/datasets/${detailDs?._id}/items/${item.id || idx}`, { state: { item, datasetName: detailDs?.name } })} sx={{ position: 'relative', width: '100%', paddingTop: '100%', overflow: 'hidden', borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#3b82f6', transform: 'scale(1.05)' } }}>
                              {src ? <Box component="img" src={src} alt={fn} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                               : isText ? <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b' }}><Typography sx={{ color: '#60a5fa', fontSize: 20, fontWeight: 700 }}>T</Typography><Typography sx={{ color: '#94a3b8', fontSize: 8 }}>Text</Typography></Box>
                               : isAudio ? <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b' }}><Typography sx={{ color: '#f472b6', fontSize: 20, fontWeight: 700 }}>♪</Typography><Typography sx={{ color: '#94a3b8', fontSize: 8 }}>Audio</Typography></Box>
                               : <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 10 }}>No preview</Box>}
                              {anns.length > 0 && <Box sx={{ position: 'absolute', bottom: 2, right: 2, bgcolor: '#22c55e', color: '#fff', borderRadius: 1, px: 0.5, fontSize: '0.6rem', fontWeight: 700 }}>{anns.length} GN</Box>}
                            </Box>
                            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.62rem' }}>
                              {item.subtopicName || 'Khong ro subtopic'}
                            </Typography>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setDetailOpen(false)} sx={btnSecondary}>Dong</Button></DialogActions>
      </Dialog>

      {/* Export Preview Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}><DownloadIcon sx={{ color: '#22c55e' }} />Export: {exportDs?.name}</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {exportLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : exportPreview ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[{ label: 'Tong Items', value: exportPreview.dataset.totalRawItems, color: '#e2e8f0' }, { label: 'Da Duyet', value: exportPreview.dataset.totalApproved, color: '#22c55e' }].map(item => (
                  <Grid item xs={6} key={item.label}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a', textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: item.color }}>{item.value}</Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>{item.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              {Object.keys(exportPreview.dataset.labelDistribution).length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#e2e8f0' }}>Phan bo nhan</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(exportPreview.dataset.labelDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v], i) => {
                      const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];
                      return <ChartBar key={k} label={k} value={v} max={Object.values(exportPreview.dataset.labelDistribution)[0]} color={colors[i % colors.length]} />;
                    })}
                  </Box>
                </Box>
              )}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#e2e8f0' }}>Chon dinh dang</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  {exportPreview.formats.map(fmt => (
                    <Chip key={fmt} label={fmt} onClick={() => setExportFormat(fmt)} sx={{ fontWeight: 700, cursor: 'pointer', bgcolor: exportFormat === fmt ? '#2563eb' : '#334155', color: exportFormat === fmt ? '#fff' : '#94a3b8', border: exportFormat === fmt ? '2px solid #3b82f6' : '1px solid #475569', '&:hover': { bgcolor: exportFormat === fmt ? '#3b82f6' : '#475569' } }} />
                  ))}
                </Stack>
              </Box>
              {exportPreview.dataset.sampleItems.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#e2e8f0' }}>Xem truoc ({exportPreview.dataset.sampleItems.length} items)</Typography>
                  <Box sx={{ maxHeight: 200, overflowY: 'auto', p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                    {exportPreview.dataset.sampleItems.map((item, i) => (
                      <Box key={i} sx={{ py: 1, borderBottom: i < exportPreview.dataset.sampleItems.length - 1 ? '1px solid #334155' : 'none' }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>{item.filename}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                          {item.labels.slice(0, 5).map((l, j) => <Chip key={j} label={l} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />)}
                          {item.labels.length > 5 && <Typography sx={{ color: '#64748b', fontSize: '0.65rem', alignSelf: 'center' }}>+{item.labels.length - 5}</Typography>}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : <Typography sx={{ color: '#94a3b8' }}>Khong co du lieu</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExportOpen(false)} sx={btnSecondary}>Huy</Button>
          <Button variant="contained" onClick={handleExport} disabled={!exportPreview || exportPreview.dataset.totalApproved === 0} startIcon={<DownloadIcon />} sx={{ ...btnPrimary, bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' } }}>Xac nhan Export</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Tao Dataset Moi</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Dataset *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <FormControl fullWidth sx={{ mb: 2, ...inputSx }}>
            <InputLabel>Loai Dataset *</InputLabel>
            <Select value={form.type} label="Loai Dataset *" onChange={e => setForm({ ...form, type: e.target.value })}>
              <MenuItem value="image">Image</MenuItem><MenuItem value="text">Text</MenuItem><MenuItem value="audio">Audio</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth multiline rows={2} label="Mo ta" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} sx={{ mb: 2, ...inputSx }} />

          {/* Context: Topic + Subtopic */}
          <Box sx={{ p: 2, border: '1px solid #3b82f6', borderRadius: 2, mb: 2, bgcolor: 'rgba(59,130,246,0.05)' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#60a5fa', mb: 1.5 }}>Dataset Context (Taxonomy Structure)</Typography>
            <FormControl fullWidth sx={{ mb: 1.5, ...inputSx }}>
              <InputLabel>Topic *</InputLabel>
              <Select value={selectedTopicId} label="Topic *" onChange={e => setSelectedTopicId(e.target.value)}>
                <MenuItem value=""><em>Khong chon</em></MenuItem>
                {topics.map(t => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
            {selectedTopicId && (
              <FormControl fullWidth sx={{ ...inputSx }}>
                <InputLabel>Subtopics *</InputLabel>
                <Select
                  multiple
                  value={selectedSubtopicIds}
                  label="Subtopics *"
                  onChange={e => {
                    const vals = e.target.value;
                    const normalized = Array.isArray(vals) ? vals : [];
                    setSelectedSubtopicIds(normalized);
                    setSelectedSubtopicId(normalized[0] || '');
                  }}
                  renderValue={(selected) => {
                    const selectedSet = new Set(selected);
                    const names = subtopics.filter(s => selectedSet.has(s._id)).map(s => s.name);
                    return names.length > 0 ? names.join(', ') : 'Khong chon';
                  }}
                >
                  {subtopics.map(s => (
                    <MenuItem key={s._id} value={s._id}>
                      <Checkbox checked={selectedSubtopicIds.indexOf(s._id) > -1} />
                      <ListItemText primary={s.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {selectedSubtopicIds.length > 0 && (
              <Typography variant="caption" sx={{ color: '#475569', mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                Subtopic context is linked. Label sets se duoc ke thua tu subtopic dau tien duoc chon.
              </Typography>
            )}
          </Box>

          {/* Subtopics Info */}
          {selectedSubtopicIds.length > 0 && Object.keys(subtopicData).length > 0 ? (
            <Box sx={{ p: 2, border: '1px solid #334155', borderRadius: 2, mb: 2, bgcolor: '#0f172a' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#94a3b8', mb: 1.5 }}>Subtopics ({selectedSubtopicIds.length})</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {subtopics.filter(s => selectedSubtopicIds.includes(s._id)).map((sub) => {
                  const subInfo = subtopicData[sub._id] || {};
                  return (
                    <Box key={sub._id} sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid #334155', bgcolor: '#1e293b' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6' }} />
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#e2e8f0' }}>{sub.name}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Chip
                          label={`${subInfo.total || 0} assets`}
                          size="small"
                          sx={{ bgcolor: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                      {subInfo.labels && subInfo.labels.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {subInfo.labels.map(ls => (
                            <Chip
                              key={ls._id}
                              label={ls.name}
                              size="small"
                              sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#93c5fd', fontWeight: 600, fontSize: '0.65rem', height: 18 }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : selectedSubtopicIds.length > 0 ? (
            <Box sx={{ p: 2, border: '1px solid #334155', borderRadius: 2, mb: 2, bgcolor: '#0f172a', textAlign: 'center' }}>
              <CircularProgress size={20} />
              <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>Dang tai thong tin kho...</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2, border: '1px dashed #334155', borderRadius: 2, mb: 2, textAlign: 'center', bgcolor: '#0f172a' }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>Chon Topic va Subtopic de xem kho du lieu</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCreateOpen(false)} sx={btnSecondary}>Huy</Button>
          <Button onClick={handleCreate} variant="contained" disabled={creating || !form.name.trim() || selectedSubtopicIds.length === 0} sx={btnPrimary}>
            {creating ? <CircularProgress size={20} color="inherit" /> : 'Tao Dataset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Sua Dataset</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ten Dataset *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} sx={{ mt: 2, mb: 2, ...inputSx }} />
          <FormControl fullWidth sx={{ mb: 2, ...inputSx }}>
            <InputLabel>Loai Dataset</InputLabel>
            <Select value={form.type} label="Loai Dataset" disabled>
              <MenuItem value="image">Image</MenuItem><MenuItem value="text">Text</MenuItem><MenuItem value="audio">Audio</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth multiline rows={2} label="Mo ta" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} sx={{ mb: 2, ...inputSx }} />

          <Box sx={{ p: 2, border: '1px solid #3b82f6', borderRadius: 2, mb: 2, bgcolor: 'rgba(59,130,246,0.05)' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#60a5fa', mb: 1.5 }}>Dataset Context (Taxonomy Structure)</Typography>
            <TextField
              fullWidth
              label="Topic"
              value={editTopicName || 'Khong co topic'}
              disabled
              sx={{ mb: 1.5, ...inputSx }}
            />
            <FormControl fullWidth sx={{ ...inputSx }}>
              <InputLabel>Subtopics</InputLabel>
              <Select
                multiple
                value={selectedSubtopicIds}
                label="Subtopics"
                onChange={e => {
                  const vals = e.target.value;
                  const normalized = Array.isArray(vals) ? vals : [];
                  setSelectedSubtopicIds(normalized);
                  setSelectedSubtopicId(normalized[0] || '');
                }}
                renderValue={(selected) => {
                  const selectedSet = new Set(selected);
                  const names = subtopics.filter(s => selectedSet.has(s._id)).map(s => s.name);
                  return names.length > 0 ? names.join(', ') : 'Khong chon subtopic';
                }}
              >
                {subtopics.map(s => (
                  <MenuItem key={s._id} value={s._id}>
                    <Checkbox checked={selectedSubtopicIds.indexOf(s._id) > -1} />
                    <ListItemText primary={s.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={btnSecondary}>Huy</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={updating || !form.name.trim()} sx={btnPrimary}>
            {updating ? <CircularProgress size={20} color="inherit" /> : 'Luu thay doi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} PaperProps={{ sx: modalSx }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Xoa Dataset</DialogTitle>
        <DialogContent><Typography>Ban co that su muon xoa dataset <strong>"{selectedDs?.name}"</strong>?</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={btnSecondary}>Huy</Button>
          <Button onClick={handleDelete} variant="contained" sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, borderRadius: 2 }}>Xoa</Button>
        </DialogActions>
      </Dialog>

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

export default Datasets;
