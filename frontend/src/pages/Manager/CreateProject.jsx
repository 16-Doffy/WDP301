import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Slider,
  IconButton,
  LinearProgress,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const steps = ['Project Details', 'Dataset Management', 'Team Assignment'];

const CreateProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    questions: [],
    reviewPolicy: { mode: 'full', sampleRate: 0.2 },
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [selectedReviewerSpecialty, setSelectedReviewerSpecialty] = useState('');
  const [annotators, setAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [annotatorSearch, setAnnotatorSearch] = useState('');
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [annotatorSpecialtyFilter, setAnnotatorSpecialtyFilter] = useState('all');
  const [reviewerSpecialtyFilter, setReviewerSpecialtyFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [workloads, setWorkloads] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchWorkloads();
  }, []);

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

  const fetchWorkloads = async () => {
    try {
      // Fetch all tasks để tính workload
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const tasks = Array.isArray(response.data) ? response.data : [];
      
      const workloadMap = {};
      tasks.forEach(task => {
        // Đếm tasks đang active (assigned, in_progress, submitted)
        if (task.status && ['assigned', 'in_progress', 'submitted'].includes(task.status)) {
          const annotatorId = task.annotatorId?._id || task.annotatorId;
          if (annotatorId) {
            workloadMap[annotatorId] = (workloadMap[annotatorId] || 0) + 1;
          }
          
          // Tính workload cho reviewers
          if (task.reviewers && Array.isArray(task.reviewers)) {
            task.reviewers.forEach(rv => {
              const reviewerId = rv.reviewerId?._id || rv.reviewerId;
              if (reviewerId && rv.status === 'pending') {
                workloadMap[reviewerId] = (workloadMap[reviewerId] || 0) + 1;
              }
            });
          }
        }
      });
      
      setWorkloads(workloadMap);
    } catch (error) {
      console.error('Error fetching workloads:', error);
      // Không block nếu không lấy được workload
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const calculateWorkload = (userId) => {
    return workloads[userId] || 0;
  };

  const filteredAnnotators = annotators.filter(ann => {
    const matchSearch = annotatorSearch === '' || 
      ann.fullName?.toLowerCase().includes(annotatorSearch.toLowerCase()) ||
      ann.username?.toLowerCase().includes(annotatorSearch.toLowerCase());
    const matchSpecialty = annotatorSpecialtyFilter === 'all' || ann.specialty === annotatorSpecialtyFilter;
    return matchSearch && matchSpecialty;
  });

  const filteredReviewers = reviewers.filter(rev => {
    const matchSearch = reviewerSearch === '' || 
      rev.fullName?.toLowerCase().includes(reviewerSearch.toLowerCase()) ||
      rev.username?.toLowerCase().includes(reviewerSearch.toLowerCase());
    const matchSpecialty = reviewerSpecialtyFilter === 'all' || rev.specialty === reviewerSpecialtyFilter;
    return matchSearch && matchSpecialty;
  });

  const annotatorSpecialties = [...new Set(annotators.map(a => a.specialty).filter(Boolean))];
  const reviewerSpecialties = [...new Set(reviewers.map(r => r.specialty).filter(Boolean))];

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.name.trim()) {
        alert('Vui lòng nhập tên project');
        return;
      }
    } else if (activeStep === 1) {
      if (uploadedFiles.length === 0) {
        alert('Vui lòng upload ít nhất một file');
        return;
      }
    }
    setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/projects`, {
        ...formData,
        status: 'draft',
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
    if (selectedAnnotators.length === 0) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (selectedReviewers.length === 0) {
      alert('Vui lòng chọn ít nhất một reviewer');
      return;
    }
    if (!selectedReviewerSpecialty && reviewerSpecialties.length > 0) {
      alert('Vui lòng chọn specialty cho reviewer');
      return;
    }
    if (!formData.guidelines.trim()) {
      alert('Vui lòng nhập guidelines');
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
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const projectId = projectRes.data._id;

      // Step 2: Upload dataset
      const datasetFormData = new FormData();
      datasetFormData.append('projectId', projectId);
      datasetFormData.append('name', `${formData.name} - Dataset`);
      uploadedFiles.forEach(file => {
        datasetFormData.append('files', file);
      });

      const datasetRes = await axios.post(`${API_URL}/api/datasets`, datasetFormData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      // Step 3: Assign tasks
      await axios.post(`${API_URL}/api/tasks/assign`, {
        projectId,
        datasetId: datasetRes.data._id,
        annotatorIds: selectedAnnotators,
        reviewerIds: selectedReviewers,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      alert('Tạo project và phân công thành công!');
      navigate(`/manager/projects/${projectId}`);
    } catch (error) {
      console.error('Error creating project:', error);
      let errorMsg = 'Có lỗi xảy ra';
      
      if (error.response) {
        // Server responded with error
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.type?.startsWith('image/')) return '🖼️';
    if (file.name?.endsWith('.zip')) return '📦';
    if (file.name?.endsWith('.csv')) return '📊';
    if (file.name?.endsWith('.json')) return '📄';
    return '📁';
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
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
            disabled={saving || activeStep < 2}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {saving ? 'Đang tạo...' : 'Create Project'}
          </Button>
        </Box>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step Content */}
      <Paper sx={{ p: 4 }}>
        {/* Step 1: Project Details */}
        {activeStep === 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>1</Avatar>
              <Box>
                <Typography variant="h5">Project Details</Typography>
                <Typography variant="body2" color="textSecondary">
                  Set the basic identity for your annotation project. This helps your team identify their goals.
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Project Name"
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
                  rows={4}
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
                  rows={6}
                  label="Guidelines"
                  placeholder="Provide detailed guidelines for annotators..."
                  value={formData.guidelines}
                  onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 2: Dataset Management */}
        {activeStep === 1 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>2</Avatar>
              <Box>
                <Typography variant="h5">Dataset Management</Typography>
                <Typography variant="body2" color="textSecondary">
                  Upload your raw data files. Supported formats: .csv, .json, .zip (images).
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Click to upload or drag and drop
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Maximum file size 2GB
              </Typography>
              <input
                id="file-upload"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".zip,.csv,.json,image/*"
              />
            </Box>
            {uploadedFiles.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Uploaded Files ({uploadedFiles.length})
                </Typography>
                {uploadedFiles.map((file, index) => (
                  <Card key={index} sx={{ mb: 1 }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6">{getFileIcon(file)}</Typography>
                        <Box>
                          <Typography variant="body1">{file.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatFileSize(file.size)}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton onClick={() => handleRemoveFile(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Step 3: Team Assignment */}
        {activeStep === 2 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>3</Avatar>
              <Box>
                <Typography variant="h5">Team Assignment</Typography>
                <Typography variant="body2" color="textSecondary">
                  Select specialists for annotation and quality control. Reviewers will check the annotators' work.
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={4}>
              {/* Annotators */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentIcon color="primary" />
                        <Typography variant="h6">Annotators</Typography>
                      </Box>
                      <Chip label={`${selectedAnnotators.length} Selected`} color="primary" size="small" />
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by name or ID..."
                      value={annotatorSearch}
                      onChange={(e) => setAnnotatorSearch(e.target.value)}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                      sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Filter Specialty</InputLabel>
                      <Select
                        value={annotatorSpecialtyFilter}
                        onChange={(e) => setAnnotatorSpecialtyFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Specialties</MenuItem>
                        {annotatorSpecialties.map(spec => (
                          <MenuItem key={spec} value={spec}>{spec}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                      {filteredAnnotators.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                          {annotators.length === 0 
                            ? 'Chưa có annotator nào. Vui lòng tạo annotator trước.' 
                            : 'Không tìm thấy annotator phù hợp với bộ lọc.'}
                        </Typography>
                      ) : (
                        filteredAnnotators.map((ann) => {
                          const isSelected = selectedAnnotators.includes(ann._id);
                          const workload = calculateWorkload(ann._id);
                          return (
                            <Card
                              key={ann._id}
                              sx={{
                                mb: 1,
                                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedAnnotators(selectedAnnotators.filter(id => id !== ann._id));
                                } else {
                                  setSelectedAnnotators([...selectedAnnotators, ann._id]);
                                }
                              }}
                            >
                              <CardContent sx={{ py: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Checkbox checked={isSelected} size="small" />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1">
                                      {ann.fullName || ann.username}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                      Specialty: {ann.specialty || 'General'} • WL: {workload}
                                    </Typography>
                                  </Box>
                                  <Chip label="Active" color="success" size="small" />
                                </Box>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      WL = Current Workload (Projects Assigned)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Reviewers */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon color="success" />
                        <Typography variant="h6">Reviewers</Typography>
                      </Box>
                      <Chip label={`${selectedReviewers.length} Selected`} color="success" size="small" />
                    </Box>
                    
                    {/* Two dropdowns như mockup */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Specialty</InputLabel>
                          <Select
                            value={selectedReviewerSpecialty}
                            onChange={(e) => {
                              setSelectedReviewerSpecialty(e.target.value);
                              setSelectedReviewers([]); // Reset khi đổi specialty
                            }}
                          >
                            <MenuItem value="">All Specialties</MenuItem>
                            {reviewerSpecialties.map(spec => (
                              <MenuItem key={spec} value={spec}>{spec}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Reviewer</InputLabel>
                          <Select
                            value={selectedReviewers.length > 0 ? selectedReviewers[0] : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSelectedReviewers([e.target.value]);
                              } else {
                                setSelectedReviewers([]);
                              }
                            }}
                            disabled={!selectedReviewerSpecialty && reviewerSpecialties.length > 0}
                          >
                            <MenuItem value="">Select Reviewer</MenuItem>
                            {reviewers
                              .filter(rev => !selectedReviewerSpecialty || rev.specialty === selectedReviewerSpecialty)
                              .map((rev) => {
                                const workload = calculateWorkload(rev._id);
                                return (
                                  <MenuItem key={rev._id} value={rev._id}>
                                    {rev.fullName || rev.username} ({rev.specialty || 'General'}) • WL: {workload}
                                  </MenuItem>
                                );
                              })}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    {/* Hiển thị reviewer đã chọn */}
                    {selectedReviewers.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        {selectedReviewers.map(revId => {
                          const rev = reviewers.find(r => r._id === revId);
                          if (!rev) return null;
                          const workload = calculateWorkload(rev._id);
                          return (
                            <Card key={rev._id} sx={{ mb: 1, bgcolor: 'action.selected' }}>
                              <CardContent sx={{ py: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box>
                                    <Typography variant="body1">
                                      {rev.fullName || rev.username}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                      Specialty: {rev.specialty || 'General'} • WL: {workload}
                                    </Typography>
                                  </Box>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => setSelectedReviewers([])}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Box>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Box>
                    )}

                    {/* Thông báo khi chưa chọn */}
                    {selectedReviewers.length === 0 && (
                      <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                        {reviewers.length === 0 
                          ? 'Chưa có reviewer nào. Vui lòng tạo reviewer trước.' 
                          : 'Vui lòng chọn specialty và reviewer.'}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Quality Strategy */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>Quality Strategy</Typography>
              <Box sx={{ px: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Review Rate: Percentage of tasks to be validated by reviewers.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Slider
                    value={formData.reviewPolicy.sampleRate * 100}
                    onChange={(e, value) => {
                      setFormData({
                        ...formData,
                        reviewPolicy: {
                          mode: value === 100 ? 'full' : 'sample',
                          sampleRate: value / 100,
                        },
                      });
                    }}
                    marks={[
                      { value: 0, label: '0% (No Review)' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100% (Strict)' },
                    ]}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="h6" sx={{ minWidth: 60, textAlign: 'right' }}>
                    {Math.round(formData.reviewPolicy.sampleRate * 100)}%
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mt: 3 }}>
              Tasks will be automatically distributed among the selected {selectedAnnotators.length} annotators.
              A quality check sampling rate of {Math.round(formData.reviewPolicy.sampleRate * 100)}% is set.
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext} disabled={activeStep === steps.length - 1}>
          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

export default CreateProject;
