import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
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

const glassCardSx = {
  borderRadius: 3,
  boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(10px)',
  color: 'rgba(255,255,255,0.92)',
};

const Datasets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'image',
  });
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
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const allDatasets = response.data || [];
      setDatasets(allDatasets.map(ds => ({ 
        ...ds, 
        projectName: ds.projectId?.name || 'Chưa gán project' 
      })));
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setError('Không thể tải danh sách datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types
    const validExtensions = formData.type === 'audio' 
      ? ['.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.m4v']
      : formData.type === 'text'
      ? ['.txt', '.csv', '.json', '.xml']
      : ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    const invalidFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      return !validExtensions.some(ext => fileName.endsWith(ext));
    });
    
    if (invalidFiles.length > 0) {
      alert(`Các file sau không hợp lệ cho dataset type "${formData.type}":\n${invalidFiles.map(f => f.name).join('\n')}`);
      return;
    }
    
    // Validate file size (50MB)
    const oversizedFiles = files.filter(file => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`Các file sau vượt quá 50MB:\n${oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join('\n')}`);
      return;
    }
    
    setUploadedFiles([...uploadedFiles, ...files]);
    setError(null);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleCreateDataset = async () => {
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên dataset');
      return;
    }
    if (uploadedFiles.length === 0) {
      alert('Vui lòng upload ít nhất một file');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const datasetFormData = new FormData();
      datasetFormData.append('name', formData.name.trim());
      datasetFormData.append('type', formData.type || 'image');
      if (formData.description) {
        datasetFormData.append('description', formData.description.trim());
      }
      uploadedFiles.forEach(file => {
        datasetFormData.append('files', file);
      });

      await axios.post(`${API_URL}/api/datasets`, datasetFormData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      setCreatedDatasetName(formData.name.trim());
      setCreatedFileCount(uploadedFiles.length);
      setCreateSuccess(true);
      setFormData({ name: '', description: '', type: 'image' });
      setUploadedFiles([]);
      await fetchDatasets();
    } catch (error) {
      setError('Lỗi khi tạo dataset: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;
    try {
      await axios.delete(`${API_URL}/api/datasets/${selectedDataset._id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setDatasets(datasets.filter(ds => ds._id !== selectedDataset._id));
      setDeleteDialogOpen(false);
      setSelectedDataset(null);
    } catch (error) {
      alert('Lỗi khi xóa dataset: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh' }}>
      <Box
        sx={{
          borderRadius: 5,
          p: { xs: 2, sm: 3, md: 4 },
          background: 'linear-gradient(135deg, #24C6DC 0%, #514A9D 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.18)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(900px circle at 20% 10%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(700px circle at 85% 30%, rgba(255,255,255,0.18), transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            mb: 4,
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: 'white', mb: 0.5 }}>
              Datasets
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Kho trung tâm chứa tất cả bộ dữ liệu (Image / Text / Audio) dùng để labeling.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
              <TextField
                placeholder="Search datasets..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '999px',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: 'white' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.6)' },
                }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)', mr: 1 }} />,
                }}
              />
            </Box>
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
                borderRadius: '999px',
                textTransform: 'none',
                px: 3,
                fontWeight: 800,
                bgcolor: 'rgba(15,23,42,0.3)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(15,23,42,0.4)' },
              }}
            >
              Create Dataset
            </Button>
          </Stack>
        </Box>

        <Box sx={{ position: 'relative' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              '& .MuiAlert-icon': { color: 'white' }
            }}
          >
            <Typography variant="body2">
              <strong>Lưu ý:</strong> Tạo dataset trước, sau đó khi tạo project bạn có thể chọn dataset
              này để phân công cho annotator và reviewer.
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            {datasets.length === 0 ? (
              <Grid item xs={12}>
                <Card sx={{ ...glassCardSx, p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                    Chưa có dataset nào
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>
                    Tạo dataset đầu tiên để bắt đầu dự án labeling của bạn.
                  </Typography>
                </Card>
              </Grid>
            ) : (
              datasets
                .filter((ds) => {
                  if (!searchTerm.trim()) return true;
                  const q = searchTerm.toLowerCase();
                  return (
                    ds.name.toLowerCase().includes(q) ||
                    (ds.description || '').toLowerCase().includes(q)
                  );
                })
                .map((dataset) => {
                  const fileCount = dataset.totalItems || dataset.files?.length || 0;
                  const totalSizeBytes =
                    dataset.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;
                  const sizeLabel = formatFileSize(totalSizeBytes);
                  const datasetType = getDatasetTypeFromFiles(dataset);

                  return (
                    <Grid item xs={12} md={6} lg={4} key={dataset._id}>
                      <Card
                        sx={{
                          ...glassCardSx,
                          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                          '&:hover': { 
                            transform: 'translateY(-4px)',
                            boxShadow: '0 25px 55px rgba(0,0,0,0.25)',
                            background: 'rgba(255,255,255,0.15)',
                          },
                        }}
                      >
                        <CardContent>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              mb: 2,
                            }}
                          >
                            <Box>
                              <Typography variant="overline" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                                DATASET
                              </Typography>
                              <Typography variant="h6" fontWeight={800} sx={{ color: 'white' }}>
                                {dataset.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={datasetType.toUpperCase()}
                                  sx={{ 
                                    bgcolor: datasetType === 'image' ? 'rgba(56,189,248,0.2)' : datasetType === 'audio' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.1)',
                                    color: datasetType === 'image' ? '#38BDF8' : datasetType === 'audio' ? '#A78BFA' : 'white',
                                    fontWeight: 700,
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                />
                              </Box>
                              {dataset.description && (
                                <Typography
                                  variant="body2"
                                  sx={{ mt: 1.5, color: 'rgba(255,255,255,0.7)', lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
                                >
                                  {dataset.description}
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              size="small"
                              sx={{ color: '#FB7185', '&:hover': { bgcolor: 'rgba(251,113,133,0.1)' } }}
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
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700 }}>
                                Files
                              </Typography>
                              <Typography variant="subtitle1" fontWeight={800}>
                                {fileCount.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700 }}>
                                Size
                              </Typography>
                              <Typography variant="subtitle1" fontWeight={800}>
                                {sizeLabel}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ mt: 2.5 }}>
                            <Chip
                              label={dataset.projectName || 'Chưa gán project'}
                              size="small"
                              sx={{ 
                                bgcolor: dataset.projectId ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)',
                                color: dataset.projectId ? '#34D399' : 'rgba(255,255,255,0.5)',
                                fontWeight: 700,
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                            />
                          </Box>
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Button
                            size="small"
                            onClick={() => navigate(`/manager/projects`)}
                            sx={{ 
                              textTransform: 'none', 
                              fontWeight: 700, 
                              color: '#38BDF8',
                              '&:hover': { bgcolor: 'rgba(56,189,248,0.1)' }
                            }}
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

      {/* Create Dataset Dialog */}
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
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create New Dataset</DialogTitle>
        <DialogContent>
          {createSuccess ? (
            <Box sx={{ py: 2 }}>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  ✅ Tạo bộ dữ liệu thành công!
                </Typography>
                <Typography variant="body2">
                  Dataset <strong>"{createdDatasetName}"</strong> đã được tạo thành công với {createdFileCount} file(s).
                </Typography>
              </Alert>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <Typography variant="body2">
                  Bây giờ bạn có thể tạo project và chọn dataset này để phân công cho annotator và reviewer.
                </Typography>
              </Alert>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label="Dataset Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                select
                SelectProps={{ native: true }}
                label="Dataset Type *"
                value={formData.type}
                onChange={(e) => {
                  setFormData({ ...formData, type: e.target.value });
                  setUploadedFiles([]);
                }}
                margin="normal"
              >
                <option value="image">Image</option>
                <option value="text">Text</option>
                <option value="audio">Audio</option>
              </TextField>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                margin="normal"
              />
              <Box
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 3,
                  p: 4,
                  textAlign: 'center',
                  mt: 2,
                  cursor: 'pointer',
                  bgcolor: 'rgba(0,0,0,0.02)',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' },
                }}
                onClick={() => document.getElementById('file-upload-dataset').click()}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Click to upload or drag and drop
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Maximum file size 50MB per file
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {formData.type === 'audio' 
                    ? 'Accepted: MP3, WAV, M4A, OGG, MP4, M4V'
                    : formData.type === 'text'
                    ? 'Accepted: TXT, CSV, JSON, XML'
                    : 'Accepted: JPG, PNG, GIF, BMP, WEBP'}
                </Typography>
                <input
                  id="file-upload-dataset"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept={getAcceptForType(formData.type)}
                />
              </Box>
              {uploadedFiles.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Uploaded Files ({uploadedFiles.length})
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 2, p: 1 }}>
                    {uploadedFiles.map((file, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: index < uploadedFiles.length - 1 ? '1px solid #eee' : 'none' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {file.type.startsWith('image/') ? <ImageIcon /> : file.type.startsWith('audio/') ? <AudiotrackIcon /> : <DescriptionIcon />}
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{file.name}</Typography>
                        </Stack>
                        <IconButton size="small" color="error" onClick={() => handleRemoveFile(index)}>
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
              <Button 
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  setCreatedFileCount(0);
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Đóng
              </Button>
              <Button 
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  setCreatedFileCount(0);
                  navigate('/manager/projects/create', { 
                    state: { 
                      refreshDatasets: true,
                      datasetName: createdDatasetName 
                    } 
                  });
                }} 
                variant="contained"
                color="primary"
                sx={{ borderRadius: '999px', px: 3, textTransform: 'none', fontWeight: 700 }}
              >
                Tạo Project Ngay
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => {
                  setCreateDialogOpen(false);
                  setError(null);
                }}
                disabled={uploading}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Hủy
              </Button>
              <Button 
                onClick={handleCreateDataset} 
                variant="contained"
                disabled={uploading || !formData.name.trim() || uploadedFiles.length === 0}
                sx={{ borderRadius: '999px', px: 4, textTransform: 'none', fontWeight: 700 }}
              >
                {uploading ? <CircularProgress size={20} color="inherit" /> : 'Tạo Dataset'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa dataset <strong>"{selectedDataset?.name}"</strong>? 
            Tất cả files sẽ bị xóa vĩnh viễn.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>Cancel</Button>
          <Button 
            onClick={handleDeleteDataset} 
            color="error" 
            variant="contained"
            sx={{ borderRadius: '999px', px: 3, textTransform: 'none', fontWeight: 700 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Datasets;
