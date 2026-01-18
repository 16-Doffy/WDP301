import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Alert,
} from '@mui/material';
import { Upload as UploadIcon, Assignment as AssignmentIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon, Settings as SettingsIcon, Download as DownloadIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ManagerProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    questions: [],
  });
  const [qualityStats, setQualityStats] = useState(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAnnotators();
  }, [id]);

  useEffect(() => {
    if (project) {
      setEditFormData({
        name: project.name || '',
        description: project.description || '',
        guidelines: project.guidelines || '',
        labelSet: project.labelSet || [],
        questions: project.questions || [],
      });
    }
  }, [project]);

  const fetchData = async () => {
    try {
      const [projectRes, datasetsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${id}`),
        axios.get(`${API_URL}/api/datasets/project/${id}`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      setProject(projectRes.data.project);
      setDatasets(datasetsRes.data);
      setTasks(tasksRes.data.filter(t => t.projectId._id === id));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotators = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      console.log('Annotators response:', response.data);
      
      // Backend already filters annotators for managers, but we keep filter for safety
      let annotatorsList = [];
      if (Array.isArray(response.data)) {
        annotatorsList = response.data.filter(u => u.role === 'annotator' && u.isActive);
      } else {
        annotatorsList = response.data || [];
      }
      
      setAnnotators(annotatorsList);
      
      if (annotatorsList.length === 0) {
        console.warn('No annotators found');
      }
    } catch (error) {
      console.error('Error fetching annotators:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Show error message to user
      const errorMsg = error.response?.data?.message || error.message || 'Không thể tải danh sách annotators';
      alert(`Lỗi: ${errorMsg}\n\nVui lòng kiểm tra:\n1. Backend server đã chạy chưa?\n2. Đã đăng nhập với quyền Manager chưa?`);
    }
  };

  const handleFileUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('projectId', id);
      formData.append('name', datasetName || `Dataset ${new Date().toLocaleString()}`);
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      await axios.post(`${API_URL}/api/datasets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setDatasetName('');
      fetchData();
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedDataset) {
      alert('Vui lòng chọn dataset');
      return;
    }
    if (!selectedAnnotators || selectedAnnotators.length === 0) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/tasks/assign`, {
        projectId: id,
        datasetId: selectedDataset,
        annotatorIds: selectedAnnotators,
      });

      alert(response.data.message || 'Phân công thành công!');
      setAssignDialogOpen(false);
      setSelectedDataset('');
      setSelectedAnnotators([]);
      fetchData();
    } catch (error) {
      console.error('Error assigning tasks:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi phân công tasks';
      alert(errorMessage);
    }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(`${API_URL}/api/projects/${id}`, editFormData);
      alert('Cập nhật project thành công!');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Lỗi khi cập nhật project: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleViewQuality = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/quality`);
      setQualityStats(response.data);
      setQualityDialogOpen(true);
    } catch (error) {
      console.error('Error fetching quality stats:', error);
      alert('Lỗi khi tải thống kê chất lượng: ' + (error.response?.data?.message || error.message));
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {project?.name}
          </Typography>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            {project?.description}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={handleViewQuality}
          >
            Chất lượng & Thống kê
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
          >
            Xuất dữ liệu
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setEditDialogOpen(true)}
          >
            Cài đặt Project
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Datasets</Typography>
              <Button
                size="small"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Files</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset._id}>
                      <TableCell>{dataset.name}</TableCell>
                      <TableCell>{dataset.totalItems}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedDataset(dataset._id);
                            setAssignDialogOpen(true);
                          }}
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Tasks Overview
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Total: ${tasks.length}`} />
              <Chip label={`Assigned: ${tasks.filter(t => t.status === 'assigned').length}`} color="default" />
              <Chip label={`In Progress: ${tasks.filter(t => t.status === 'in_progress').length}`} color="info" />
              <Chip label={`Submitted: ${tasks.filter(t => t.status === 'submitted').length}`} color="warning" />
              <Chip label={`Approved: ${tasks.filter(t => t.status === 'approved').length}`} color="success" />
              <Chip label={`Rejected: ${tasks.filter(t => t.status === 'rejected').length}`} color="error" />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tasks Table with Review Information */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          All Tasks
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Annotator</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted At</TableCell>
                <TableCell>Reviewer</TableCell>
                <TableCell>Reviewed At</TableCell>
                <TableCell>Review Comments</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Chưa có tasks nào
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task._id}>
                    <TableCell>
                      {task.annotatorId?.fullName || task.annotatorId?.username || '-'}
                    </TableCell>
                    <TableCell>{task.dataItem?.filename || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={task.status}
                        color={
                          task.status === 'approved' ? 'success' :
                          task.status === 'rejected' ? 'error' :
                          task.status === 'submitted' ? 'warning' :
                          task.status === 'in_progress' ? 'info' : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {task.submittedAt
                        ? new Date(task.submittedAt).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {task.reviewerId?.fullName || task.reviewerId?.username || '-'}
                    </TableCell>
                    <TableCell>
                      {task.reviewedAt
                        ? new Date(task.reviewedAt).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {task.reviewComments ? (
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.reviewComments}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          {task.status === 'approved' ? 'Đã phê duyệt' : '-'}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Dataset</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Dataset Name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            margin="normal"
          />
          <input
            type="file"
            multiple
            onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
            style={{ marginTop: 16 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFileUpload} variant="contained">
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Tasks</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Dataset</InputLabel>
            <Select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
            >
              {datasets.map((dataset) => (
                <MenuItem key={dataset._id} value={dataset._id}>
                  {dataset.name} ({dataset.totalItems} files)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Annotators</InputLabel>
            <Select
              multiple
              value={selectedAnnotators}
              onChange={(e) => setSelectedAnnotators(e.target.value)}
            >
              {annotators.map((annotator) => (
                <MenuItem key={annotator._id} value={annotator._id}>
                  {annotator.fullName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAssignDialogOpen(false);
            setSelectedDataset('');
            setSelectedAnnotators([]);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            variant="contained"
            disabled={!selectedDataset || selectedAnnotators.length === 0}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quality Statistics Dialog */}
      <Dialog open={qualityDialogOpen} onClose={() => setQualityDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Chất lượng & Thống kê Labeling</DialogTitle>
        <DialogContent>
          {qualityStats && (
            <Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{qualityStats.total}</Typography>
                    <Typography variant="body2" color="textSecondary">Tổng Tasks</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                    <Typography variant="h4">{qualityStats.approved}</Typography>
                    <Typography variant="body2" color="textSecondary">Đã phê duyệt</Typography>
                    <Typography variant="caption">({qualityStats.approvalRate}%)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                    <Typography variant="h4">{qualityStats.rejected}</Typography>
                    <Typography variant="body2" color="textSecondary">Bị từ chối</Typography>
                    <Typography variant="caption">({qualityStats.rejectionRate}%)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                    <Typography variant="h4">{qualityStats.submitted}</Typography>
                    <Typography variant="body2" color="textSecondary">Đang chờ review</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {Object.keys(qualityStats.errorCategories).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Phân loại lỗi</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Loại lỗi</TableCell>
                          <TableCell>Số lượng</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(qualityStats.errorCategories).map(([category, count]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell>{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {Object.keys(qualityStats.annotatorStats).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Thống kê theo Annotator</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Annotator</TableCell>
                          <TableCell>Tổng</TableCell>
                          <TableCell>Đã duyệt</TableCell>
                          <TableCell>Bị từ chối</TableCell>
                          <TableCell>Tỷ lệ duyệt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(qualityStats.annotatorStats).map(([annotator, stats]) => (
                          <TableRow key={annotator}>
                            <TableCell>{annotator}</TableCell>
                            <TableCell>{stats.total}</TableCell>
                            <TableCell>{stats.approved}</TableCell>
                            <TableCell>{stats.rejected}</TableCell>
                            <TableCell>{stats.approvalRate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQualityDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Export Format Selection Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chọn định dạng xuất dữ liệu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Chỉ xuất các tasks đã được phê duyệt (approved)
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('json');
                setExportDialogOpen(false);
              }}
            >
              JSON Format
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('csv');
                setExportDialogOpen(false);
              }}
            >
              CSV Format
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('coco');
                setExportDialogOpen(false);
              }}
            >
              COCO Format (for object detection)
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chỉnh sửa Project - Labels & Questions</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Project Name"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={editFormData.description}
            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Guidelines"
            value={editFormData.guidelines}
            onChange={(e) => setEditFormData({ ...editFormData, guidelines: e.target.value })}
            margin="normal"
            multiline
            rows={5}
            required
            helperText="Hướng dẫn cho Annotator"
          />
          
          <Accordion sx={{ mt: 2 }} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">Bộ nhãn (Labels) - BẮT BUỘC cho Annotator</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                Thêm các nhãn mà Annotator có thể chọn khi khoanh vùng (ví dụ: Dog, Cat, Person...). 
                Nếu không có labels, Annotator sẽ không thể chọn label khi khoanh vùng!
              </Alert>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newLabelSet = [...(editFormData.labelSet || []), { name: '', color: '#1976d2' }];
                  setEditFormData({ ...editFormData, labelSet: newLabelSet });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Label
              </Button>
              {editFormData.labelSet && editFormData.labelSet.length > 0 ? (
                editFormData.labelSet.map((label, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="Tên label"
                      value={label.name}
                      onChange={(e) => {
                        const newLabelSet = [...editFormData.labelSet];
                        newLabelSet[idx].name = e.target.value;
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                      placeholder="Ví dụ: Dog, Cat, Person..."
                    />
                    <TextField
                      size="small"
                      type="color"
                      label="Màu"
                      value={label.color || '#1976d2'}
                      onChange={(e) => {
                        const newLabelSet = [...editFormData.labelSet];
                        newLabelSet[idx].color = e.target.value;
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                      sx={{ width: 100 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newLabelSet = editFormData.labelSet.filter((_, i) => i !== idx);
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))
              ) : (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Chưa có labels nào! Annotator sẽ không thể chọn label khi khoanh vùng.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Câu hỏi và Đáp án - Tùy chọn</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Sau khi Annotator khoanh vùng, họ sẽ trả lời câu hỏi này bằng cách chọn đáp án A hoặc B
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newQuestions = [...(editFormData.questions || []), {
                    question: '',
                    options: [{ key: 'A', value: '' }, { key: 'B', value: '' }],
                  }];
                  setEditFormData({ ...editFormData, questions: newQuestions });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Câu hỏi
              </Button>
              {editFormData.questions && editFormData.questions.map((question, qIdx) => (
                <Box key={qIdx} sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Câu hỏi {qIdx + 1}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newQuestions = editFormData.questions.filter((_, i) => i !== qIdx);
                        setEditFormData({ ...editFormData, questions: newQuestions });
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Câu hỏi"
                    value={question.question}
                    onChange={(e) => {
                      const newQuestions = [...editFormData.questions];
                      newQuestions[qIdx].question = e.target.value;
                      setEditFormData({ ...editFormData, questions: newQuestions });
                    }}
                    margin="normal"
                  />
                  <Box sx={{ mt: 1 }}>
                    {question.options && question.options.map((option, optIdx) => (
                      <TextField
                        key={optIdx}
                        fullWidth
                        size="small"
                        label={`Đáp án ${option.key}`}
                        value={option.value}
                        onChange={(e) => {
                          const newQuestions = [...editFormData.questions];
                          newQuestions[qIdx].options[optIdx].value = e.target.value;
                          setEditFormData({ ...editFormData, questions: newQuestions });
                        }}
                        margin="normal"
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleUpdateProject} variant="contained">
            Lưu thay đổi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerProjectDetail;
