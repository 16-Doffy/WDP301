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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const CreateProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    questions: [],
    reviewPolicy: { mode: 'full', sampleRate: 1.0 },
    deadline: '',
    exportFormat: 'JSON',
  });
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [annotatorSearch, setAnnotatorSearch] = useState('');
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/datasets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setDatasets(response.data || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
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

  const handleSaveDraft = async () => {
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên project');
      return;
    }
    if (!formData.guidelines.trim()) {
      alert('Vui lòng nhập guidelines');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/projects`, {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        guidelines: formData.guidelines.trim(),
        labelSet: formData.labelSet || [],
        questions: formData.questions || [],
        status: 'draft',
        reviewPolicy: formData.reviewPolicy,
        deadline: formData.deadline || undefined,
        exportFormat: formData.exportFormat || 'JSON',
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Đã lưu draft thành công!');
      navigate('/manager/projects');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Lỗi khi lưu draft: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    // Validation
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên project');
      return;
    }
    if (!formData.guidelines.trim()) {
      alert('Vui lòng nhập guidelines');
      return;
    }
    if (!formData.labelSet || formData.labelSet.length === 0) {
      alert('Vui lòng thêm ít nhất một label để annotator có thể chọn khi gán nhãn');
      return;
    }
    const invalidLabels = formData.labelSet.filter(l => !l.name || !l.name.trim());
    if (invalidLabels.length > 0) {
      alert('Tất cả labels phải có tên. Vui lòng kiểm tra lại.');
      return;
    }
    if (selectedDatasets.length === 0) {
      alert('Vui lòng chọn ít nhất một dataset');
      return;
    }
    if (selectedAnnotators.length === 0) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (selectedReviewers.length === 0) {
      alert('Vui lòng chọn ít nhất một reviewer');
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
        labelSet: formData.labelSet || [],
        questions: formData.questions || [],
        status: 'active',
        reviewPolicy: formData.reviewPolicy,
        deadline: formData.deadline || undefined,
        exportFormat: formData.exportFormat || 'JSON',
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const projectId = projectRes.data._id;

      // Step 2: Link selected datasets to project
      for (const datasetId of selectedDatasets) {
        await axios.put(`${API_URL}/api/datasets/${datasetId}`, {
          projectId: projectId
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
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
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }

      alert('Tạo project và phân công thành công!');
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
      alert(`Lỗi khi tạo project: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
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
      <Paper sx={{ p: 4 }}>
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

            {/* Label Set Management */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Label Set</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const newLabel = {
                      name: '',
                      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                      description: ''
                    };
                    setFormData({
                      ...formData,
                      labelSet: [...formData.labelSet, newLabel]
                    });
                  }}
                >
                  Add Label
                </Button>
              </Box>
              
              {formData.labelSet.length === 0 ? (
                <Alert severity="info">
                  Chưa có label nào. Vui lòng thêm ít nhất một label để annotator có thể chọn khi gán nhãn.
                </Alert>
              ) : (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2,
                    maxHeight: '500px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 2,
                    pb: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    p: 2,
                    '&::-webkit-scrollbar': {
                      width: '10px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#f1f1f1',
                      borderRadius: '5px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#888',
                      borderRadius: '5px',
                      '&:hover': {
                        background: '#555',
                      },
                    },
                  }}
                >
                  {formData.labelSet.map((label, idx) => (
                    <Card key={idx} variant="outlined" sx={{ flexShrink: 0 }}>
                      <CardContent>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Label Name *"
                              value={label.name}
                              onChange={(e) => {
                                const updated = [...formData.labelSet];
                                updated[idx].name = e.target.value;
                                setFormData({ ...formData, labelSet: updated });
                              }}
                              placeholder="e.g., Car, Person, Dog"
                              required
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <input
                                type="color"
                                value={label.color || '#000000'}
                                onChange={(e) => {
                                  const updated = [...formData.labelSet];
                                  updated[idx].color = e.target.value;
                                  setFormData({ ...formData, labelSet: updated });
                                }}
                                style={{
                                  width: '50px',
                                  height: '40px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              />
                              <TextField
                                size="small"
                                value={label.color || '#000000'}
                                onChange={(e) => {
                                  const updated = [...formData.labelSet];
                                  updated[idx].color = e.target.value;
                                  setFormData({ ...formData, labelSet: updated });
                                }}
                                placeholder="#000000"
                                sx={{ flex: 1 }}
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Description (Optional)"
                              value={label.description || ''}
                              onChange={(e) => {
                                const updated = [...formData.labelSet];
                                updated[idx].description = e.target.value;
                                setFormData({ ...formData, labelSet: updated });
                              }}
                              placeholder="Brief description"
                            />
                          </Grid>
                          <Grid item xs={12} sm={1}>
                            <IconButton
                              color="error"
                              onClick={() => {
                                const updated = formData.labelSet.filter((_, i) => i !== idx);
                                setFormData({ ...formData, labelSet: updated });
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
              
              {formData.labelSet.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Đã thêm {formData.labelSet.length} label(s). Annotator sẽ có thể chọn các label này khi gán nhãn.
                </Alert>
              )}
            </Box>

            {/* Dataset Selection */}
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
                Chọn Dataset *
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Chọn dataset (có thể chọn nhiều)</InputLabel>
                <Select
                  multiple
                  value={selectedDatasets}
                  onChange={(e) => setSelectedDatasets(e.target.value)}
                  renderValue={(selected) => {
                    const selectedNames = selected.map(id => {
                      const ds = datasets.find(d => d._id === id);
                      return ds ? ds.name : id;
                    });
                    return selectedNames.join(', ');
                  }}
                  label="Chọn dataset (có thể chọn nhiều)"
                >
                  {datasets.length === 0 ? (
                    <MenuItem disabled>
                      <Typography variant="body2" color="textSecondary">
                        Chưa có dataset nào. Vui lòng tạo dataset trước.
                      </Typography>
                    </MenuItem>
                  ) : (
                    datasets.map((dataset) => (
                      <MenuItem key={dataset._id} value={dataset._id}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>{dataset.name}</span>
                          <Chip 
                            label={`${dataset.totalItems || 0} files`} 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
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
    </Box>
  );
};

export default CreateProject;
