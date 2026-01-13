import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import axios from 'axios';

const ManagerProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    questions: [],
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await axios.post('http://localhost:5000/api/projects', formData);
      setOpenDialog(false);
      setFormData({ name: '', description: '', guidelines: '', labelSet: [], questions: [] });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Lỗi khi tạo project: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await axios.delete(`http://localhost:5000/api/projects/${id}`);
        fetchProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      active: 'success',
      completed: 'info',
      archived: 'warning',
    };
    return colors[status] || 'default';
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          New Project
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project._id}>
                <TableCell>{project.name}</TableCell>
                <TableCell>
                  <Chip
                    label={project.status}
                    color={getStatusColor(project.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(project.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/manager/projects/${project._id}`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(project._id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Project Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Guidelines"
            value={formData.guidelines}
            onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
            margin="normal"
            multiline
            rows={5}
            required
            helperText="Hướng dẫn cho Annotator: Ví dụ: Kéo chuột để khoanh vùng đối tượng, sau đó chọn đáp án"
          />
          
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Bộ nhãn (Labels) - Tùy chọn</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Thêm các nhãn mà Annotator có thể chọn khi khoanh vùng (ví dụ: Dog, Cat, Person...)
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newLabelSet = [...(formData.labelSet || []), { name: '', color: '#1976d2' }];
                  setFormData({ ...formData, labelSet: newLabelSet });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Label
              </Button>
              {formData.labelSet && formData.labelSet.map((label, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="Tên label"
                    value={label.name}
                    onChange={(e) => {
                      const newLabelSet = [...formData.labelSet];
                      newLabelSet[idx].name = e.target.value;
                      setFormData({ ...formData, labelSet: newLabelSet });
                    }}
                  />
                  <TextField
                    size="small"
                    type="color"
                    label="Màu"
                    value={label.color || '#1976d2'}
                    onChange={(e) => {
                      const newLabelSet = [...formData.labelSet];
                      newLabelSet[idx].color = e.target.value;
                      setFormData({ ...formData, labelSet: newLabelSet });
                    }}
                    sx={{ width: 100 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      const newLabelSet = formData.labelSet.filter((_, i) => i !== idx);
                      setFormData({ ...formData, labelSet: newLabelSet });
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
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
                  const newQuestions = [...(formData.questions || []), {
                    question: '',
                    options: [{ key: 'A', value: '' }, { key: 'B', value: '' }],
                  }];
                  setFormData({ ...formData, questions: newQuestions });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Câu hỏi
              </Button>
              {formData.questions && formData.questions.map((question, qIdx) => (
                <Box key={qIdx} sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Câu hỏi {qIdx + 1}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newQuestions = formData.questions.filter((_, i) => i !== qIdx);
                        setFormData({ ...formData, questions: newQuestions });
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
                      const newQuestions = [...formData.questions];
                      newQuestions[qIdx].question = e.target.value;
                      setFormData({ ...formData, questions: newQuestions });
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
                          const newQuestions = [...formData.questions];
                          newQuestions[qIdx].options[optIdx].value = e.target.value;
                          setFormData({ ...formData, questions: newQuestions });
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
          <Button onClick={() => {
            setOpenDialog(false);
            setFormData({ name: '', description: '', guidelines: '', labelSet: [], questions: [] });
          }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerProjects;
