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

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const allDatasets = response.data || [];
      const mapped = allDatasets.map((ds) => ({
        ...ds,
        projectName: ds.projectId?.name || 'Chưa gán project',
      }));
      setDatasets(mapped);

      const statusEntries = await Promise.all(
        mapped.map(async (ds) => {
          try {
            const s = await axios.get(`${API_URL}/api/datasets/${ds._id}/status`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
                const completion = stat?.completionRate || 0;
                const finalCount = stat?.totalFinalItems || 0;
                const rawCount = stat?.totalRawItems || dataset.totalItems || 0;

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
                          </Box>
                          <IconButton size="small" sx={{ color: '#f87171' }} onClick={() => { setSelectedDataset(dataset); setDeleteDialogOpen(true); }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Final Dataset Progress</Typography>
                        <LinearProgress variant="determinate" value={completion} sx={{ mt: 1, mb: 1, height: 8, borderRadius: 4, bgcolor: '#0f172a', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                          Final {finalCount} / Raw {rawCount} items ({completion}%)
                        </Typography>
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
                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleExportFinal(dataset._id)} sx={{ textTransform: 'none', fontWeight: 700, color: '#34d399' }}>
                          Export Final
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
          </Grid>
        </Box>
      </Box>

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
