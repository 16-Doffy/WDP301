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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  Audiotrack as AudiotrackIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const panelSx = {
  borderRadius: 3,
  boxShadow: '0 16px 32px rgba(0,0,0,0.35)',
  background: '#111827',
  border: '1px solid #374151',
  color: '#e5e7eb',
};

const cardSx = {
  borderRadius: 3,
  boxShadow: '0 12px 24px rgba(0,0,0,0.28)',
  background: '#1f2937',
  border: '1px solid #374151',
  color: '#e5e7eb',
};

const Datasets = () => {
  useAuth();
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
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdDatasetName, setCreatedDatasetName] = useState('');
  const [createdFileCount, setCreatedFileCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const allDatasets = response.data || [];
      setDatasets(
        allDatasets.map((ds) => ({
          ...ds,
          projectName: ds.projectId?.name || 'Chưa gán project',
        }))
      );
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError('Không thể tải danh sách datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const validExtensions =
      formData.type === 'audio'
        ? ['.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.m4v']
        : formData.type === 'text'
          ? ['.txt', '.csv', '.json', '.xml']
          : ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

    const invalidFiles = files.filter((file) => {
      const fileName = file.name.toLowerCase();
      return !validExtensions.some((ext) => fileName.endsWith(ext));
    });

    if (invalidFiles.length > 0) {
      alert(`File không hợp lệ cho loại ${formData.type}:\n${invalidFiles.map((f) => f.name).join('\n')}`);
      return;
    }

    const oversizedFiles = files.filter((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`Các file sau vượt quá 50MB:\n${oversizedFiles.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join('\n')}`);
      return;
    }

    setUploadedFiles([...uploadedFiles, ...files]);
    setError(null);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleCreateDataset = async () => {
    if (!formData.name.trim()) return alert('Vui lòng nhập tên dataset');
    if (uploadedFiles.length === 0) return alert('Vui lòng upload ít nhất một file');

    setUploading(true);
    setError(null);
    try {
      const datasetFormData = new FormData();
      datasetFormData.append('name', formData.name.trim());
      datasetFormData.append('type', formData.type || 'image');
      if (formData.description) datasetFormData.append('description', formData.description.trim());
      uploadedFiles.forEach((file) => datasetFormData.append('files', file));

      await axios.post(`${API_URL}/api/datasets`, datasetFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setCreatedDatasetName(formData.name.trim());
      setCreatedFileCount(uploadedFiles.length);
      setCreateSuccess(true);
      setFormData({ name: '', description: '', type: 'image' });
      setUploadedFiles([]);
      await fetchDatasets();
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
      setDatasets(datasets.filter((ds) => ds._id !== selectedDataset._id));
      setDeleteDialogOpen(false);
      setSelectedDataset(null);
    } catch (err) {
      alert('Lỗi khi xóa dataset: ' + (err.response?.data?.message || err.message));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getDatasetTypeFromFiles = (dataset) => {
    if (dataset?.type) return dataset.type;
    const first = dataset?.files?.[0];
    if (first?.mimeType?.startsWith('audio/')) return 'audio';
    if (first?.mimeType?.startsWith('image/')) return 'image';
    return 'text';
  };

  const getAcceptForType = (type) => {
    if (type === 'audio') return 'audio/*,.mp3,.wav,.m4a,.ogg,.mp4,.m4v';
    if (type === 'text') return '.txt,.csv,.json,.xml,text/plain,text/csv,application/json,application/xml';
    return 'image/*';
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
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #374151' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#e5e7eb', mb: 0.5 }}>
                Datasets
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                Kho trung tâm chứa tất cả bộ dữ liệu (Image / Text / Audio) dùng để labeling.
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
                    bgcolor: '#1f2937',
                    color: '#e5e7eb',
                    '& fieldset': { borderColor: '#374151' },
                    '&:hover fieldset': { borderColor: '#4b5563' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: '#6b7280', opacity: 1 },
                }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} fontSize="small" />,
                }}
              />

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setFormData({ name: '', description: '', type: 'image' });
                  setUploadedFiles([]);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  setCreatedFileCount(0);
                  setError(null);
                  setCreateDialogOpen(true);
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 2.5,
                  fontWeight: 800,
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                Create Dataset
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(59,130,246,0.10)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.25)' }}>
            <Typography variant="body2">
              <strong>Lưu ý:</strong> Tạo dataset trước, sau đó khi tạo project bạn có thể chọn dataset này.
            </Typography>
          </Alert>

          <Grid container spacing={2.5}>
            {datasets.length === 0 ? (
              <Grid item xs={12}>
                <Card sx={{ ...cardSx, p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#e5e7eb', mb: 1 }}>Chưa có dataset nào</Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>Tạo dataset đầu tiên để bắt đầu.</Typography>
                </Card>
              </Grid>
            ) : (
              datasets
                .filter((ds) => {
                  if (!searchTerm.trim()) return true;
                  const q = searchTerm.toLowerCase();
                  return ds.name.toLowerCase().includes(q) || (ds.description || '').toLowerCase().includes(q);
                })
                .map((dataset) => {
                  const fileCount = dataset.totalItems || dataset.files?.length || 0;
                  const totalSizeBytes = dataset.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;
                  const sizeLabel = formatFileSize(totalSizeBytes);
                  const datasetType = getDatasetTypeFromFiles(dataset);

                  return (
                    <Grid item xs={12} md={6} lg={4} key={dataset._id}>
                      <Card
                        sx={{
                          ...cardSx,
                          transition: 'transform 0.2s ease-in-out, border-color 0.2s ease-in-out',
                          '&:hover': { transform: 'translateY(-3px)', borderColor: '#4b5563' },
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="overline" sx={{ fontWeight: 800, color: '#9ca3af' }}>DATASET</Typography>
                              <Typography variant="h6" fontWeight={800} sx={{ color: '#e5e7eb' }}>{dataset.name}</Typography>

                              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={datasetType.toUpperCase()}
                                  sx={{
                                    bgcolor:
                                      datasetType === 'image'
                                        ? 'rgba(59,130,246,0.15)'
                                        : datasetType === 'audio'
                                          ? 'rgba(167,139,250,0.15)'
                                          : 'rgba(107,114,128,0.15)',
                                    color:
                                      datasetType === 'image'
                                        ? '#60a5fa'
                                        : datasetType === 'audio'
                                          ? '#a78bfa'
                                          : '#d1d5db',
                                    fontWeight: 700,
                                    border: '1px solid #374151',
                                  }}
                                />
                              </Box>

                              {dataset.description && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    mt: 1.5,
                                    color: '#9ca3af',
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 2,
                                  }}
                                >
                                  {dataset.description}
                                </Typography>
                              )}
                            </Box>

                            <IconButton
                              size="small"
                              sx={{ color: '#fb7185', '&:hover': { bgcolor: 'rgba(251,113,133,0.12)' } }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDataset(dataset);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>
                                Files
                              </Typography>
                              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#e5e7eb' }}>
                                {fileCount.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>
                                Size
                              </Typography>
                              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#e5e7eb' }}>
                                {sizeLabel}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ mt: 2.5 }}>
                            <Chip
                              label={dataset.projectName || 'Chưa gán project'}
                              size="small"
                              sx={{
                                bgcolor: dataset.projectId ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                                color: dataset.projectId ? '#4ade80' : '#9ca3af',
                                fontWeight: 700,
                                border: '1px solid #374151',
                              }}
                            />
                          </Box>
                        </CardContent>

                        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Button
                            size="small"
                            onClick={() => navigate('/manager/projects')}
                            sx={{ textTransform: 'none', fontWeight: 700, color: '#60a5fa', '&:hover': { bgcolor: 'rgba(59,130,246,0.12)' } }}
                          >
                            View Projects
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })
            )}
          </Grid>
        </Box>
      </Box>

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateSuccess(false);
          setCreatedDatasetName('');
          setCreatedFileCount(0);
          setError(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#111827', color: '#e5e7eb', border: '1px solid #374151' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create New Dataset</DialogTitle>
        <DialogContent>
          {createSuccess ? (
            <Box sx={{ py: 2 }}>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                Dataset <strong>"{createdDatasetName}"</strong> đã được tạo với {createdFileCount} file.
              </Alert>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Bây giờ bạn có thể tạo project và chọn dataset này.
              </Alert>
            </Box>
          ) : (
            <>
              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
              <TextField fullWidth label="Dataset Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} margin="normal" required />
              <TextField fullWidth select SelectProps={{ native: true }} label="Dataset Type *" value={formData.type} onChange={(e) => { setFormData({ ...formData, type: e.target.value }); setUploadedFiles([]); }} margin="normal">
                <option value="image">Image</option>
                <option value="text">Text</option>
                <option value="audio">Audio</option>
              </TextField>
              <TextField fullWidth multiline rows={3} label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} margin="normal" />

              <Box
                sx={{
                  border: '2px dashed #374151',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  mt: 2,
                  cursor: 'pointer',
                  bgcolor: '#1f2937',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#3b82f6', bgcolor: '#1f2937' },
                }}
                onClick={() => document.getElementById('file-upload-dataset').click()}
              >
                <CloudUploadIcon sx={{ fontSize: 44, color: '#60a5fa', mb: 1 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#e5e7eb' }}>
                  Click to upload or drag and drop
                </Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af' }}>Maximum 50MB per file</Typography>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#9ca3af' }}>
                  {formData.type === 'audio' ? 'Accepted: MP3, WAV, M4A, OGG, MP4, M4V' : formData.type === 'text' ? 'Accepted: TXT, CSV, JSON, XML' : 'Accepted: JPG, PNG, GIF, BMP, WEBP'}
                </Typography>
                <input id="file-upload-dataset" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} accept={getAcceptForType(formData.type)} />
              </Box>

              {uploadedFiles.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: '#e5e7eb' }}>
                    Uploaded Files ({uploadedFiles.length})
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #374151', borderRadius: 2, p: 1, bgcolor: '#1f2937' }}>
                    {uploadedFiles.map((file, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: index < uploadedFiles.length - 1 ? '1px solid #374151' : 'none' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {file.type.startsWith('image/') ? <ImageIcon sx={{ color: '#60a5fa' }} /> : file.type.startsWith('audio/') ? <AudiotrackIcon sx={{ color: '#a78bfa' }} /> : <DescriptionIcon sx={{ color: '#9ca3af' }} />}
                          <Typography variant="body2" noWrap sx={{ maxWidth: 220, color: '#d1d5db' }}>{file.name}</Typography>
                        </Stack>
                        <IconButton size="small" sx={{ color: '#fb7185' }} onClick={() => handleRemoveFile(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          {createSuccess ? (
            <>
              <Button onClick={() => { setCreateDialogOpen(false); setCreateSuccess(false); setCreatedDatasetName(''); setCreatedFileCount(0); }} sx={{ textTransform: 'none', fontWeight: 700, color: '#d1d5db' }}>
                Đóng
              </Button>
              <Button
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  setCreatedFileCount(0);
                  navigate('/manager/projects/create', { state: { refreshDatasets: true, datasetName: createdDatasetName } });
                }}
                variant="contained"
                sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                Tạo Project Ngay
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => { setCreateDialogOpen(false); setError(null); }} disabled={uploading} sx={{ textTransform: 'none', fontWeight: 700, color: '#d1d5db' }}>
                Hủy
              </Button>
              <Button onClick={handleCreateDataset} variant="contained" disabled={uploading || !formData.name.trim() || uploadedFiles.length === 0} sx={{ borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
                {uploading ? <CircularProgress size={20} color="inherit" /> : 'Tạo Dataset'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#111827', color: '#e5e7eb', border: '1px solid #374151' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa dataset <strong>"{selectedDataset?.name}"</strong>? Tất cả files sẽ bị xóa vĩnh viễn.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700, color: '#d1d5db' }}>Cancel</Button>
          <Button onClick={handleDeleteDataset} variant="contained" sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Datasets;
