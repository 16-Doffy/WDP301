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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  Audiotrack as AudiotrackIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

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
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
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
    setUploadedFiles([...uploadedFiles, ...files]);
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
      uploadedFiles.forEach((file) => {
        datasetFormData.append('files', file);
      });

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
      await axios.delete(`${API_URL}/api/datasets/${selectedDataset._id}`);
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

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon />;
    if (mimeType?.startsWith('audio/')) return <AudiotrackIcon />;
    return <DescriptionIcon />;
  };

  const getDatasetTypeFromFiles = (dataset) => {
    if (dataset?.type) return dataset.type;
    const first = dataset?.files?.[0];
    if (first?.mimeType?.startsWith('audio/')) return 'audio';
    if (first?.mimeType?.startsWith('image/')) return 'image';
    return 'text';
  };

  const getAcceptForType = (type) => {
    if (type === 'audio') return 'audio/*,.mp3,.wav,.m4a,.ogg';
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
    <Box sx={{ p: 0 }} className="flex-1 overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Datasets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kho trung tâm chứa tất cả bộ dữ liệu (Image / Text / Audio) dùng để labeling.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white min-w-[220px]"
            />
          </div>
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
            sx={{ borderRadius: '999px', textTransform: 'none', px: 3 }}
          >
            Create Dataset
          </Button>
        </div>
      </div>

      <div className="p-6 flex gap-6">
        <div className="flex-1">
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Lưu ý:</strong> Tạo dataset trước, sau đó khi tạo project bạn có thể chọn dataset này để phân công cho annotator và reviewer.
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            {datasets.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Chưa có dataset nào
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Tạo dataset đầu tiên để bắt đầu dự án labeling của bạn.
                  </Typography>
                </Paper>
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
                          borderRadius: 3,
                          boxShadow: '0 18px 45px rgba(15,23,42,0.04)',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          '&:hover': { boxShadow: '0 22px 55px rgba(15,23,42,0.08)' },
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
                              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 0.5 }}>
                                DATASET
                              </Typography>
                              <Typography variant="h6" sx={{ mb: 0.5 }}>
                                {dataset.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={datasetType.toUpperCase()}
                                  color={datasetType === 'image' ? 'primary' : datasetType === 'audio' ? 'secondary' : 'default'}
                                />
                              </Box>
                              {dataset.description && (
                                <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 260 }}>
                                  {dataset.description}
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDataset(dataset);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                            <Box>
                              <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase' }}>
                                Files
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {fileCount.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase' }}>
                                Size
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {sizeLabel}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ mt: 2 }}>
                            <Chip
                              label={dataset.projectName || 'Chưa gán project'}
                              size="small"
                              color={dataset.projectId ? 'primary' : 'default'}
                              variant={dataset.projectId ? 'filled' : 'outlined'}
                            />
                          </Box>
                        </CardContent>
                        <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                          <Button size="small" onClick={() => navigate(`/manager/projects`)} sx={{ textTransform: 'none', fontSize: 13 }}>
                            View Projects
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })
            )}
          </Grid>
        </div>

        <div className="w-full lg:w-72 space-y-4">
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Type
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip label="Images" size="small" color="primary" variant="outlined" />
              <Chip label="Other" size="small" variant="outlined" />
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Total Storage
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Box sx={{ height: 6, borderRadius: 999, bgcolor: '#e5e7eb', overflow: 'hidden' }}>
                <Box sx={{ width: '60%', height: '100%', bgcolor: '#2563eb' }} />
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Dùng thử ảo để minh họa UI – logic export / upload vẫn hoạt động bình thường.
              </Typography>
            </Box>
          </Paper>
        </div>
      </div>

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
        <DialogTitle>Create New Dataset</DialogTitle>
        <DialogContent>
          {createSuccess ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  ✅ Tạo bộ dữ liệu thành công!
                </Typography>
                <Typography variant="body2">
                  Dataset <strong>"{createdDatasetName}"</strong> đã được tạo thành công với {createdFileCount} file(s).
                </Typography>
              </Alert>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Bây giờ bạn có thể tạo project và chọn dataset này để phân công cho annotator và reviewer.
                </Typography>
              </Alert>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
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
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  mt: 2,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
                onClick={() => document.getElementById('file-upload-dataset').click()}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>
                  Click to upload or drag and drop
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Maximum file size 50MB per file
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
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Uploaded Files ({uploadedFiles.length})
                  </Typography>
                  {uploadedFiles.map((file, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2">{file.name}</Typography>
                      <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {createSuccess ? (
            <>
              <Button
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  setCreatedFileCount(0);
                }}
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
                      datasetName: createdDatasetName,
                    },
                  });
                }}
                variant="contained"
                color="primary"
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
              >
                Hủy
              </Button>
              <Button
                onClick={handleCreateDataset}
                variant="contained"
                disabled={uploading || !formData.name.trim() || uploadedFiles.length === 0}
              >
                {uploading ? <CircularProgress size={20} /> : 'Tạo Dataset'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa dataset "{selectedDataset?.name}"? Tất cả files sẽ bị xóa vĩnh viễn.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteDataset} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Datasets;
