import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  IconButton,
  Alert,
  LinearProgress,
} from '@mui/material';
import { 
  Upload as UploadIcon, 
  Assignment as AssignmentIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  ExpandMore as ExpandMoreIcon, 
  Settings as SettingsIcon, 
  Download as DownloadIcon, 
  Assessment as AssessmentIcon, 
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon
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

const ManagerProjectDetail = () => {
  const { user } = useAuth();
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
  const [reviewers, setReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [annotatorSpecialtyFilter, setAnnotatorSpecialtyFilter] = useState('all');
  const [reviewerSpecialtyFilter, setReviewerSpecialtyFilter] = useState('all');
  const [reviewPolicy, setReviewPolicy] = useState({ mode: 'full', sampleRate: 0.1 });
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [assignMode, setAssignMode] = useState('existing');
  const [assignFiles, setAssignFiles] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    status: 'draft',
    deadline: '',
    exportFormat: 'JSON',
  });
  const [currentAnnotators, setCurrentAnnotators] = useState([]);
  const [currentReviewers, setCurrentReviewers] = useState([]);
  const [qualityStats, setQualityStats] = useState(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditTask, setAuditTask] = useState(null);
  const [previewLabelsOpen, setPreviewLabelsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedAnnotators, setExpandedAnnotators] = useState({});

  useEffect(() => {
    fetchData();
    fetchAnnotators();
    fetchReviewers();
    fetchQualityStats();
  }, [id]);

  const fetchQualityStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/quality`);
      setQualityStats(response.data);
    } catch (error) {
      console.error('Error fetching quality stats:', error);
    }
  };

  useEffect(() => {
    if (project) {
      setEditFormData({
        name: project.name || '',
        description: project.description || '',
        guidelines: project.guidelines || '',
        labelSet: project.labelSet || [],
        status: project.status || 'draft',
        deadline: project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : '',
        exportFormat: project.exportFormat || 'JSON',
      });
      setReviewPolicy({
        mode: project.reviewPolicy?.mode || 'full',
        sampleRate: typeof project.reviewPolicy?.sampleRate === 'number' ? project.reviewPolicy.sampleRate : 0.1,
      });
    }
  }, [project]);

  useEffect(() => {
    if (tasks.length > 0) {
      const annotatorIds = [...new Set(tasks.map(t => t.annotatorId?._id || t.annotatorId).filter(Boolean))];
      const reviewerIds = [...new Set(
        tasks.flatMap(t => 
          (t.reviewers || []).map(r => r.reviewerId?._id || r.reviewerId).filter(Boolean)
        )
      )];
      setCurrentAnnotators(annotatorIds);
      setCurrentReviewers(reviewerIds);
    } else {
      setCurrentAnnotators([]);
      setCurrentReviewers([]);
    }
  }, [tasks]);

  const fetchData = async () => {
    try {
      const [projectRes, datasetsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${id}`),
        axios.get(`${API_URL}/api/datasets/project/${id}`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      setProject(projectRes.data.project);
      setDatasets(datasetsRes.data);
      setTasks(tasksRes.data.filter(t => (t.projectId?._id || t.projectId) === id));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotators = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      let annotatorsList = [];
      if (Array.isArray(response.data)) {
        annotatorsList = response.data
          .filter(u => u.role === 'annotator' && u.isActive)
          .map(u => ({ ...u, specialty: u.specialty || 'general' }));
      }
      setAnnotators(annotatorsList);
    } catch (error) {
      console.error('Error fetching annotators:', error);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      let reviewerList = [];
      if (Array.isArray(response.data)) {
        reviewerList = response.data
          .filter(u => u.role === 'reviewer' && u.isActive)
          .map(u => ({ ...u, specialty: u.specialty || 'general' }));
      }
      setReviewers(reviewerList);
    } catch (error) {
      console.error('Error fetching reviewers:', error);
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
    if (!selectedAnnotators || selectedAnnotators.length === 0) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (!selectedReviewers || selectedReviewers.length === 0) {
      alert('Vui lòng chọn ít nhất một reviewer');
      return;
    }

    try {
      let datasetId = selectedDataset;

      if (assignMode === 'upload') {
        if (!assignFiles || assignFiles.length === 0) {
          alert('Vui lòng chọn ít nhất một file ảnh');
          return;
        }

        const formData = new FormData();
        formData.append('projectId', id);
        formData.append('name', datasetName || `Dataset ${new Date().toLocaleString()}`);
        assignFiles.forEach(file => {
          formData.append('files', file);
        });

        const datasetRes = await axios.post(`${API_URL}/api/datasets`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        datasetId = datasetRes.data._id;
      } else {
        if (!selectedDataset) {
          alert('Vui lòng chọn dataset hoặc upload files mới');
          return;
        }
      }

      await axios.post(`${API_URL}/api/tasks/assign`, {
        projectId: id,
        datasetId: datasetId,
        annotatorIds: selectedAnnotators,
        reviewerIds: selectedReviewers,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      alert('Phân công thành công!');
      setAssignDialogOpen(false);
      setSelectedDataset('');
      setSelectedAnnotators([]);
      setSelectedReviewers([]);
      setAssignFiles([]);
      setDatasetName('');
      setAssignMode('existing');
      fetchData();
    } catch (error) {
      console.error('Error assigning tasks:', error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(`${API_URL}/api/projects/${id}`, {
        ...editFormData,
        deadline: editFormData.deadline || undefined,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Cập nhật project thành công!');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      const approvedTasks = tasks.filter(t => t.status === 'approved');
      if (approvedTasks.length === 0) {
        alert('Không có task nào đã được phê duyệt để export.');
        return;
      }

      const response = await axios.get(`${API_URL}/api/projects/${id}/export?format=${format}`, {
        responseType: ['csv', 'yolo', 'voc'].includes(format.toLowerCase()) ? 'blob' : 'json'
      });
      
      let fileExtension = 'json';
      let mimeType = 'application/json';
      
      switch (format.toLowerCase()) {
        case 'csv': fileExtension = 'csv'; mimeType = 'text/csv'; break;
        case 'yolo': fileExtension = 'txt'; mimeType = 'text/plain'; break;
        case 'voc': fileExtension = 'xml'; mimeType = 'application/xml'; break;
        case 'coco': fileExtension = 'json'; mimeType = 'application/json'; break;
        default: fileExtension = 'json'; mimeType = 'application/json';
      }

      const blob = ['csv', 'yolo', 'voc'].includes(format.toLowerCase()) 
        ? response.data 
        : new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)], { type: mimeType });
      
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

  const annotatorWorkload = (uid) =>
    tasks.filter(t => (t.annotatorId?._id || t.annotatorId) === uid && ['assigned', 'in_progress', 'submitted'].includes(t.status)).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const overallProgress = tasks.length > 0 
    ? Math.round((tasks.filter(t => ['submitted', 'approved'].includes(t.status)).length / tasks.length) * 100)
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

        {/* Header Section */}
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

        {/* Stats Grid */}
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

        {/* Team Table Section */}
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
                {(() => {
                  const groupsMap = new Map();
                  tasks.forEach(t => {
                    const key = t.annotatorId?._id || 'unassigned';
                    if (!groupsMap.has(key)) {
                      groupsMap.set(key, { name: t.annotatorId?.fullName || t.annotatorId?.username || 'Unassigned', tasks: [], done: 0, approved: 0, rejected: 0 });
                    }
                    const g = groupsMap.get(key);
                    g.tasks.push(t);
                    if (['submitted', 'approved'].includes(t.status)) g.done++;
                    if (t.status === 'approved') g.approved++;
                    if (t.status === 'rejected') g.rejected++;
                  });

                  return Array.from(groupsMap.values()).map((g, idx) => {
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
                  });
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Dialogs - Kept original styles but could also be glassified if needed */}
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
            {['JSON', 'YOLO', 'VOC', 'COCO', 'CSV'].map(fmt => (
              <Button key={fmt} variant="outlined" fullWidth onClick={() => { handleExport(fmt.toLowerCase()); setExportDialogOpen(false); }}>{fmt} Format</Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setExportDialogOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerProjectDetail;
