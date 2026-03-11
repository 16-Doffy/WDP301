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
  CardActions,
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
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  Dataset as DatasetIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getFullImageUrl = (path, imageUrl, filename) => {
  // Build base URL - remove any trailing slashes
  const baseUrl = API_URL.replace(/\/+$/, '');
  
  // Priority: imageUrl > path > filename
  let relativePath = '';
  if (imageUrl) {
    // imageUrl might already have uploads/ in it
    relativePath = imageUrl.replace(/^\/+/, '');
  } else if (path) {
    if (path.includes('uploads/')) {
      // Path already has uploads/, just clean it
      relativePath = path.replace(/^\/+/, '');
    } else {
      // Just filename, add uploads/datasets/
      relativePath = `uploads/datasets/${path}`;
    }
  } else if (filename) {
    relativePath = `uploads/datasets/${filename}`;
  }
  
  if (relativePath) {
    return `${baseUrl}/${relativePath}`;
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
};

// Color constants
const COLORS = {
  approved: '#22c55e',
  rejected: '#f87171',
  pending: '#f59e0b',
  inReview: '#3b82f6',
  total: '#94a3b8',
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
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');

  // Dataset items dialog state
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsData, setItemsData] = useState({ items: [], totalItems: 0 });
  const [itemFilter, setItemFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailDialogOpen, setItemDetailDialogOpen] = useState(false);
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(0);
  const [showConsensus, setShowConsensus] = useState(true); // Show consensus/result first by default
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

  // Calculate consensus/final labels from all annotations
  const getConsensusLabels = () => {
    if (!selectedItem?.annotations || selectedItem.annotations.length === 0) {
      return { objects: [], votes: {} };
    }
    
    const approvedAnnotations = selectedItem.annotations.filter(a => a.status === 'approved');
    const annotationsToUse = approvedAnnotations.length > 0 ? approvedAnnotations : selectedItem.annotations;
    
    // Count label votes
    const labelVotes = {};
    const allObjects = [];
    
    annotationsToUse.forEach(ann => {
      if (ann.labels?.objects && Array.isArray(ann.labels.objects)) {
        ann.labels.objects.forEach(obj => {
          const label = obj.label;
          labelVotes[label] = (labelVotes[label] || 0) + 1;
          allObjects.push(obj);
        });
      }
    });
    
    // Get consensus objects (majority vote)
    const consensusObjects = [];
    const totalVotes = annotationsToUse.length;
    
    // Group objects by similar label and bbox location
    Object.entries(labelVotes).forEach(([label, voteCount]) => {
      const objectsWithLabel = allObjects.filter(o => o.label === label);
      // Take the first object with highest confidence as representative
      objectsWithLabel.sort((a, b) => (b.confidence || 1) - (a.confidence || 1));
      if (objectsWithLabel.length > 0) {
        consensusObjects.push({
          ...objectsWithLabel[0],
          voteCount,
          totalVotes,
          consensusScore: totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
        });
      }
    });
    
    return { objects: consensusObjects, votes: labelVotes, totalVotes };
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const safeText = (value, fallback = '-') => {
    if (value == null) return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      if (typeof value.name === 'string') return value.name;
      if (typeof value.title === 'string') return value.title;
      if (typeof value.label === 'string') return value.label;
      return fallback;
    }
    return fallback;
  };

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const allDatasets = response.data || [];
      const mapped = allDatasets.map((ds) => ({
        ...ds,
        name: safeText(ds.name, 'Unnamed dataset'),
        description: safeText(ds.description, ''),
        projectName: safeText(ds.projectId?.name || ds.projectId, 'Chưa gán project'),
      }));
      setDatasets(mapped);

      const statusEntries = await Promise.all(
        mapped.map(async (ds) => {
          try {
            const s = await axios.get(`${API_URL}/api/datasets/${ds._id}/status`, {
              headers: { Authorization: `Bearer ${getAuthToken()}` },
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
      setError('Không thể tải danh sách datasets');
    } finally {
      setLoading(false);
    }
  };

  const getAllowedAcceptByType = (type) => {
    if (type === 'image') return 'image/*,.zip,.rar,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed';
    if (type === 'audio') return 'audio/*,.mp3,.wav,.m4a,.ogg,.mp4,.zip,.rar,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed';
    return '.txt,.csv,.json,.xml,text/plain,text/csv,application/json,application/xml,.zip,.rar,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed';
  };

  const isFileCompatibleWithDatasetType = (file, type) => {
    const name = (file?.name || '').toLowerCase();
    const mime = (file?.type || '').toLowerCase();
    const isArchive = name.endsWith('.zip') || name.endsWith('.rar') || mime.includes('zip') || mime.includes('rar');
    if (isArchive) return true;

    if (type === 'image') {
      return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext));
    }
    if (type === 'audio') {
      return mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.mp4'].some((ext) => name.endsWith(ext));
    }
    if (type === 'text') {
      return mime.startsWith('text/') || ['.txt', '.csv', '.json', '.xml'].some((ext) => name.endsWith(ext));
    }
    return false;
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const isArchive = (file) => ['.zip', '.rar'].some((ext) => file.name.toLowerCase().endsWith(ext));
    if (files.some(isArchive) && files.length > 1) {
      alert('Nếu upload file nén (zip/rar), vui lòng chọn đúng 1 file.');
      return;
    }

    const invalidFiles = files.filter((f) => !isFileCompatibleWithDatasetType(f, formData.type));
    if (invalidFiles.length > 0) {
      setError(`Các file sau không phù hợp với dataset type "${formData.type}": ${invalidFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleCreateDataset = async () => {
    if (!formData.name.trim()) return alert('Vui lòng nhập tên dataset');
    if (!uploadedFiles.length) return alert('Vui lòng upload ít nhất một file');

    setUploading(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append('name', formData.name.trim());
      payload.append('type', formData.type);
      if (formData.description) payload.append('description', formData.description.trim());
      uploadedFiles.forEach((f) => payload.append('files', f));

      const createRes = await axios.post(`${API_URL}/api/datasets`, payload, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
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
      setError('Lỗi khi tạo dataset: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;
    try {
      await axios.delete(`${API_URL}/api/datasets/${selectedDataset._id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setDeleteDialogOpen(false);
      setSelectedDataset(null);
      fetchDatasets();
    } catch (err) {
      alert('Lỗi khi xóa dataset: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExportDataset = async (datasetId, format) => {
    setExporting(true);
    try {
      const response = await axios.get(`${API_URL}/api/datasets/${datasetId}/export`, {
        params: { format },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      const contentType = format === 'json' ? 'application/json' : 
                         format === 'csv' ? 'text/csv' : 'application/zip';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dataset_${datasetId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportDialogOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể export dataset');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFinal = async (datasetId) => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets/${datasetId}/final-export`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `final_dataset_${datasetId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể export final dataset');
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('vi-VN');
  };

  const handleOpenItemsDialog = async (datasetId) => {
    setItemsDialogOpen(true);
    setItemFilter('all');
    setItemsLoading(true);
    setItemsData({ items: [], totalItems: 0 });

    try {
      const response = await axios.get(`${API_URL}/api/datasets/${datasetId}/items`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setItemsData(response.data);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleOpenItemDetail = (item) => {
    setSelectedItem(item);
    setSelectedAnnotationIndex(0);
    setImageLoaded(false);
    setImageSize({ width: 0, height: 0 });
    setItemDetailDialogOpen(true);
  };

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setImageSize({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    });
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      approved: { label: 'Approved', color: COLORS.approved, icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
      rejected: { label: 'Rejected', color: COLORS.rejected, icon: <CancelIcon sx={{ fontSize: 14 }} /> },
      pending: { label: 'Pending', color: COLORS.pending, icon: <PendingIcon sx={{ fontSize: 14 }} /> },
      submitted: { label: 'In Review', color: COLORS.inReview, icon: <PendingIcon sx={{ fontSize: 14 }} /> },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Chip 
        size="small" 
        icon={config.icon}
        label={config.label} 
        sx={{ 
          bgcolor: `${config.color}20`, 
          color: config.color, 
          border: `1px solid ${config.color}40`,
          fontWeight: 600,
          fontSize: 11,
        }} 
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <Box sx={panelSx}>
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #334155' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>
                Datasets
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Quản lý và export dataset sẵn sàng cho AI Training
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

        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Grid container spacing={2.5}>
            {datasets
              .filter((ds) => !searchTerm.trim() || ds.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((dataset) => {
                const stat = statusByDataset[dataset._id];
                const rawCount = stat?.totalRawItems || dataset.totalItems || 0;
                const totalTasks = stat?.totalTasks ?? 0;
                const counts = stat?.counts || {};
                const pendingAnnotation = counts.pendingAnnotation ?? 0;
                const submitted = counts.submitted ?? 0;
                const completed = counts.completed ?? 0;
                const approved = counts.approved ?? stat?.totalFinalItems ?? 0;
                const rejected = counts.rejected ?? 0;
                const finalCount = counts.final ?? stat?.totalFinalItems ?? 0;
                
                // Use rawProgress from backend for correct calculation
                const rawProgress = stat?.rawProgress || {};
                const rawCompleted = rawProgress.completed ?? 0;
                const rawApproved = rawProgress.final ?? 0;
                
                const canExport = rawApproved > 0;
                const exportProgress = rawCount > 0 ? Math.round((rawApproved / rawCount) * 100) : 0;

                // Get items from status API if available
                const previewItems = stat?.finalItems?.slice(0, 4).map((item, idx) => ({
                  id: idx + 1,
                  filename: item.dataItem?.filename || item.dataItem?.name || `Item ${idx + 1}`,
                  type: dataset.type,
                  displayLabel: item.labels?.label || item.labels?.objects?.[0]?.label || item.labels?.spans?.[0]?.label || 'N/A',
                  status: 'approved',
                  approvedCount: 1,
                  rejectedCount: 0,
                })) || [];

                // Dataset type breakdown - use actual data
                const typeBreakdown = [
                  { type: 'Image', count: dataset.type === 'image' ? rawCount : 0, icon: '🖼️' },
                  { type: 'Text', count: dataset.type === 'text' ? rawCount : 0, icon: '📝' },
                  { type: 'Audio', count: dataset.type === 'audio' ? rawCount : 0, icon: '🎵' },
                ].filter(t => t.count > 0);

                // If no type matched but we have rawCount, show based on dataset type
                if (typeBreakdown.length === 0 && rawCount > 0) {
                  typeBreakdown.push({ 
                    type: dataset.type?.charAt(0).toUpperCase() + dataset.type?.slice(1) || 'Data', 
                    count: rawCount,
                    icon: dataset.type === 'image' ? '🖼️' : dataset.type === 'text' ? '📝' : dataset.type === 'audio' ? '🎵' : '📁'
                  });
                }

                return (
                  <Grid item xs={12} lg={6} key={dataset._id}>
                    <Card sx={cardSx}>
                      <CardContent>
                        {/* Dataset Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" fontWeight={700}>{dataset.name}</Typography>
                            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 1.5 }}>
                              {dataset.description || 'No description'}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip 
                                size="small" 
                                label={(dataset.type || 'image').toUpperCase()} 
                                sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #334155' }} 
                              />
                              <Chip 
                                size="small" 
                                label={dataset.projectName} 
                                sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid #334155' }} 
                              />
                            </Stack>
                          </Box>
                          <IconButton 
                            size="small" 
                            sx={{ color: '#f87171' }} 
                            onClick={() => { setSelectedDataset(dataset); setDeleteDialogOpen(true); }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* DATASET EXPORT STATUS - Main Focus */}
                        <Box sx={{ 
                          mb: 3, 
                          p: 2.5, 
                          borderRadius: 2, 
                          border: '2px solid',
                          borderColor: canExport ? '#22c55e40' : '#334155',
                          bgcolor: canExport ? 'rgba(34,197,94,0.08)' : '#0f172a',
                        }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DatasetIcon sx={{ color: canExport ? '#22c55e' : '#94a3b8' }} />
                            DATASET EXPORT STATUS
                          </Typography>
                          
                          <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Total Raw Data</Typography>
                              <Typography variant="h5" fontWeight={800} sx={{ color: '#e2e8f0' }}>{rawCount}</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Annotated</Typography>
                              <Typography variant="h5" fontWeight={800} sx={{ color: '#3b82f6' }}>{completed}</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Under Review</Typography>
                              <Typography variant="h5" fontWeight={800} sx={{ color: '#f59e0b' }}>{submitted}</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approved</Typography>
                              <Typography variant="h5" fontWeight={800} sx={{ color: '#22c55e' }}>{approved}</Typography>
                            </Grid>
                          </Grid>

                          {/* Ready for Training Section */}
                          <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: canExport ? 'rgba(34,197,94,0.12)' : '#1e293b' }}>
                            <Typography variant="h6" fontWeight={700} sx={{ color: canExport ? '#22c55e' : '#94a3b8', mb: 1 }}>
                              Ready for AI Training Dataset
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={rawCount > 0 ? Math.min((rawApproved / rawCount) * 100, 100) : 0} 
                                  sx={{ 
                                    height: 12, 
                                    borderRadius: 6, 
                                    bgcolor: '#0f172a', 
                                    '& .MuiLinearProgress-bar': { 
                                      bgcolor: canExport ? '#22c55e' : '#475569',
                                      borderRadius: 6,
                                    } 
                                  }} 
                                />
                              </Box>
                              <Typography variant="h6" fontWeight={800} sx={{ color: canExport ? '#22c55e' : '#64748b', minWidth: 80, textAlign: 'right' }}>
                                {rawApproved} / {rawCount}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                              {rawCount > 0 ? Math.round((rawApproved / rawCount) * 100) : 0}% of raw data approved and ready for export
                            </Typography>
                          </Box>
                        </Box>

                        {/* Dataset Items by Type */}
                        <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0', mb: 1.5 }}>
                            Dataset Items (by Type)
                          </Typography>
                          <Grid container spacing={2}>
                            {typeBreakdown.map((item) => (
                              <Grid item xs={4} key={item.type}>
                                <Box sx={{ 
                                  p: 1.5, 
                                  borderRadius: 1.5, 
                                  bgcolor: '#1e293b', 
                                  border: '1px solid #334155',
                                  textAlign: 'center'
                                }}>
                                  <Typography variant="h5" sx={{ mb: 0.5 }}>{item.icon}</Typography>
                                  <Typography variant="body2" fontWeight={600} sx={{ color: '#e2e8f0' }}>{item.type}</Typography>
                                  <Typography variant="h6" fontWeight={800} sx={{ color: '#60a5fa' }}>{item.count}</Typography>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>

                        {/* Dataset Items Table - Clickable */}
                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0' }}>
                              DATASET ITEMS
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenItemsDialog(dataset._id)}
                              sx={{
                                textTransform: 'none',
                                borderColor: '#3b82f6',
                                color: '#3b82f6',
                                fontSize: 12,
                              }}
                            >
                              View All Items
                            </Button>
                          </Box>
                          <TableContainer sx={{ bgcolor: '#0f172a', borderRadius: 2, border: '1px solid #334155' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#1e293b' }}>
                                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>ID</TableCell>
                                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>Filename</TableCell>
                                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>Label</TableCell>
                                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>Status</TableCell>
                                  <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', textAlign: 'center' }}>Export</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {/* Show preview items from API */}
                                {previewItems.length > 0 ? previewItems.map((item, idx) => {
                                  // Get corresponding task from stat to get path
                                  const taskItem = stat?.finalItems?.[idx];
                                  return (
                                  <TableRow 
                                    key={item.id || idx} 
                                    sx={{ 
                                      '&:hover': { bgcolor: '#1e293b' },
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => handleOpenItemDetail({ 
                                      ...item, 
                                      path: taskItem?.dataItem?.path || '',
                                      annotations: item.annotations || []
                                    })}
                                  >
                                    <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid #334155' }}>{item.id || idx + 1}</TableCell>
                                    <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>{item.type}</TableCell>
                                    <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid #334155' }}>{item.displayLabel}</TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid #334155' }}>{getStatusChip(item.status)}</TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid #334155', textAlign: 'center' }}>
                                      <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                                    </TableCell>
                                  </TableRow>
                                  );
                                }) : (
                                  <TableRow>
                                    <TableCell colSpan={5} sx={{ color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'center', py: 2 }}>
                                      No annotated items yet. Click "View All Items" to see all.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>

                        {/* Progress Bars - Simplified */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Annotation Progress</Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={rawCount > 0 ? Math.min((rawCompleted / rawCount) * 100, 100) : 0} 
                              sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' } }} 
                            />
                            <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                              {rawCompleted} / {rawCount} items
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approved for Export</Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={rawCount > 0 ? Math.min((rawApproved / rawCount) * 100, 100) : 0} 
                              sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} 
                            />
                            <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>
                              {rawApproved} / {rawCount} items
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>

                      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Button
                          size="small"
                          disabled={!dataset.projectId}
                          onClick={() => {
                            const projectId = dataset.projectId?._id || dataset.projectId;
                            if (projectId) navigate(`/manager/projects/${projectId}`);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, color: '#60a5fa' }}
                        >
                          {dataset.projectId ? 'View Project' : 'No Project'}
                        </Button>
                        
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => { setSelectedDataset(dataset); setExportDialogOpen(true); }}
                            disabled={!canExport}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: canExport ? '#3b82f6' : '#475569',
                              color: canExport ? '#3b82f6' : '#64748b',
                            }}
                          >
                            Export
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleExportFinal(dataset._id)}
                            disabled={!canExport}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              bgcolor: canExport ? '#22c55e' : '#475569',
                              color: canExport ? '#fff' : '#94a3b8',
                              '&:hover': canExport ? { bgcolor: '#16a34a' } : {},
                            }}
                          >
                            Export Approved Dataset
                          </Button>
                        </Stack>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
          </Grid>
        </Box>
      </Box>

      {/* Export Format Dialog */}
      <Dialog 
        open={exportDialogOpen} 
        onClose={() => setExportDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon sx={{ color: '#3b82f6' }} />
          Export Dataset
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
            Chọn định dạng export. Chỉ các task đã được Approved mới được export.
          </Typography>
          
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0', mb: 1.5 }}>
            Select Format:
          </Typography>
          
          <RadioGroup
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
          >
            {[
              { value: 'json', label: 'JSON', desc: 'Standard JSON format with all metadata' },
              { value: 'csv', label: 'CSV', desc: 'Comma-separated values for Excel/spreadsheets' },
              { value: 'coco', label: 'COCO (Image Detection)', desc: 'COCO format for object detection' },
              { value: 'yolo', label: 'YOLO', desc: 'YOLO format for object detection' },
            ].map((format) => (
              <Box 
                key={format.value}
                sx={{ 
                  p: 2, 
                  mb: 1, 
                  borderRadius: 2, 
                  border: '1px solid',
                  borderColor: exportFormat === format.value ? '#3b82f6' : '#334155',
                  bgcolor: exportFormat === format.value ? 'rgba(59,130,246,0.1)' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#3b82f6' }
                }}
                onClick={() => setExportFormat(format.value)}
              >
                <FormControlLabel
                  value={format.value}
                  control={<Radio sx={{ color: '#64748b', '&.Mui-checked': { color: '#3b82f6' } }} />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={600} sx={{ color: '#e2e8f0' }}>
                        {format.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        {format.desc}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              </Box>
            ))}
          </RadioGroup>

          <Alert severity="info" sx={{ mt: 2, bgcolor: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid #3b82f640' }}>
            Export sẽ chỉ bao gồm các task có status = "Approved"
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setExportDialogOpen(false)} 
            sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => selectedDataset && handleExportDataset(selectedDataset._id, exportFormat)}
            variant="contained"
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
            sx={{ 
              borderRadius: 2, 
              px: 3, 
              textTransform: 'none', 
              fontWeight: 700, 
              bgcolor: '#3b82f6', 
              '&:hover': { bgcolor: '#2563eb' } 
            }}
          >
            {exporting ? 'Exporting...' : 'Export Dataset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dataset Items Dialog */}
      <Dialog 
        open={itemsDialogOpen} 
        onClose={() => setItemsDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DatasetIcon sx={{ color: '#3b82f6' }} />
          Dataset Items
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {/* Filter buttons */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All', count: itemsData.totalItems },
              { id: 'approved', label: 'Approved', count: itemsData.items?.filter(i => i.status === 'approved').length || 0 },
              { id: 'in_review', label: 'In Review', count: itemsData.items?.filter(i => i.status === 'in_review').length || 0 },
              { id: 'pending', label: 'Pending', count: itemsData.items?.filter(i => i.status === 'pending').length || 0 },
              { id: 'rejected', label: 'Rejected', count: itemsData.items?.filter(i => i.status === 'rejected').length || 0 },
            ].map((f) => (
              <Button
                key={f.id}
                size="small"
                variant={itemFilter === f.id ? 'contained' : 'outlined'}
                onClick={() => setItemFilter(f.id)}
                sx={{ 
                  textTransform: 'none', 
                  borderRadius: 2,
                  bgcolor: itemFilter === f.id ? '#3b82f6' : 'transparent',
                  borderColor: '#475569',
                  color: itemFilter === f.id ? '#fff' : '#94a3b8',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    bgcolor: itemFilter === f.id ? '#2563eb' : 'rgba(59,130,246,0.1)',
                  }
                }}
              >
                {f.label} ({f.count})
              </Button>
            ))}
          </Stack>

          {itemsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!itemsLoading && itemsData.items && (
            <TableContainer sx={{ bgcolor: '#0f172a', borderRadius: 2, border: '1px solid #334155', maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1e293b' }}>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b' }}>ID</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b' }}>Filename</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b' }}>Label</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b' }}>Votes</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b' }}>Status</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155', position: 'sticky', top: 0, bgcolor: '#1e293b', textAlign: 'center' }}>Export</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemsData.items
                    .filter(item => itemFilter === 'all' || item.status === itemFilter)
                    .slice(0, 50)
                    .map((item) => (
                      <TableRow 
                        key={item.id} 
                        sx={{ 
                          '&:hover': { bgcolor: '#1e293b' },
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenItemDetail(item)}
                      >
                        <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid #334155' }}>{item.id}</TableCell>
                        <TableCell sx={{ color: '#94a3b8', borderBottom: '1px solid #334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.filename || item.originalName || 'Unknown'}
                        </TableCell>
                        <TableCell sx={{ color: '#e2e8f0', borderBottom: '1px solid #334155' }}>{item.displayLabel || 'Chưa có nhãn'}</TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #334155' }}>
                          <Typography variant="caption" sx={{ color: '#22c55e' }}>{item.approvedCount || 0}</Typography>
                          {' / '}
                          <Typography variant="caption" sx={{ color: '#f87171' }}>{item.rejectedCount || 0}</Typography>
                        </TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #334155' }}>{getStatusChip(item.status)}</TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #334155', textAlign: 'center' }}>
                          {item.status === 'approved' ? (
                            <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                          ) : (
                            <CancelIcon sx={{ color: '#475569', fontSize: 18 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!itemsLoading && itemsData.items && itemsData.items.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                No items found for this filter.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setItemsDialogOpen(false)} 
            sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Item Detail Dialog */}
      <Dialog 
        open={itemDetailDialogOpen} 
        onClose={() => setItemDetailDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Item Detail - {selectedItem?.filename || `Item #${selectedItem?.id}`}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {selectedItem && (
            <Box>
              {/* Image Preview Section */}
              {selectedItem.type === 'image' && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0', mb: 1.5 }}>
                    Image Preview
                  </Typography>
                  <Box sx={{ 
                    position: 'relative', 
                    bgcolor: '#0f172a', 
                    borderRadius: 2, 
                    border: '1px solid #334155',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 300,
                    maxHeight: 400,
                  }}>
                    {!imageLoaded && (
                      <CircularProgress sx={{ position: 'absolute' }} />
                    )}
                    {(selectedItem.path || selectedItem.imageUrl || selectedItem.filename) && (
                      <Box sx={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={getFullImageUrl(selectedItem.path, selectedItem.imageUrl, selectedItem.filename)}
                          alt={selectedItem.filename}
                          onLoad={handleImageLoad}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                          }}
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: 400, 
                            display: imageLoaded ? 'block' : 'none',
                            objectFit: 'contain'
                          }}
                        />
                        {/* Draw bounding boxes - show consensus or individual annotation */}
                        {imageLoaded && selectedItem.annotations && selectedItem.annotations.length > 0 && ((showConsensus && getConsensusLabels().objects.length > 0) || (!showConsensus && selectedItem.annotations[selectedAnnotationIndex]?.labels?.objects?.length > 0)) && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                          }}>
                            {(() => {
                              // Get the objects to display based on current tab
                              let objectsToDisplay = [];
                              if (showConsensus) {
                                const consensus = getConsensusLabels();
                                objectsToDisplay = consensus.objects;
                              } else {
                                const ann = selectedItem.annotations[selectedAnnotationIndex];
                                objectsToDisplay = ann?.labels?.objects || [];
                              }
                              
                              return objectsToDisplay.map((obj, idx) => {
                                // bbox format in ImageAnnotator: [x1, y1, x2, y2] - coordinates as percentage
                                const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
                                const left = Math.min(x1, x2);
                                const top = Math.min(y1, y2);
                                const width = Math.max(Math.abs(x2 - x1), 1);
                                const height = Math.max(Math.abs(y2 - y1), 1);
                                
                                return (
                                  <Box
                                    key={idx}
                                    sx={{
                                      position: 'absolute',
                                      left: `${left}%`,
                                      top: `${top}%`,
                                      width: `${width}%`,
                                      height: `${height}%`,
                                      border: '2px solid',
                                      borderColor: showConsensus ? '#8b5cf6' : '#22c55e',
                                      bgcolor: showConsensus ? 'rgba(139, 92, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      justifyContent: 'flex-start',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        bgcolor: showConsensus ? '#8b5cf6' : '#22c55e',
                                        color: '#fff',
                                        px: 0.75,
                                        py: 0.25,
                                        borderRadius: '0 0 4px 0',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {obj.label}
                                      {showConsensus && obj.consensusScore !== undefined && (
                                        <span style={{ opacity: 0.8, fontSize: 10, marginLeft: 4 }}>
                                          {Math.round(obj.consensusScore)}%
                                        </span>
                                      )}
                                      {!showConsensus && obj.confidence !== undefined && (
                                        <span style={{ opacity: 0.8, fontSize: 10, marginLeft: 4 }}>
                                          {(obj.confidence * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </Typography>
                                  </Box>
                                );
                              });
                            })()}
                          </Box>
                        )}
                      </Box>
                    )}
                    {!(selectedItem.path || selectedItem.imageUrl || selectedItem.filename) && (
                      <Typography sx={{ color: '#94a3b8' }}>No image path available</Typography>
                    )}
                  </Box>
                  
                  {/* Annotation selector with Consensus tab */}
                  {selectedItem.annotations && selectedItem.annotations.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        {/* Consensus/Final Result Tab - Always first */}
                        <Chip
                          label="Final Result"
                          size="small"
                          onClick={() => setShowConsensus(true)}
                          variant={showConsensus ? 'filled' : 'outlined'}
                          icon={selectedItem.status === 'approved' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : null}
                          sx={{
                            bgcolor: showConsensus ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                            color: showConsensus ? '#a78bfa' : '#94a3b8',
                            border: '1px solid',
                            borderColor: showConsensus ? '#8b5cf6' : '#475569',
                            cursor: 'pointer',
                            fontWeight: 700,
                            '&:hover': {
                              bgcolor: 'rgba(139, 92, 246, 0.15)',
                            }
                          }}
                        />
                        
                        <Typography variant="caption" sx={{ color: '#64748b', alignSelf: 'center', mx: 0.5 }}>
                          |
                        </Typography>
                        
                        {/* Individual Annotator Tabs */}
                        {selectedItem.annotations.map((ann, idx) => (
                          <Chip
                            key={idx}
                            label={ann.annotator}
                            size="small"
                            onClick={() => {
                              setSelectedAnnotationIndex(idx);
                              setShowConsensus(false);
                            }}
                            variant={!showConsensus && selectedAnnotationIndex === idx ? 'filled' : 'outlined'}
                            icon={ann.status === 'approved' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : ann.status === 'rejected' ? <CancelIcon sx={{ fontSize: 16 }} /> : null}
                            sx={{
                              bgcolor: !showConsensus && selectedAnnotationIndex === idx 
                                ? (ann.status === 'approved' ? 'rgba(34, 197, 94, 0.2)' : ann.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)')
                                : 'transparent',
                              color: !showConsensus && selectedAnnotationIndex === idx 
                                ? (ann.status === 'approved' ? '#22c55e' : ann.status === 'rejected' ? '#ef4444' : '#60a5fa')
                                : '#94a3b8',
                              border: '1px solid',
                              borderColor: !showConsensus && selectedAnnotationIndex === idx 
                                ? (ann.status === 'approved' ? '#22c55e' : ann.status === 'rejected' ? '#ef4444' : '#3b82f6')
                                : '#475569',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: ann.status === 'approved' ? 'rgba(34, 197, 94, 0.1)' : ann.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              }
                            }}
                          />
                        ))}
                      </Stack>
                      
                      {/* Consensus/Votes Info */}
                      {showConsensus && (
                        <Box sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: 1, p: 1.5, border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                          <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700, display: 'block', mb: 1 }}>
                            Consensus / Final Labels
                          </Typography>
                          {(() => {
                            const consensus = getConsensusLabels();
                            if (consensus.objects.length === 0) {
                              return <Typography variant="caption" sx={{ color: '#94a3b8' }}>No annotations yet</Typography>;
                            }
                            return (
                              <>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                                  {consensus.objects.length} object(s) detected • {consensus.totalVotes} vote(s)
                                </Typography>
                                {consensus.objects.map((obj, idx) => (
                                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />
                                    <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                                      {obj.label}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                      {obj.voteCount}/{consensus.totalVotes} votes
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>
                                      ({Math.round(obj.consensusScore)}%)
                                    </Typography>
                                  </Box>
                                ))}
                              </>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Info Grid */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>ID</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-all', fontSize: 11 }}>{selectedItem.id}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Status</Typography>
                  <Box sx={{ mt: 0.5 }}>{getStatusChip(selectedItem.status)}</Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approved Votes</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#22c55e' }}>{selectedItem.approvedCount || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Rejected Votes</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#f87171' }}>{selectedItem.rejectedCount || 0}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setItemDetailDialogOpen(false)} 
            sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Dataset Dialog */}
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
            onChange={(e) => {
              const nextType = e.target.value;
              const stillValid = uploadedFiles.filter((f) => isFileCompatibleWithDatasetType(f, nextType));
              if (stillValid.length !== uploadedFiles.length) {
                setUploadedFiles(stillValid);
              }
              setFormData({ ...formData, type: nextType });
            }}
            margin="normal"
          >
            <option value="image">Image</option>
            <option value="text">Text</option>
            <option value="audio">Audio</option>
          </TextField>
          <TextField fullWidth multiline rows={3} label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} margin="normal" />

          <Box sx={{ border: '2px dashed #475569', borderRadius: 2, p: 4, textAlign: 'center', mt: 2, cursor: 'pointer', bgcolor: '#0f172a', '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(30,41,59,0.7)' } }} onClick={() => document.getElementById('file-upload-dataset').click()}>
            <CloudUploadIcon sx={{ fontSize: 44, color: '#60a5fa', mb: 1 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>Upload files / zip / rar</Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>ZIP được auto extract. RAR được nhận diện (nên đổi sang ZIP để hệ thống xử lý tự động).</Typography>
            <input id="file-upload-dataset" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} accept={getAllowedAcceptByType(formData.type)} />
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
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}>Hủy</Button>
          <Button onClick={handleCreateDataset} variant="contained" disabled={uploading || !formData.name.trim() || uploadedFiles.length === 0} sx={{ borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' } }}>
            {uploading ? <CircularProgress size={20} color="inherit" /> : 'Tạo Dataset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa dataset <strong>"{selectedDataset?.name}"</strong>?
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
