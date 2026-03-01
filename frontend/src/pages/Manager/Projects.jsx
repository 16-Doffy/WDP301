import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircularProgress,
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
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

const ManagerProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectsWithTasks, setProjectsWithTasks] = useState({});
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

      const tasksRes = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const allTasks = tasksRes.data || [];

      const tasksData = {};
      for (const project of response.data) {
        const projectTasks = allTasks.filter((t) =>
          (t.projectId?._id || t.projectId) === project._id
        );

        const annotatorNames = [...new Set(
          projectTasks.map((t) => t.annotatorId?.fullName || t.annotatorId?.username).filter(Boolean)
        )];

        const reviewerNames = [...new Set(
          projectTasks.flatMap((t) =>
            (t.reviewers || []).map((r) => r.reviewerId?.fullName || r.reviewerId?.username).filter(Boolean)
          )
        )];

        tasksData[project._id] = {
          annotators: annotatorNames,
          reviewers: reviewerNames,
        };
      }
      setProjectsWithTasks(tasksData);
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

  const getStatusChipStyles = (status) => {
    switch (status) {
      case 'active':
        return { bgcolor: 'rgba(52,211,153,0.2)', color: '#34D399' };
      case 'completed':
        return { bgcolor: 'rgba(56,189,248,0.2)', color: '#38BDF8' };
      case 'archived':
        return { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' };
      case 'draft':
      default:
        return { bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B' };
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
              Projects
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Quản lý tất cả project labeling của bạn ở một nơi.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
              <TextField
                placeholder="Search projects..."
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
            {user?.role === 'manager' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/manager/projects/create')}
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
                New Project
              </Button>
            )}
          </Stack>
        </Box>

        <Box sx={{ position: 'relative' }}>
          <TableContainer component={Paper} sx={{ ...glassCardSx, overflow: 'hidden' }}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Project Name</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Reviewer</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Annotator</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Last Updated</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10, color: 'rgba(255,255,255,0.5)' }}>
                      Không có project nào phù hợp.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => {
                    const updatedAt = project.updatedAt || project.createdAt;
                    const dateStr = updatedAt
                      ? new Date(updatedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-';

                    const projectData = projectsWithTasks[project._id] || { annotators: [], reviewers: [] };
                    const statusStyle = getStatusChipStyles(project.status);

                    return (
                      <TableRow
                        key={project._id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                        onClick={() => navigate(`/manager/projects/${project._id}`)}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={700} color="white">
                              {project.name}
                            </Typography>
                            {project.description && (
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {project.description}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={project.status?.toUpperCase() || 'DRAFT'}
                            size="small"
                            sx={{
                              bgcolor: statusStyle.bgcolor,
                              color: statusStyle.color,
                              fontWeight: 700,
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {projectData.reviewers.length === 0 ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Unassigned</Typography>
                            ) : (
                              <>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(167,139,250,0.2)',
                                    color: '#A78BFA',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(167,139,250,0.3)',
                                  }}
                                  title={projectData.reviewers[0]}
                                >
                                  {projectData.reviewers[0].split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                                </Box>
                                {projectData.reviewers.length > 1 && (
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                                    +{projectData.reviewers.length - 1}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {projectData.annotators.length === 0 ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Unassigned</Typography>
                            ) : (
                              <>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(56,189,248,0.2)',
                                    color: '#38BDF8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(56,189,248,0.3)',
                                  }}
                                  title={projectData.annotators[0]}
                                >
                                  {projectData.annotators[0].split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                                </Box>
                                {projectData.annotators.length > 1 && (
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                                    +{projectData.annotators.length - 1}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {dateStr}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                                onClick={() => navigate(`/manager/projects/${project._id}`)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                sx={{ color: '#FB7185', '&:hover': { bgcolor: 'rgba(251,113,133,0.1)' } }}
                                onClick={() => handleDelete(project._id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Showing {filteredProjects.length} of {projects.length} projects
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              Quản lý team & tiến độ labeling hiệu quả hơn.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ManagerProjects;
