import React, { useEffect, useMemo, useState } from 'react';
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

const panelSx = {
  borderRadius: 3,
  boxShadow: '0 16px 32px rgba(0,0,0,0.35)',
  background: '#111827',
  border: '1px solid #374151',
  color: '#e5e7eb',
};

const tableWrapSx = {
  ...panelSx,
  overflow: 'hidden',
  '& .MuiTableCell-root': {
    borderColor: '#374151',
  },
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
      setProjects(response.data || []);

      const tasksRes = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const allTasks = tasksRes.data || [];

      const tasksData = {};
      for (const project of response.data || []) {
        const projectTasks = allTasks.filter((t) => (t.projectId?._id || t.projectId) === project._id);

        const annotatorNames = [
          ...new Set(projectTasks.map((t) => t.annotatorId?.fullName || t.annotatorId?.username).filter(Boolean)),
        ];

        const reviewerNames = [
          ...new Set(
            projectTasks.flatMap((t) =>
              (t.reviewers || []).map((r) => r.reviewerId?.fullName || r.reviewerId?.username).filter(Boolean)
            )
          ),
        ];

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
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${id}`);
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const getStatusChipStyles = (status) => {
    switch (status) {
      case 'active':
        return { bgcolor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' };
      case 'completed':
        return { bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' };
      case 'archived':
        return { bgcolor: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.25)' };
      default:
        return { bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' };
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', background: '#0f172a' }}>
      <Box sx={panelSx}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            mb: 3,
            p: { xs: 2, sm: 3 },
            gap: 2,
            borderBottom: '1px solid #374151',
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: '#e5e7eb', mb: 0.5 }}>
              Projects
            </Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Quản lý tất cả project labeling của bạn ở một nơi.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              placeholder="Search projects..."
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  bgcolor: '#1f2937',
                  color: '#e5e7eb',
                  '& fieldset': { borderColor: '#374151' },
                  '&:hover fieldset': { borderColor: '#4b5563' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                },
                '& .MuiInputBase-input::placeholder': { color: '#6b7280', opacity: 1 },
              }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} fontSize="small" />,
              }}
            />

            {user?.role === 'manager' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/manager/projects/create')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 2.5,
                  fontWeight: 800,
                  bgcolor: '#2563eb',
                  color: 'white',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                New Project
              </Button>
            )}
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <TableContainer component={Paper} sx={tableWrapSx}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#111827' }}>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 700 }}>Project Name</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 700 }}>Reviewer</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 700 }}>Annotator</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 700 }}>Last Updated</TableCell>
                  <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10, color: '#9ca3af' }}>
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
                          '&:hover': { bgcolor: '#1f2937' },
                        }}
                        onClick={() => navigate(`/manager/projects/${project._id}`)}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color: '#e5e7eb' }}>
                              {project.name}
                            </Typography>
                            {project.description && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#9ca3af',
                                  display: 'block',
                                  maxWidth: 250,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {project.description}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={project.status?.toUpperCase() || 'DRAFT'}
                              size="small"
                              sx={{ ...statusStyle, fontWeight: 700 }}
                            />
                            <Chip
                              label={`Review: ${(project?.projectReview?.status || project?.projectReviewSnapshot?.suggestedStatus || 'pending').toUpperCase()}`}
                              size="small"
                              sx={{
                                bgcolor: (project?.projectReview?.status || project?.projectReviewSnapshot?.suggestedStatus) === 'approved'
                                  ? 'rgba(16,185,129,0.18)'
                                  : (project?.projectReview?.status || project?.projectReviewSnapshot?.suggestedStatus) === 'rejected'
                                    ? 'rgba(239,68,68,0.18)'
                                    : 'rgba(245,158,11,0.18)',
                                color: (project?.projectReview?.status || project?.projectReviewSnapshot?.suggestedStatus) === 'approved'
                                  ? '#34d399'
                                  : (project?.projectReview?.status || project?.projectReviewSnapshot?.suggestedStatus) === 'rejected'
                                    ? '#f87171'
                                    : '#fbbf24',
                                border: '1px solid #374151',
                                fontWeight: 700,
                              }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {projectData.reviewers.length === 0 ? (
                              <Typography variant="caption" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
                                Unassigned
                              </Typography>
                            ) : (
                              <>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(167,139,250,0.15)',
                                    color: '#a78bfa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(167,139,250,0.3)',
                                  }}
                                  title={projectData.reviewers[0]}
                                >
                                  {projectData.reviewers[0]
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </Box>
                                {projectData.reviewers.length > 1 && (
                                  <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
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
                              <Typography variant="caption" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
                                Unassigned
                              </Typography>
                            ) : (
                              <>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(59,130,246,0.15)',
                                    color: '#60a5fa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(59,130,246,0.3)',
                                  }}
                                  title={projectData.annotators[0]}
                                >
                                  {projectData.annotators[0]
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </Box>
                                {projectData.annotators.length > 1 && (
                                  <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                                    +{projectData.annotators.length - 1}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            {dateStr}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                sx={{ color: '#9ca3af', '&:hover': { bgcolor: '#1f2937', color: '#e5e7eb' } }}
                                onClick={() => navigate(`/manager/projects/${project._id}`)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                sx={{ color: '#fb7185', '&:hover': { bgcolor: 'rgba(251,113,133,0.12)' } }}
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
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Showing {filteredProjects.length} of {projects.length} projects
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontStyle: 'italic' }}>
              Quản lý team & tiến độ labeling hiệu quả hơn.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ManagerProjects;
