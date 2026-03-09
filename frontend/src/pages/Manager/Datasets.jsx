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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

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
  const [annotatorDetailDialogOpen, setAnnotatorDetailDialogOpen] = useState(false);
  const [annotatorDetailLoading, setAnnotatorDetailLoading] = useState(false);
  const [annotatorDetailError, setAnnotatorDetailError] = useState('');
  const [annotatorDetail, setAnnotatorDetail] = useState(null);
  const [annotatorTaskFilter, setAnnotatorTaskFilter] = useState('all');

  const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

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

  const handleOpenAnnotatorDetail = async (datasetId, annotatorId, annotatorName) => {
    setAnnotatorDetailDialogOpen(true);
    setAnnotatorTaskFilter('all');
    setAnnotatorDetailLoading(true);
    setAnnotatorDetailError('');
    setAnnotatorDetail(null);

    try {
      const response = await axios.get(`${API_URL}/api/datasets/${datasetId}/annotators/${annotatorId}/tasks`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      setAnnotatorDetail({ ...response.data, annotatorName });
    } catch (err) {
      setAnnotatorDetailError(err.response?.data?.message || err.message || 'Không thể tải chi tiết annotator');
    } finally {
      setAnnotatorDetailLoading(false);
    }
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
      <Box sx={panelSx}>
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #334155' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 0.5 }}>Datasets</Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Raw Dataset gồm nhiều item. Item được majority reviewer duyệt sẽ vào Final Dataset và có thể export.
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} sx={{ borderRadius: 2, textTransform: 'none', px: 2.5, fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' } }}>
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
                const returnedToAnnotator = counts.returnedToAnnotator ?? 0;
                const completed = counts.completed ?? 0;
                const approved = counts.approved ?? stat?.totalFinalItems ?? 0;
                const rejected = counts.rejected ?? 0;
                const finalCount = counts.final ?? stat?.totalFinalItems ?? 0;

                const taskLifecycleProgress = stat?.lifecycleRate ?? 0;
                const taskFinalProgress = stat?.finalRate ?? stat?.completionRate ?? 0;
                const rawLifecycleProgress = stat?.rawProgress?.lifecycleRate ?? 0;
                const rawFinalProgress = stat?.rawProgress?.finalRate ?? 0;
                const rawCompletedCount = stat?.rawProgress?.completed ?? 0;
                const rawFinalCount = stat?.rawProgress?.final ?? 0;

                const canExport = finalCount > 0;
                const isReviewCompleted = pendingAnnotation === 0 && submitted === 0 && returnedToAnnotator === 0;
                const majorityThreshold = stat?.majorityThreshold;
                const majorityRuleLabel = stat?.majorityRuleLabel || (majorityThreshold?.required && majorityThreshold?.total
                  ? `${majorityThreshold.required}/${majorityThreshold.total}`
                  : '2/3');
                const votes = stat?.votes || {};
                const approveVotes = votes.approveVotes ?? 0;
                const rejectVotes = votes.rejectVotes ?? 0;
                const pendingVotes = votes.pendingVotes ?? 0;
                const decidedVotes = votes.decidedVotes ?? (approveVotes + rejectVotes);
                const totalVotes = votes.totalVotes ?? (approveVotes + rejectVotes + pendingVotes);
                const voteProgressLabel = votes.progressLabel || `${decidedVotes}/${totalVotes}`;
                const consensusReadyCount = stat?.consensus?.consensusReadyCount ?? 0;
                const consensusNeedsReviewCount = stat?.consensus?.needsReviewCount ?? 0;
                const avgConsensusScore = typeof stat?.consensus?.avgConsensusScore === 'number'
                  ? stat.consensus.avgConsensusScore
                  : null;
                const consensusCoverageLabel = totalTasks > 0
                  ? `${consensusReadyCount}/${totalTasks}`
                  : `${consensusReadyCount}`;
                const consensusScoreLabel = avgConsensusScore == null
                  ? '-'
                  : `${Math.round(avgConsensusScore * 100)}%`;
                const annotatorStats = Array.isArray(stat?.annotators) ? stat.annotators : [];

                const reviewState = (() => {
                  if ((pendingAnnotation + submitted) > 0) {
                    return { label: 'Trạng thái review: Đang xử lý', color: '#93c5fd', bg: 'rgba(59,130,246,0.15)' };
                  }
                  if (returnedToAnnotator > 0 || rejected > 0) {
                    return { label: 'Trạng thái review: Cần làm lại', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
                  }
                  if (approved > 0) {
                    return { label: 'Trạng thái review: Đạt', color: '#4ade80', bg: 'rgba(34,197,94,0.15)' };
                  }
                  return { label: 'Trạng thái review: Chưa có dữ liệu', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
                })();

                return (
                  <Grid item xs={12} md={6} lg={4} key={dataset._id}>
                    <Card sx={cardSx}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="h6" fontWeight={700}>{dataset.name}</Typography>
                            <Typography variant="body2" sx={{ color: '#94a3b8' }}>{dataset.description || 'No description'}</Typography>
                            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={(dataset.type || 'image').toUpperCase()} sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #334155' }} />
                              <Chip size="small" label={dataset.projectName} sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid #334155' }} />
                            </Box>
                            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={`Đã review xong: ${isReviewCompleted ? 'Có' : 'Chưa'}`}
                                sx={{
                                  bgcolor: isReviewCompleted ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
                                  color: isReviewCompleted ? '#4ade80' : '#fca5a5',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Có thể export: ${canExport ? 'Có' : 'Chưa'}`}
                                sx={{
                                  bgcolor: canExport ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
                                  color: canExport ? '#4ade80' : '#fca5a5',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={reviewState.label}
                                sx={{
                                  bgcolor: reviewState.bg,
                                  color: reviewState.color,
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Luật đa số: ${majorityRuleLabel}`}
                                sx={{
                                  bgcolor: 'rgba(59,130,246,0.15)',
                                  color: '#93c5fd',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Tiến độ reviewer vote: ${voteProgressLabel}`}
                                sx={{
                                  bgcolor: totalVotes > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.2)',
                                  color: totalVotes > 0 ? '#93c5fd' : '#94a3b8',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Task đạt (approved): ${finalCount}/${totalTasks}`}
                                sx={{
                                  bgcolor: finalCount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.2)',
                                  color: finalCount > 0 ? '#86efac' : '#94a3b8',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Coverage consensus: ${consensusCoverageLabel}`}
                                sx={{
                                  bgcolor: consensusReadyCount > 0 ? 'rgba(14,165,233,0.18)' : 'rgba(100,116,139,0.2)',
                                  color: consensusReadyCount > 0 ? '#7dd3fc' : '#94a3b8',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Điểm consensus TB: ${consensusScoreLabel}`}
                                sx={{
                                  bgcolor: avgConsensusScore != null ? 'rgba(16,185,129,0.16)' : 'rgba(100,116,139,0.2)',
                                  color: avgConsensusScore != null ? '#6ee7b7' : '#94a3b8',
                                  border: '1px solid #334155',
                                  fontWeight: 700,
                                }}
                              />
                            </Box>
                          </Box>
                          <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => { setSelectedDataset(dataset); setDeleteDialogOpen(true); }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>1) Tiến độ task (đã chấm / tổng task)</Typography>
                        <LinearProgress variant="determinate" value={taskLifecycleProgress} sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#38bdf8' } }} />
                        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                          Đã chấm {completed} / Tổng {totalTasks} task ({taskLifecycleProgress}%)
                        </Typography>

                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>2) Tỷ lệ task đạt (approved / tổng task)</Typography>
                        <LinearProgress variant="determinate" value={taskFinalProgress} sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                          Approved {finalCount} / Tổng {totalTasks} task ({taskFinalProgress}%)
                        </Typography>

                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>3) Bao phủ raw đã chấm xong (raw item đã có kết quả / tổng raw)</Typography>
                        <LinearProgress variant="determinate" value={rawLifecycleProgress} sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }} />
                        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                          Raw đã chấm xong {rawCompletedCount} / Tổng raw {rawCount} ({rawLifecycleProgress}%)
                        </Typography>

                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>4) Bao phủ raw đạt (raw có ít nhất 1 task approved / tổng raw)</Typography>
                        <LinearProgress variant="determinate" value={rawFinalProgress} sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
                        <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                          Raw đạt {rawFinalCount} / Tổng raw {rawCount} ({rawFinalProgress}%)
                        </Typography>

                        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0f172a' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>TỔNG QUAN DATASET (theo task)</Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Raw Items</Typography>
                              <Typography variant="body2" fontWeight={700}>{rawCount}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pending Annotation</Typography>
                              <Typography variant="body2" fontWeight={700}>{pendingAnnotation}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Submitted</Typography>
                              <Typography variant="body2" fontWeight={700}>{submitted}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Returned to Annotator</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>{returnedToAnnotator}</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Completed</Typography>
                              <Typography variant="body2" fontWeight={700}>{completed}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approved</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#22c55e' }}>{approved}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Rejected</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#f87171' }}>{rejected}</Typography>
                            </Grid>
                          </Grid>
                        </Box>

                        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0b1220' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>ĐỒNG THUẬN ANNOTATOR (consensus)</Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Consensus Ready</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#38bdf8' }}>{consensusReadyCount}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Needs Review</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>{consensusNeedsReviewCount}</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Average Consensus Score</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#6ee7b7' }}>{consensusScoreLabel}</Typography>
                            </Grid>
                          </Grid>
                        </Box>

                        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0b1220' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>REVIEWER VOTE (toàn bộ task)</Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approve Votes</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#22c55e' }}>{approveVotes}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reject Votes</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#f87171' }}>{rejectVotes}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Decided Votes</Typography>
                              <Typography variant="body2" fontWeight={700}>{decidedVotes}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pending Votes</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>{pendingVotes}</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Total Votes</Typography>
                              <Typography variant="body2" fontWeight={700}>{totalVotes}</Typography>
                            </Grid>
                          </Grid>
                        </Box>

                        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid #334155', bgcolor: '#0b1220' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>ANNOTATOR PERFORMANCE (THIS DATASET)</Typography>
                          {annotatorStats.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#94a3b8' }}>No annotator stats yet.</Typography>
                          ) : (
                            <Grid container spacing={1}>
                              {annotatorStats.slice(0, 6).map((a) => (
                                <Grid item xs={12} key={a.annotatorId}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1.5, bgcolor: '#0f172a', border: '1px solid #334155' }}>
                                    <Box>
                                      <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 700 }}>{a.annotatorName}</Typography>
                                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Approved <span style={{ color: '#22c55e', fontWeight: 700 }}>{a.approved}</span>
                                        {' · '}
                                        Rejected <span style={{ color: '#f87171', fontWeight: 700 }}>{a.rejected}</span>
                                        {' · '}
                                        Pending <span style={{ color: '#f59e0b', fontWeight: 700 }}>{a.pending}</span>
                                        {' · '}
                                        Pass {a.passRate}%
                                      </Typography>
                                    </Box>
                                    <Button
                                      size="small"
                                      onClick={() => handleOpenAnnotatorDetail(dataset._id, a.annotatorId, a.annotatorName)}
                                      sx={{ textTransform: 'none', color: '#93c5fd', fontWeight: 700 }}
                                    >
                                      View tasks
                                    </Button>
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </Box>
                      </CardContent>

                      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between' }}>
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
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleExportFinal(dataset._id)}
                          disabled={!canExport}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            color: canExport ? '#34d399' : '#64748b',
                          }}
                        >
                          {canExport ? 'Export Final' : 'No Approved Items'}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
          </Grid>
        </Box>
      </Box>

      <Dialog
        open={annotatorDetailDialogOpen}
        onClose={() => setAnnotatorDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Annotator Task Detail {annotatorDetail?.annotatorName ? `- ${annotatorDetail.annotatorName}` : ''}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {annotatorDetailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {!annotatorDetailLoading && annotatorDetailError && (
            <Alert severity="error" sx={{ mb: 2 }}>{annotatorDetailError}</Alert>
          )}
          {!annotatorDetailLoading && !annotatorDetailError && annotatorDetail && (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip size="small" label={`Total: ${annotatorDetail.totals?.total ?? 0}`} />
                <Chip size="small" label={`Approved: ${annotatorDetail.totals?.approved ?? 0}`} sx={{ color: '#22c55e', border: '1px solid #334155' }} />
                <Chip size="small" label={`Rejected: ${annotatorDetail.totals?.rejected ?? 0}`} sx={{ color: '#f87171', border: '1px solid #334155' }} />
                <Chip size="small" label={`Submitted: ${annotatorDetail.totals?.submitted ?? 0}`} sx={{ color: '#93c5fd', border: '1px solid #334155' }} />
                <Chip size="small" label={`Pending: ${annotatorDetail.totals?.pending ?? 0}`} sx={{ color: '#f59e0b', border: '1px solid #334155' }} />
              </Box>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: 'submitted', label: 'Submitted' },
                  { id: 'pending', label: 'Pending' },
                ].map((f) => (
                  <Button
                    key={f.id}
                    size="small"
                    variant={annotatorTaskFilter === f.id ? 'contained' : 'outlined'}
                    onClick={() => setAnnotatorTaskFilter(f.id)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    {f.label}
                  </Button>
                ))}
              </Stack>

              <Box sx={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(annotatorDetail.tasks || [])
                  .filter((t) => {
                    if (annotatorTaskFilter === 'all') return true;
                    if (annotatorTaskFilter === 'pending') return ['assigned', 'in_progress', 'completed', 'revised'].includes(t.status);
                    return t.status === annotatorTaskFilter;
                  })
                  .map((t) => (
                    <Box key={t.taskId} sx={{ p: 1.25, border: '1px solid #334155', borderRadius: 1.5, bgcolor: '#0f172a' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {t.annotationSummary || 'Chưa có kết quả gán nhãn'}
                        </Typography>
                        <Button size="small" onClick={() => navigate(`/annotator/tasks/${t.taskId}`)} sx={{ textTransform: 'none', color: '#93c5fd' }}>
                          Open task
                        </Button>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                        Status: {t.status} · Consensus: {t.consensusScore == null ? '-' : `${Math.round(t.consensusScore * 100)}%`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                        Submitted: {formatDateTime(t.submittedAt)} · Reviewed: {formatDateTime(t.reviewedAt)}
                      </Typography>
                      {t.errorCategory ? (
                        <Typography variant="caption" sx={{ color: '#f59e0b', display: 'block' }}>
                          Error: {t.errorCategory}
                        </Typography>
                      ) : null}
                      {t.reviewComments ? (
                        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                          Review note: {t.reviewComments}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAnnotatorDetailDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#cbd5e1' }}>Close</Button>
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