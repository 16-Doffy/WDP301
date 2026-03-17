import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  CircularProgress,
  Stack,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Dataset as DatasetIcon,
  Visibility as VisibilityIcon,
  Image as ImageIcon,
  AudioFile as AudioIcon,
  Description as TextIcon,
  Summarize as StatsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getFullImageUrl = (path, imageUrl, filename) => {
  const baseUrl = API_URL.replace(/\/+$/, '');
  let relativePath = '';
  if (imageUrl) {
    relativePath = imageUrl.replace(/^\/+/, '');
  } else if (path) {
    let cleanPath = path.replace(/^\/+/, '');
    if (filename && cleanPath.endsWith(filename)) {
      relativePath = cleanPath;
    } else if (cleanPath.startsWith('uploads/datasets/')) {
      relativePath = cleanPath;
    } else if (cleanPath.startsWith('uploads/')) {
      relativePath = cleanPath;
    } else if (cleanPath) {
      relativePath = filename ? cleanPath + '/' + filename : 'uploads/datasets/' + cleanPath;
    }
  } else if (filename) {
    relativePath = 'uploads/datasets/' + filename;
  }
  if (relativePath) {
    return baseUrl + '/' + relativePath;
  }
  return '';
};

const panelSx = {
  borderRadius: 3,
  boxShadow: '0 16px 32px rgba(0,0,0,0.35)',
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#e2e8f0',
};

const cardSx = {
  borderRadius: 3,
  boxShadow: '0 12px 24px rgba(0,0,0,0.28)',
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#e2e8f0',
  transition: 'all 0.2s',
  '&:hover': {
    borderColor: '#3b82f6',
    transform: 'translateY(-2px)',
  },
};

const Datasets = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', type: 'image' });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusByDataset, setStatusByDataset] = useState({});

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDataset, setDetailDataset] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detailItems, setDetailItems] = useState([]);
  const [detailItemsLoading, setDetailItemsLoading] = useState(false);

  const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

  const getDatasetStatus = (stat) => {
    if (!stat) return { status: 'not_started', label: 'Not Started', color: '#64748b', icon: <PendingIcon /> };
    const { totalRawItems = 0, counts = {} } = stat;
    const approved = counts.approved || 0;
    const submitted = counts.submitted || 0;
    const pendingAnnotation = counts.pendingAnnotation || 0;

    if (totalRawItems === 0 || approved === 0) {
      if (pendingAnnotation > 0 || submitted > 0) {
        return { status: 'annotating', label: 'Annotating', color: '#3b82f6', icon: <PendingIcon /> };
      }
      return { status: 'not_started', label: 'Not Started', color: '#64748b', icon: <PendingIcon /> };
    }

    const progress = (approved / totalRawItems) * 100;
    if (progress >= 100) {
      return { status: 'ready', label: 'Ready for AI Training', color: '#22c55e', icon: <CheckCircleIcon /> };
    }
    if (submitted > 0) {
      return { status: 'under_review', label: 'Under Review', color: '#f59e0b', icon: <PendingIcon /> };
    }
    return { status: 'annotating', label: 'Annotating', color: '#3b82f6', icon: <PendingIcon /> };
  };

  const normalizeLabelSet = (labelSet) => {
    if (!Array.isArray(labelSet)) return [];
    return labelSet.map((label) => {
      if (typeof label === 'string') return { name: label };
      if (label && typeof label === 'object') return { name: label.name || label.label || 'Unknown', color: label.color };
      return { name: 'Unknown' };
    });
  };

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(API_URL + '/api/datasets', {
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      const allDatasets = response.data || [];
      setDatasets(allDatasets);

      const statusEntries = await Promise.all(
        allDatasets.map(async (ds) => {
          try {
            const s = await axios.get(API_URL + '/api/datasets/' + ds._id + '/status', {
              headers: { Authorization: 'Bearer ' + getAuthToken() },
            });
            return [ds._id, s.data];
          } catch {
            return [ds._id, null];
          }
        })
      );
      setStatusByDataset(Object.fromEntries(statusEntries));
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError('Khong tai duoc danh sach datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleCreateDataset = async () => {
    if (!formData.name.trim()) return alert('Vui long nhap ten dataset');
    if (!uploadedFiles.length) return alert('Vui long upload it nhat mot file');

    setUploading(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append('name', formData.name.trim());
      payload.append('type', formData.type);
      if (formData.description) payload.append('description', formData.description.trim());
      uploadedFiles.forEach((f) => payload.append('files', f));

      const createRes = await axios.post(API_URL + '/api/datasets', payload, {
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });

      const createdDataset = createRes.data;
      setFormData({ name: '', description: '', type: 'image' });
      setUploadedFiles([]);
      setCreateDialogOpen(false);
      await fetchDatasets();

      if (createdDataset?._id) {
        navigate('/manager/projects/create', {
          state: {
            refreshDatasets: true,
            datasetName: createdDataset.name,
            datasetType: createdDataset.type,
            preselectedDatasetIds: [createdDataset._id],
          },
        });
      }
    } catch (err) {
      setError('Loi khi tao dataset: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;
    try {
      await axios.delete(API_URL + '/api/datasets/' + selectedDataset._id, {
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      setDeleteDialogOpen(false);
      setSelectedDataset(null);
      fetchDatasets();
    } catch (err) {
      alert('Loi khi xoa dataset: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExportFinal = async (datasetId) => {
    try {
      const response = await axios.get(API_URL + '/api/datasets/' + datasetId + '/final-export', {
        responseType: 'blob',
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });

      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'final_dataset_' + datasetId + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(err.response?.data?.message || 'Khong the export final dataset');
    }
  };

  const handleOpenDetail = async (dataset) => {
    setDetailDataset(dataset);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    setDetailItemsLoading(true);
    setDetailTab(0);

    try {
      const [statusRes, itemsRes] = await Promise.all([
        axios.get(API_URL + '/api/datasets/' + dataset._id + '/status', {
          headers: { Authorization: 'Bearer ' + getAuthToken() },
        }),
        axios.get(API_URL + '/api/datasets/' + dataset._id + '/items', {
          headers: { Authorization: 'Bearer ' + getAuthToken() },
        }),
      ]);
      setDetailDataset(prev => ({ ...prev, statusData: statusRes.data }));
      setDetailItems(itemsRes.data?.items || []);
    } catch (err) {
      console.error('Error fetching dataset status/items:', err);
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
      setDetailItemsLoading(false);
    }
  };

  const filteredDatasets = datasets.filter(ds => {
    return !searchTerm.trim() || ds.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalItems = Object.values(statusByDataset).reduce((sum, s) => sum + (s?.totalRawItems || 0), 0);
  const totalAnnotated = Object.values(statusByDataset).reduce((sum, s) => sum + (s?.counts?.approved || 0), 0);
  const readyCount = Object.values(statusByDataset).filter(s => getDatasetStatus(s).status === 'ready').length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', background: '#0f172a' }}>
      <Box sx={panelSx}>
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #334155' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>
                Datasets
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Quan ly datasets cho AI Training
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                placeholder="Search datasets..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: '#0f172a',
                    color: '#e2e8f0',
                    '& fieldset': { borderColor: '#475569' },
                    '&:hover fieldset': { borderColor: '#64748b' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  },
                }}
                InputProps={{ startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1 }} fontSize="small" /> }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 2.5,
                  fontWeight: 700,
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#3b82f6' }
                }}
              >
                Create Dataset
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box sx={{ p: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Datasets', value: datasets.length, color: '#60a5fa' },
            { label: 'Total Items', value: totalItems, color: '#e2e8f0' },
            { label: 'Annotated', value: totalAnnotated, color: '#22c55e' },
            { label: 'Ready for AI', value: readyCount, color: '#a78bfa' },
          ].map((stat) => (
            <Box key={stat.label} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: stat.color }}>{stat.value}</Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>{stat.label}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Grid container spacing={2.5}>
            {filteredDatasets.map((dataset) => {
              const stat = statusByDataset[dataset._id];
              const rawCount = stat?.totalRawItems || dataset.totalItems || 0;
              const approved = stat?.counts?.approved || 0;
              const progress = rawCount > 0 ? Math.round((approved / rawCount) * 100) : 0;
              const statusInfo = getDatasetStatus(stat);

              const getTypeIcon = () => {
                if (dataset.type === 'audio') return <AudioIcon sx={{ fontSize: 20, color: '#60a5fa' }} />;
                if (dataset.type === 'text') return <TextIcon sx={{ fontSize: 20, color: '#34d399' }} />;
                return <ImageIcon sx={{ fontSize: 20, color: '#f59e0b' }} />;
              };

              return (
                <Grid item xs={12} sm={6} lg={4} key={dataset._id}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {getTypeIcon()}
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>
                            {dataset.name}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          sx={{ color: '#f87171' }}
                          onClick={() => { setSelectedDataset(dataset); setDeleteDialogOpen(true); }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Chip
                          size="small"
                          label={(dataset.type || 'image').toUpperCase()}
                          sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #334155' }}
                        />
                        <Chip
                          size="small"
                          label={rawCount + ' items'}
                          sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid #334155' }}
                        />
                      </Stack>

                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>Progress</Typography>
                          <Typography variant="caption" sx={{ color: '#60a5fa', fontWeight: 600 }}>{progress}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: '#0f172a',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: statusInfo.color,
                              borderRadius: 4,
                            }
                          }}
                        />
                      </Box>

                      <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: statusInfo.color }}>{statusInfo.icon}</Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleOpenDetail(dataset)}
                          sx={{
                            flex: 1,
                            textTransform: 'none',
                            fontWeight: 700,
                            borderColor: '#3b82f6',
                            color: '#3b82f6',
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleExportFinal(dataset._id)}
                          disabled={statusInfo.status !== 'ready'}
                          sx={{
                            flex: 1,
                            textTransform: 'none',
                            fontWeight: 700,
                            bgcolor: statusInfo.status === 'ready' ? '#22c55e' : '#475569',
                            color: '#fff',
                            '&:hover': statusInfo.status === 'ready' ? { bgcolor: '#16a34a' } : {},
                          }}
                        >
                          Export
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {filteredDatasets.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <DatasetIcon sx={{ fontSize: 64, color: '#475569', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#94a3b8' }}>No datasets found</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DatasetIcon sx={{ color: '#3b82f6' }} />
          {detailDataset?.name} - Detail
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Tabs
                value={detailTab}
                onChange={(_, v) => setDetailTab(v)}
                sx={{
                  mb: 3,
                  '& .MuiTab-root': { color: '#94a3b8' },
                  '& .Mui-selected': { color: '#60a5fa' },
                  '& .MuiTabs-indicator': { bgcolor: '#60a5fa' },
                }}
              >
                <Tab label="Overview" icon={<StatsIcon />} iconPosition="start" />
                <Tab label="Items" icon={<DatasetIcon />} iconPosition="start" />
              </Tabs>

              {detailTab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: '#e2e8f0' }}>
                        Statistics
                      </Typography>
                      {detailDataset?.statusData && (
                        <Stack spacing={1.5}>
                          {[
                            { label: 'Total Items', value: detailDataset.statusData.totalRawItems },
                            { label: 'Annotated', value: detailDataset.statusData.counts?.completed || 0 },
                            { label: 'Under Review', value: detailDataset.statusData.counts?.submitted || 0 },
                            { label: 'Approved', value: detailDataset.statusData.counts?.approved || 0 },
                            { label: 'Rejected', value: detailDataset.statusData.counts?.rejected || 0 },
                          ].map(item => (
                            <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ color: '#94a3b8' }}>{item.label}</Typography>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#e2e8f0' }}>{item.value}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: '#e2e8f0' }}>
                        Label Distribution
                      </Typography>
                      {detailDataset?.statusData?.finalItems && detailDataset.statusData.finalItems.length > 0 ? (
                        <Box>
                          {(() => {
                            const labelCounts = {};
                            detailDataset.statusData.finalItems.forEach(item => {
                              if (item.labels?.objects) {
                                item.labels.objects.forEach(obj => {
                                  labelCounts[obj.label] = (labelCounts[obj.label] || 0) + 1;
                                });
                              } else if (item.labels?.label) {
                                labelCounts[item.labels.label] = (labelCounts[item.labels.label] || 0) + 1;
                              }
                            });
                            return Object.entries(labelCounts).map(([label, count]) => (
                              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Chip label={label} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#60a5fa' }} />
                                <Typography variant="body2" fontWeight={600}>{count}</Typography>
                              </Box>
                            ));
                          })()}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>No labels yet</Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              )}

              {detailTab === 1 && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                    Showing items (one image per item)
                  </Typography>
                  {detailItemsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {detailItems.map((item, idx) => {
                        const imageSrc = getFullImageUrl(item.path, item.imageUrl, item.filename);
                        const labelSet = normalizeLabelSet(item.labelSet || detailDataset?.projectId?.labelSet || []);
                        const annotationsRaw = (item.annotations || []).filter(a => a.status === 'approved');
                        const primaryAnnotations = annotationsRaw.filter(a => a.primaryForItem);
                        const annotations = primaryAnnotations.length > 0 ? primaryAnnotations : annotationsRaw;
                        const annotatorNames = annotations.map(a => a.annotator).filter(Boolean);
                        const uniqueAnnotatorNames = Array.from(new Set(annotatorNames));

                        return (
                          <Grid item xs={6} sm={4} md={3} key={item.id || idx} sx={{ display: 'flex' }}>
                            <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                              <Box
                                onClick={() => navigate(`/manager/datasets/${detailDataset?._id}/items/${item.id || idx}`, {
                                  state: {
                                    item,
                                    datasetName: detailDataset?.name,
                                    labelSet: labelSet,
                                  },
                                })}
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  paddingTop: '100%',
                                  overflow: 'hidden',
                                  borderRadius: 2,
                                  border: '2px solid #22c55e',
                                  bgcolor: '#0f172a',
                                  cursor: 'pointer',
                                }}
                              >
                                {imageSrc ? (
                                  <Box
                                    component="img"
                                    src={imageSrc}
                                    alt={item.filename || 'Item image'}
                                    sx={{
                                      position: 'absolute',
                                      inset: 0,
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#64748b',
                                      fontSize: 12,
                                    }}
                                  >
                                    No image
                                  </Box>
                                )}
                              </Box>
                            </Box>
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDetailDialogOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Dataset</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Dataset Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} margin="normal" />
          <TextField
            fullWidth
            select
            SelectProps={{ native: true }}
            label="Dataset Type *"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            margin="normal"
          >
            <option value="image">Image</option>
            <option value="text">Text</option>
            <option value="audio">Audio</option>
          </TextField>
          <TextField fullWidth multiline rows={3} label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} margin="normal" />

          <Box sx={{ border: '2px dashed #475569', borderRadius: 2, p: 4, textAlign: 'center', mt: 2, cursor: 'pointer', bgcolor: '#0f172a', '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(30,41,59,0.7)' } }} onClick={() => document.getElementById('file-upload-dataset').click()}>
            <CloudUploadIcon sx={{ fontSize: 44, color: '#60a5fa', mb: 1 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>Upload files / zip</Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>ZIP files will be auto-extracted</Typography>
            <input id="file-upload-dataset" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} accept="image/*,.zip,.rar" />
          </Box>

          {uploadedFiles.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Uploaded Files ({uploadedFiles.length})</Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #334155', borderRadius: 2, p: 1, bgcolor: '#0f172a' }}>
                {uploadedFiles.map((file, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: index < uploadedFiles.length - 1 ? '1px solid #334155' : 'none' }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 280, color: '#cbd5e1' }}>{file.name}</Typography>
                    <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => handleRemoveFile(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}>Huy</Button>
          <Button onClick={handleCreateDataset} variant="contained" disabled={uploading || !formData.name.trim() || uploadedFiles.length === 0} sx={{ borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' } }}>
            {uploading ? <CircularProgress size={20} color="inherit" /> : 'Tao Dataset'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Ban co chan muon xoa dataset <strong>"{selectedDataset?.name}"</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}>Cancel</Button>
          <Button onClick={handleDeleteDataset} variant="contained" sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Datasets;
