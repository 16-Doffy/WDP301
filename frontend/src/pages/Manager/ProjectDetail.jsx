import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
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
  Stack,
  IconButton,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const glassCardSx = {
  borderRadius: 3,
  boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(10px)',
  color: 'rgba(255,255,255,0.92)',
};

const ManagerProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    status: 'draft',
    deadline: '',
    exportFormat: 'JSON',
  });

  const [currentAnnotators, setCurrentAnnotators] = useState([]);
  const [currentReviewers, setCurrentReviewers] = useState([]);
  const [qualityStats, setQualityStats] = useState(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    fetchUsers();
    fetchQualityStats();
  }, [id]);

  useEffect(() => {
    if (project) {
      setEditFormData({
        name: project.name || '',
        description: project.description || '',
        guidelines: project.guidelines || '',
        status: project.status || 'draft',
        deadline: project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : '',
        exportFormat: project.exportFormat || 'JSON',
      });
    }
  }, [project]);

  useEffect(() => {
    if (tasks.length > 0) {
      const annotatorIds = [...new Set(tasks.map((t) => t.annotatorId?._id || t.annotatorId).filter(Boolean))];
      const reviewerIds = [
        ...new Set(
          tasks.flatMap((t) =>
            (t.reviewers || []).map((r) => r.reviewerId?._id || r.reviewerId).filter(Boolean)
          )
        ),
      ];
      setCurrentAnnotators(annotatorIds);
      setCurrentReviewers(reviewerIds);
    } else {
      setCurrentAnnotators([]);
      setCurrentReviewers([]);
    }
  }, [tasks]);

  const groupedByAnnotator = useMemo(() => {
    const groupsMap = new Map();
    tasks.forEach((t) => {
      const key = t.annotatorId?._id || 'unassigned';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          name: t.annotatorId?.fullName || t.annotatorId?.username || 'Unassigned',
          tasks: [],
          done: 0,
          approved: 0,
          rejected: 0,
        });
      }
      const g = groupsMap.get(key);
      g.tasks.push(t);
      if (['submitted', 'approved'].includes(t.status)) g.done += 1;
      if (t.status === 'approved') g.approved += 1;
      if (t.status === 'rejected') g.rejected += 1;
    });

    return Array.from(groupsMap.values());
  }, [tasks]);

  const fetchData = async () => {
    try {
      const [projectRes, datasetsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${id}`),
        axios.get(`${API_URL}/api/datasets/project/${id}`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      setProject(projectRes.data.project || projectRes.data);
      setDatasets(datasetsRes.data || []);
      setTasks((tasksRes.data || []).filter((t) => (t.projectId?._id || t.projectId) === id));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      const userList = Array.isArray(response.data) ? response.data : [];
      setAnnotators(userList.filter((u) => u.role === 'annotator' && u.isActive));
      setReviewers(
        userList
          .filter((u) => u.role === 'reviewer' && u.isActive)
          .map((u) => ({ ...u, specialty: u.specialty || 'general' }))
      );
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchQualityStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/quality`);
      setQualityStats(response.data);
    } catch (error) {
      console.error('Error fetching quality stats:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedDataset) {
      alert('Vui lòng chọn dataset');
      return;
    }
    if (!selectedAnnotators.length) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (!selectedReviewers.length) {
      alert('Vui lòng chọn ít nhất một reviewer');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/tasks/assign`,
        {
          projectId: id,
          datasetId: selectedDataset,
          annotatorIds: selectedAnnotators,
          reviewerIds: selectedReviewers,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      alert('Phân công thành công!');
      setAssignDialogOpen(false);
      setSelectedDataset('');
      setSelectedAnnotators([]);
      setSelectedReviewers([]);
      fetchData();
      fetchQualityStats();
    } catch (error) {
      console.error('Error assigning tasks:', error);
      alert(`Lỗi: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(
        `${API_URL}/api/projects/${id}`,
        {
          ...editFormData,
          deadline: editFormData.deadline || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      alert('Cập nhật project thành công!');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating project:', error);
      alert(`Lỗi: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      const approvedTasks = tasks.filter((t) => t.status === 'approved');
      if (approvedTasks.length === 0) {
        alert('Không có task nào đã được phê duyệt để export.');
        return;
      }

      const response = await axios.get(`${API_URL}/api/projects/${id}/export?format=${format}`, {
        responseType: ['csv', 'yolo', 'voc'].includes(format.toLowerCase()) ? 'blob' : 'json',
      });

      let fileExtension = 'json';
      let mimeType = 'application/json';

      switch (format.toLowerCase()) {
        case 'csv':
          fileExtension = 'csv';
          mimeType = 'text/csv';
          break;
        case 'yolo':
          fileExtension = 'txt';
          mimeType = 'text/plain';
          break;
        case 'voc':
          fileExtension = 'xml';
          mimeType = 'application/xml';
          break;
        case 'coco':
          fileExtension = 'json';
          mimeType = 'application/json';
          break;
        default:
          break;
      }

      const blob = ['csv', 'yolo', 'voc'].includes(format.toLowerCase())
        ? response.data
        : new Blob([
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2),
          ], { type: mimeType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_export_${Date.now()}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(`Đã xuất ${approvedTasks.length} tasks thành công!`);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const overallProgress =
    tasks.length > 0
      ? Math.round((tasks.filter((t) => ['submitted', 'approved'].includes(t.status)).length / tasks.length) * 100)
      : 0;

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

        <Box sx={{ position: 'relative', mb: 4 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <IconButton onClick={() => navigate('/manager/projects')} sx={{ color: 'white' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Projects / {project?.name}
            </Typography>
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 300 }}>
              <Typography variant="h3" fontWeight={900} sx={{ color: 'white', mb: 1, letterSpacing: -1 }}>
                {project?.name}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.82)', maxWidth: 800 }}>
                {project?.description || 'No description provided.'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={() => setQualityDialogOpen(true)}
                sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
              >
                Analytics
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => setExportDialogOpen(true)}
                sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
              >
                Export
              </Button>
              <Button
                variant="contained"
                startIcon={<SettingsIcon />}
                onClick={() => setEditDialogOpen(true)}
                sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, bgcolor: 'rgba(15,23,42,0.3)', '&:hover': { bgcolor: 'rgba(15,23,42,0.4)' } }}
              >
                Settings
              </Button>
            </Stack>
          </Box>
        </Box>

        <Grid container spacing={3} sx={{ position: 'relative', mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Team Members</Typography>
                <Typography variant="h4" fontWeight={800}>{currentAnnotators.length + currentReviewers.length}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Active personnel</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Progress</Typography>
                <Typography variant="h4" fontWeight={800}>{overallProgress}%</Typography>
                <LinearProgress variant="determinate" value={overallProgress} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#34D399' } }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Quality</Typography>
                <Typography variant="h4" fontWeight={800}>{qualityStats?.approvalRate || 0}%</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Avg. Approval Rate</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Status</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={project?.status?.toUpperCase() || 'DRAFT'}
                    sx={{ bgcolor: project?.status === 'active' ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)', color: project?.status === 'active' ? '#34D399' : '#F59E0B', fontWeight: 800 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={800} color="white">Team Performance</Typography>
            <Button
              variant="contained"
              startIcon={<AssignmentIcon />}
              onClick={() => setAssignDialogOpen(true)}
              sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 800, bgcolor: 'rgba(15,23,42,0.3)', '&:hover': { bgcolor: 'rgba(15,23,42,0.4)' } }}
            >
              Assign New Tasks
            </Button>
          </Box>

          <TableContainer component={Paper} sx={glassCardSx}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Annotator</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Workload</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Progress</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Quality</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedByAnnotator.map((g, idx) => {
                  const progress = Math.round((g.done / g.tasks.length) * 100);
                  const reviewed = g.approved + g.rejected;
                  const quality = reviewed > 0 ? Math.round((g.approved / reviewed) * 100) : 0;

                  return (
                    <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="white">{g.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>{g.tasks.length} tasks</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={progress} sx={{ width: 60, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />
                          <Typography variant="caption" sx={{ color: 'white' }}>{progress}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={`${quality}%`} size="small" sx={{ bgcolor: quality >= 80 ? 'rgba(52,211,153,0.2)' : 'rgba(251,113,133,0.2)', color: quality >= 80 ? '#34D399' : '#FB7185', fontWeight: 800 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          sx={{ color: '#38BDF8', fontWeight: 700 }}
                          onClick={() => navigate(`/manager/projects/${id}/annotator/${g.tasks[0]?.annotatorId?._id}`)}
                        >
                          DETAILS
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      <Dialog open={qualityDialogOpen} onClose={() => setQualityDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Project Analytics</DialogTitle>
        <DialogContent dividers>
          {qualityStats && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center' }}><Typography variant="h4">{qualityStats.total}</Typography><Typography variant="caption">Total Tasks</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ecfdf5' }}><Typography variant="h4" color="success.main">{qualityStats.approved}</Typography><Typography variant="caption">Approved</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fef2f2' }}><Typography variant="h4" color="error.main">{qualityStats.rejected}</Typography><Typography variant="caption">Rejected</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fffbeb' }}><Typography variant="h4" color="warning.main">{qualityStats.submitted}</Typography><Typography variant="caption">Pending Review</Typography></Paper></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setQualityDialogOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Export Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3 }}>Choose your preferred format for export.</Typography>
          <Stack spacing={2}>
            {['JSON', 'YOLO', 'VOC', 'COCO', 'CSV'].map((fmt) => (
              <Button key={fmt} variant="outlined" fullWidth onClick={() => { handleExport(fmt.toLowerCase()); setExportDialogOpen(false); }}>{fmt} Format</Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setExportDialogOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign New Tasks</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Dataset</InputLabel>
              <Select
                value={selectedDataset}
                label="Dataset"
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                {datasets.map((ds) => (
                  <MenuItem key={ds._id} value={ds._id}>
                    {ds.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Annotators</InputLabel>
              <Select
                multiple
                value={selectedAnnotators}
                label="Annotators"
                onChange={(e) => setSelectedAnnotators(e.target.value)}
                renderValue={(selected) =>
                  annotators
                    .filter((a) => selected.includes(a._id))
                    .map((a) => a.fullName || a.username)
                    .join(', ')
                }
              >
                {annotators.map((a) => (
                  <MenuItem key={a._id} value={a._id}>
                    <Checkbox checked={selectedAnnotators.indexOf(a._id) > -1} />
                    <ListItemText primary={a.fullName || a.username} secondary={a.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Reviewers</InputLabel>
              <Select
                multiple
                value={selectedReviewers}
                label="Reviewers"
                onChange={(e) => setSelectedReviewers(e.target.value)}
                renderValue={(selected) =>
                  reviewers
                    .filter((r) => selected.includes(r._id))
                    .map((r) => r.fullName || r.username)
                    .join(', ')
                }
              >
                {reviewers.map((r) => (
                  <MenuItem key={r._id} value={r._id}>
                    <Checkbox checked={selectedReviewers.indexOf(r._id) > -1} />
                    <ListItemText primary={r.fullName || r.username} secondary={r.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleAssign}>Assign</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <TextField
              label="Name"
              fullWidth
              value={editFormData.name}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={editFormData.description}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
            <TextField
              label="Guidelines"
              fullWidth
              multiline
              rows={4}
              value={editFormData.guidelines}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, guidelines: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Deadline"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editFormData.deadline}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, deadline: e.target.value }))}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={editFormData.status}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Export Format</InputLabel>
                <Select
                  label="Export Format"
                  value={editFormData.exportFormat}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, exportFormat: e.target.value }))}
                >
                  <MenuItem value="JSON">JSON</MenuItem>
                  <MenuItem value="YOLO">YOLO</MenuItem>
                  <MenuItem value="VOC">VOC</MenuItem>
                  <MenuItem value="COCO">COCO</MenuItem>
                  <MenuItem value="CSV">CSV</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleUpdateProject}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerProjectDetail;
