<<<<<<< HEAD
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    questions: [],
    status: 'draft',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await axios.post(`${API_URL}/api/projects`, formData);
      setOpenDialog(false);
      setFormData({ name: '', description: '', guidelines: '', labelSet: [], questions: [], status: 'draft' });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Lỗi khi tạo project: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await axios.delete(`${API_URL}/api/projects/${id}`);
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
        {user?.role === 'manager' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/manager/projects/create')}
          >
            New Project
          </Button>
        )}
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
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status || 'draft'}
              label="Status"
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
          
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
            setFormData({ name: '', description: '', guidelines: '', labelSet: [], questions: [], status: 'draft' });
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
=======
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await axios.delete(`${API_URL}/api/projects/${id}`);
        fetchProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const getStatusBadgeClasses = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border border-green-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'archived':
        return 'bg-gray-50 text-gray-600 border border-gray-200';
      case 'draft':
      default:
        return 'bg-yellow-50 text-yellow-800 border border-yellow-200';
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const lower = searchTerm.toLowerCase();
    return projects.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(lower) || desc.includes(lower);
    });
  }, [projects, searchTerm]);

  const getHealthInfo = (status) => {
    switch (status) {
      case 'active':
        return { label: '88%', color: 'border-green-500 text-green-600' };
      case 'completed':
        return { label: '100%', color: 'border-blue-500 text-blue-600' };
      case 'archived':
        return { label: '85%', color: 'border-gray-400 text-gray-500' };
      case 'draft':
      default:
        return { label: '65%', color: 'border-yellow-500 text-yellow-600' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Professional Projects List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý tất cả project labeling của bạn ở một nơi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 pr-3 py-2 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white min-w-[220px]"
            />
          </div>
          {user?.role === 'manager' && (
            <button
              type="button"
              onClick={() => navigate('/manager/projects/create')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <AddIcon sx={{ fontSize: 18 }} />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100 flex text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="w-3/12">Project Name</div>
            <div className="w-2/12">Status</div>
            <div className="w-2/12">Health Score</div>
            <div className="w-2/12">Members</div>
            <div className="w-2/12">Last Updated</div>
            <div className="w-1/12 text-right pr-2">Actions</div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Không có project nào phù hợp.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredProjects.map((project) => {
                const updatedAt = project.updatedAt || project.createdAt;
                const dateStr = updatedAt
                  ? new Date(updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-';

                const initials =
                  (user?.fullName || user?.username || 'PM')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();

                return (
                  <li
                    key={project._id}
                    className="px-6 py-4 flex items-center text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/manager/projects/${project._id}`)}
                  >
                    {/* Project name */}
                    <div className="w-3/12 flex flex-col">
                      <span className="font-medium text-gray-900">{project.name}</span>
                      {project.description && (
                        <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {project.description}
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-2/12">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(
                          project.status
                        )}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {project.status?.toUpperCase() || 'DRAFT'}
                      </span>
                    </div>

                    {/* Health score */}
                    <div className="w-2/12 flex items-center">
                      {(() => {
                        const { label, color } = getHealthInfo(project.status);
                        return (
                          <span
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border-2 text-xs font-semibold ${color}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Members */}
                    <div className="w-2/12 flex items-center gap-1">
                      <div
                        className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[11px] font-semibold"
                        onClick={(e) => e.stopPropagation()}
                        title={user?.fullName || user?.username || 'Project Manager'}
                      >
                        {initials}
                      </div>
                    </div>

                    {/* Last updated */}
                    <div className="w-2/12 text-gray-500 text-xs">{dateStr}</div>

                    {/* Actions */}
                    <div className="w-1/12 flex items-center justify-end gap-2 pr-2">
                      <div
                        className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[11px] font-semibold"
                        onClick={(e) => e.stopPropagation()}
                        title={user?.fullName || user?.username || 'Project Manager'}
                      >
                        {initials}
                      </div>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project._id);
                        }}
                        title="Xóa project"
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer summary */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
            <span>
              Showing {filteredProjects.length} of {projects.length} projects
            </span>
            <span>Quản lý team & tiến độ labeling hiệu quả hơn.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerProjects;
>>>>>>> NDuy
