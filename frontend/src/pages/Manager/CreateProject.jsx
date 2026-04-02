import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    questions: [],
    reviewPolicy: { mode: 'full', sampleRate: 1.0 },
    deadline: '',
    exportFormat: 'JSON',
  });
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [lockDatasets, setLockDatasets] = useState(false);
  const [annotators, setAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [annotatorSearch, setAnnotatorSearch] = useState('');
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  const getAuthToken = () => sessionStorage.getItem('token');
  const getAuthHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  useEffect(() => {
    fetchUsers();
    fetchDatasets();
  }, []);

  // Refresh datasets when navigating from Datasets page
  useEffect(() => {
    if (location.state?.refreshDatasets) {
      fetchDatasets();

      if (location.state?.datasetName) {
        setFormData(prev => ({
          ...prev,
          name: location.state.datasetName,
          description: prev.description || ''
        }));
      }

      if (Array.isArray(location.state?.preselectedDatasetIds) && location.state.preselectedDatasetIds.length > 0) {
        setSelectedDatasets(location.state.preselectedDatasetIds);
        setLockDatasets(true);
      } else {
        setLockDatasets(false);
      }

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Refresh datasets when page becomes visible (user returns from Datasets page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDatasets();
      }
    };
    const handleFocus = () => {
      fetchDatasets();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets`, {
        headers: getAuthHeaders()
      });
      const allDatasets = response.data || [];
      console.log('All datasets from API:', allDatasets);
      // Chỉ hiển thị datasets chưa có projectId (chưa được gán cho project nào)
      const unassignedDatasets = allDatasets.filter(ds => !ds.projectId || ds.projectId === null);
      console.log('Unassigned datasets:', unassignedDatasets);
      setDatasets(unassignedDatasets);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setError('Không thể tải danh sách datasets: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      const allUsers = Array.isArray(response.data) ? response.data : [];
      setAnnotators(allUsers.filter(u => u.role === 'annotator' && u.isActive));
      setReviewers(allUsers.filter(u => u.role === 'reviewer' && u.isActive));
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Không thể tải danh sách users. Vui lòng kiểm tra kết nối.');
    }
  };


  const filteredAnnotators = annotators.filter(ann => {
    const matchSearch = annotatorSearch === '' || 
      ann.fullName?.toLowerCase().includes(annotatorSearch.toLowerCase()) ||
      ann.username?.toLowerCase().includes(annotatorSearch.toLowerCase());
    return matchSearch;
  });

  const filteredReviewers = reviewers.filter(rev => {
    const matchSearch = reviewerSearch === '' || 
      rev.fullName?.toLowerCase().includes(reviewerSearch.toLowerCase()) ||
      rev.username?.toLowerCase().includes(reviewerSearch.toLowerCase());
    return matchSearch;
  });

  const isDatasetTypeConsistent = (ds) => {
    const dsType = (ds?.type || '').toLowerCase();
    const files = Array.isArray(ds?.files) ? ds.files : [];
    if (files.length === 0) return true;

    return files.every((f) => {
      const name = (f?.originalName || f?.filename || '').toLowerCase();
      const mime = (f?.mimeType || '').toLowerCase();
      if (dsType === 'image') return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext));
      if (dsType === 'audio') return mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.mp4'].some((ext) => name.endsWith(ext));
      if (dsType === 'text') return mime.startsWith('text/') || ['.txt', '.csv', '.json', '.xml'].some((ext) => name.endsWith(ext));
      return false;
    });
  };

  const validDatasets = datasets.filter((ds) => isDatasetTypeConsistent(ds));
  const selectedDatasetObjects = selectedDatasets
    .map((id) => validDatasets.find((d) => d._id === id))
    .filter(Boolean);

  const handleSaveDraft = async () => {
    if (!formData.name.trim()) {
      showNotification('Vui lòng nhập tên project', 'warning');
      return;
    }
    if (!formData.guidelines.trim()) {
      showNotification('Vui lòng nhập guidelines', 'warning');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/projects`, {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        guidelines: formData.guidelines.trim(),
        questions: formData.questions || [],
        status: 'draft',
        reviewPolicy: formData.reviewPolicy,
        deadline: formData.deadline || undefined,
        exportFormat: formData.exportFormat || 'JSON',
      }, {
        headers: getAuthHeaders()
      });
      showNotification('Đã lưu draft thành công!');
      navigate('/manager/projects');
    } catch (error) {
      console.error('Error saving draft:', error);
      showNotification('Lỗi khi lưu draft: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    // Validation
    if (!formData.name.trim()) {
      showNotification('Vui lòng nhập tên project', 'warning');
      return;
    }
    if (!formData.guidelines.trim()) {
      showNotification('Vui lòng nhập guidelines', 'warning');
      return;
    }
    if (selectedDatasets.length === 0) {
      showNotification('Vui lòng chọn ít nhất một dataset');
      return;
    }
    if (selectedAnnotators.length === 0) {
      showNotification('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (selectedAnnotators.length % 2 === 0) {
      showNotification('Số annotator phải là số lẻ (1, 3, 5, ...). Vui lòng bỏ bớt hoặc thêm 1 annotator.');
      return;
    }
    if (selectedReviewers.length === 0) {
      showNotification('Vui lòng chọn ít nhất một reviewer');
      return;
    }
    if (selectedReviewers.length % 2 === 0) {
      showNotification('Số reviewer phải là số lẻ (1, 3, 5, ...). Vui lòng bỏ bớt hoặc thêm 1 reviewer.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Step 1: Create project
      const projectRes = await axios.post(`${API_URL}/api/projects`, {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        guidelines: formData.guidelines.trim(),
        questions: formData.questions || [],
        status: 'active',
        reviewPolicy: formData.reviewPolicy,
        deadline: formData.deadline || undefined,
        exportFormat: formData.exportFormat || 'JSON',
      }, {
        headers: getAuthHeaders()
      });
      const projectId = projectRes.data._id;

      // Step 2: Link selected datasets to project
      for (const datasetId of selectedDatasets) {
        await axios.put(`${API_URL}/api/datasets/${datasetId}`, {
          projectId: projectId
        }, {
          headers: getAuthHeaders()
        });
      }

      // Step 3: Assign tasks for each selected dataset
      for (const datasetId of selectedDatasets) {
        await axios.post(`${API_URL}/api/tasks/assign`, {
          projectId,
          datasetId: datasetId,
          annotatorIds: selectedAnnotators,
          reviewerIds: selectedReviewers,
        }, {
          headers: getAuthHeaders()
        });
      }

      showNotification('Tạo project và phân công thành công!');
      navigate(`/manager/projects/${projectId}`);
    } catch (error) {
      console.error('Error creating project:', error);
      let errorMsg = 'Có lỗi xảy ra';
      
      if (error.response) {
        if (error.response.data?.errors && Array.isArray(error.response.data.errors)) {
          errorMsg = error.response.data.errors.map(e => e.msg || e.message).join(', ');
        } else if (error.response.data?.message) {
          errorMsg = error.response.data.message;
        } else {
          errorMsg = error.response.statusText || 'Server error';
        }
      } else if (error.request) {
        errorMsg = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối.';
      } else {
        errorMsg = error.message || 'Có lỗi xảy ra';
      }
      
      setError(`Lỗi: ${errorMsg}`);
      showNotification(`Lỗi khi tạo project: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto', minHeight: '100vh', bgcolor: '#0f172a', color: '#e2e8f0' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/manager/projects')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">Create New Project</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={handleSaveDraft} disabled={saving}>
            Save Draft
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateProject}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {saving ? 'Đang tạo...' : 'Create Project'}
          </Button>
        </Box>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Form - All in One Page */}
      <Paper
        sx={{
          p: 4,
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          bgcolor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 3,
          color: '#e2e8f0',
          '& .MuiTypography-root': { color: '#e2e8f0' },
          '& .MuiInputLabel-root': { color: '#94a3b8' },
          '& .MuiOutlinedInput-root': {
            color: '#e2e8f0',
            backgroundColor: '#0f172a',
            '& fieldset': { borderColor: '#475569' },
            '&:hover fieldset': { borderColor: '#64748b' },
            '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
          },
          '& .MuiSelect-icon': { color: '#94a3b8' },
          '& .MuiCard-root': {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            color: '#e2e8f0',
          },
        }}
      >
        <Grid container spacing={4}>
          {/* Left Column - Project Details & Dataset */}
          <Grid item xs={12} md={7}>
            {/* Project Basic Info */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Project Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Project Name *"
                    placeholder="e.g., Medical Image Labeling Q4"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    placeholder="Explain the objective of this project..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={5}
                    label="Guidelines *"
                    placeholder="Provide detailed guidelines for annotators..."
                    value={formData.guidelines}
                    onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Deadline"
                    type="datetime-local"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    helperText="Set project deadline (optional)"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Export Format</InputLabel>
                    <Select
                      value={formData.exportFormat}
                      onChange={(e) => setFormData({ ...formData, exportFormat: e.target.value })}
                      label="Export Format"
                    >
                      <MenuItem value="JSON">JSON (Default)</MenuItem>
                      <MenuItem value="YOLO">YOLO</MenuItem>
                      <MenuItem value="VOC">VOC (Pascal VOC)</MenuItem>
                      <MenuItem value="COCO">COCO</MenuItem>
                      <MenuItem value="CSV">CSV</MenuItem>
                    </Select>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      Format for exporting labeled data
                    </Typography>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            {/* Labels Info */}
            <Box sx={{ mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid #3b82f6' }}>
              <Alert severity="info">
                Labels se tu dong lay tu Dataset → Subtopic → LabelSet. Vui long dam bao Dataset da duoc gan Subtopic co LabelSet trong <strong>Topics</strong> truoc khi tao project.
              </Alert>
            </Box>

            {/* Dataset Selection */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">
                  Chọn Dataset *
                </Typography>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchDatasets}
                  variant="outlined"
                >
                  Refresh
                </Button>
              </Box>
              {lockDatasets && selectedDatasetObjects.length > 0 ? (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Datasets đã được chọn sẵn từ bước tạo dataset. Project này sẽ dùng {selectedDatasetObjects.length} dataset bên dưới.
                  </Alert>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {selectedDatasetObjects.map((ds) => (
                      <Box key={ds._id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid #334155', borderRadius: 2, bgcolor: '#0f172a' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{ds.name}</Typography>
                          <Chip label={(ds.type || 'unknown').toUpperCase()} size="small" sx={{ bgcolor: '#1d4ed8', color: '#dbeafe' }} />
                        </Box>
                        <Chip label={`${ds.totalItems || 0} files`} size="small" />
                      </Box>
                    ))}
                  </Box>
                  <Button size="small" sx={{ mt: 2, textTransform: 'none' }} onClick={() => setLockDatasets(false)}>
                    Chọn dataset khác
                  </Button>
                </Box>
              ) : (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Chọn dataset (có thể chọn nhiều)</InputLabel>
                    <Select
                      multiple
                      value={selectedDatasets.filter((id) => validDatasets.some((d) => d._id === id))}
                      onChange={(e) => setSelectedDatasets(e.target.value)}
                      renderValue={(selected) => {
                        const selectedNames = selected.map(id => {
                          const ds = validDatasets.find(d => d._id === id) || datasets.find(d => d._id === id);
                          return ds ? `${ds.name} (${(ds.type || 'unknown').toUpperCase()})` : id;
                        });
                        return selectedNames.join(', ');
                      }}
                      label="Chọn dataset (có thể chọn nhiều)"
                    >
                      {validDatasets.length === 0 ? (
                        <MenuItem disabled>
                          <Typography variant="body2" color="textSecondary">
                            Không có dataset hợp lệ để chọn.
                          </Typography>
                        </MenuItem>
                      ) : (
                        validDatasets.map((dataset) => (
                          <MenuItem key={dataset._id} value={dataset._id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{dataset.name}</span>
                                <Chip label={(dataset.type || 'unknown').toUpperCase()} size="small" sx={{ bgcolor: '#1d4ed8', color: '#dbeafe' }} />
                              </Box>
                              <Chip label={`${dataset.totalItems || 0} files`} size="small" sx={{ ml: 1 }} />
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                  {selectedDatasets.length > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Đã chọn {selectedDatasets.length} dataset(s). Tasks sẽ được tạo cho tất cả files trong các dataset này.
                    </Alert>
                  )}
                </>
              )}
              {datasets.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Chưa có dataset nào. Vui lòng{' '}
                  <Button 
                    size="small" 
                    onClick={() => navigate('/manager/datasets')}
                    sx={{ textTransform: 'none' }}
                  >
                    tạo dataset trước
                  </Button>
                </Alert>
              )}
            </Box>
          </Grid>

          {/* Right Column - Team Assignment */}
          <Grid item xs={12} md={5}>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Team Assignment
            </Typography>
            
            <Grid container spacing={3}>
              {/* Annotators */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Annotators</Typography>
                      <Chip label={`${selectedAnnotators.length} Selected`} color="primary" size="small" />
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by name..."
                      value={annotatorSearch}
                      onChange={(e) => setAnnotatorSearch(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                      {filteredAnnotators.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                          {annotators.length === 0 
                            ? 'Chưa có annotator nào. Vui lòng tạo annotator trước.' 
                            : 'Không tìm thấy annotator.'}
                        </Typography>
                      ) : (
                        filteredAnnotators.map((ann) => {
                          const isSelected = selectedAnnotators.includes(ann._id);
                          return (
                            <Box
                              key={ann._id}
                              sx={{
                                p: 1.5,
                                mb: 1,
                                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                                borderRadius: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedAnnotators(selectedAnnotators.filter(id => id !== ann._id));
                                } else {
                                  setSelectedAnnotators([...selectedAnnotators, ann._id]);
                                }
                              }}
                            >
                              <Checkbox checked={isSelected} size="small" />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {ann.fullName || ann.username}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {ann.email}
                                </Typography>
                              </Box>
                              <Chip label="Active" color="success" size="small" />
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Reviewers */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Reviewers</Typography>
                      <Chip label={`${selectedReviewers.length} Selected`} color="success" size="small" />
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by name..."
                      value={reviewerSearch}
                      onChange={(e) => setReviewerSearch(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                      {filteredReviewers.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                          {reviewers.length === 0 
                            ? 'Chưa có reviewer nào. Vui lòng tạo reviewer trước.' 
                            : 'Không tìm thấy reviewer.'}
                        </Typography>
                      ) : (
                        filteredReviewers.map((rev) => {
                          const isSelected = selectedReviewers.includes(rev._id);
                          return (
                            <Box
                              key={rev._id}
                              sx={{
                                p: 1.5,
                                mb: 1,
                                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                                borderRadius: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedReviewers(selectedReviewers.filter(id => id !== rev._id));
                                } else {
                                  setSelectedReviewers([...selectedReviewers, rev._id]);
                                }
                              }}
                            >
                              <Checkbox checked={isSelected} size="small" />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {rev.fullName || rev.username}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {rev.email}
                                </Typography>
                              </Box>
                              <Chip label="Active" color="success" size="small" />
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 3 }}>
              Tasks will be automatically distributed among the selected {selectedAnnotators.length} annotator(s) 
              and reviewed by {selectedReviewers.length} reviewer(s).
            </Alert>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%', mt: 2 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CreateProject;
