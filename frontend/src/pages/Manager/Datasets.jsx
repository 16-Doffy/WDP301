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
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdDatasetName, setCreatedDatasetName] = useState('');

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      // Get all datasets of current manager (including unassigned ones)
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
      if (formData.description) {
        datasetFormData.append('description', formData.description.trim());
      }
      uploadedFiles.forEach(file => {
        datasetFormData.append('files', file);
      });

      const response = await axios.post(`${API_URL}/api/datasets`, datasetFormData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      // Đánh dấu thành công và lưu tên dataset
      setCreatedDatasetName(formData.name.trim());
      setCreateSuccess(true);
      
      // Reset form
      setFormData({ name: '', description: '' });
      setUploadedFiles([]);
      
      // Fetch lại danh sách datasets
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
      await axios.delete(`${API_URL}/api/datasets/${selectedDataset._id}`);
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

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon />;
    return <DescriptionIcon />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dataset Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setFormData({ name: '', description: '' });
            setUploadedFiles([]);
            setCreateDialogOpen(true);
          }}
        >
          Create Dataset
        </Button>
      </Box>

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
                Tạo project mới để upload dataset
              </Typography>
            </Paper>
          </Grid>
        ) : (
          datasets.map((dataset) => (
            <Grid item xs={12} md={6} lg={4} key={dataset._id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {dataset.name}
                      </Typography>
                      <Chip 
                        label={dataset.projectName || 'Unknown Project'} 
                        size="small" 
                        color="primary" 
                        sx={{ mb: 1 }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedDataset(dataset);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  
                  {dataset.description && (
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {dataset.description}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Files:</strong> {dataset.files?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Total Items:</strong> {dataset.totalItems || 0}
                    </Typography>
                  </Box>

                  {dataset.files && dataset.files.length > 0 && (
                    <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
                      {dataset.files.slice(0, 5).map((file, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {getFileIcon(file.mimeType)}
                          <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {file.originalName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatFileSize(file.size)}
                          </Typography>
                        </Box>
                      ))}
                      {dataset.files.length > 5 && (
                        <Typography variant="caption" color="textSecondary">
                          ... và {dataset.files.length - 5} file khác
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/manager/projects`)}>
                    View Project
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create Dataset Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateSuccess(false);
          setCreatedDatasetName('');
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
                  Dataset <strong>"{createdDatasetName}"</strong> đã được tạo thành công với {uploadedFiles.length} file(s).
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
                  accept="image/*,.zip,.csv,.json"
                />
              </Box>
              {uploadedFiles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Uploaded Files ({uploadedFiles.length})
                  </Typography>
                  {uploadedFiles.map((file, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
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
              <Button onClick={() => {
                setCreateDialogOpen(false);
                setCreateSuccess(false);
                setCreatedDatasetName('');
              }}>
                Đóng
              </Button>
              <Button 
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateSuccess(false);
                  setCreatedDatasetName('');
                  navigate('/manager/projects/create', { state: { refreshDatasets: true } });
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Dataset</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa dataset "{selectedDataset?.name}"? 
            Tất cả files sẽ bị xóa vĩnh viễn.
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
