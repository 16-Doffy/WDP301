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
import { Upload as UploadIcon, Assignment as AssignmentIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon, Settings as SettingsIcon } from '@mui/icons-material';
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
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setEditDialogOpen(true)}
        >
          Cài đặt Project (Labels & Questions)
        </Button>
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
            </Box>
          </Paper>
        </Grid>
      </Grid>

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
