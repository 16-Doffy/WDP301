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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  ArrowBack as ArrowBackIcon,
  Label as LabelIcon,
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageViewer from '../../components/ImageViewer';

const pageSx = { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' };

const panelSx = {
  borderRadius: 3,
  boxShadow: '0 18px 36px rgba(0,0,0,0.35)',
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#e2e8f0',
};

const cardSx = {
  borderRadius: 3,
  boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#e2e8f0',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#0f172a',
    color: '#e2e8f0',
    borderRadius: '10px',
    '& fieldset': { borderColor: '#475569' },
    '&:hover fieldset': { borderColor: '#64748b' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
  '& .MuiInputBase-input::placeholder': { color: '#94a3b8', opacity: 1 },
};

const modalPaperSx = {
  bgcolor: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: '16px',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
};

const primaryBtnSx = {
  borderRadius: 2,
  textTransform: 'none',
  fontWeight: 700,
  bgcolor: '#2563eb',
  color: 'white',
  '&:hover': { bgcolor: '#3b82f6' },
};

const secondaryBtnSx = {
  borderRadius: 2,
  textTransform: 'none',
  fontWeight: 700,
  bgcolor: '#334155',
  color: '#e2e8f0',
  border: '1px solid #475569',
  '&:hover': { bgcolor: '#475569' },
};

const getFullImageUrl = (path) => {
  const baseUrl = API_URL.replace(/\/+$/, '');
  if (!path) return '';
  const relativePath = path.replace(/^\/+/, '');
  return baseUrl + '/' + relativePath;
};

const getLabelColor = (labelName) => {
  const label = labelName?.toLowerCase() || '';
  
  // Predefined colors for common labels
  const predefinedColors = {
    'chó': '#3b82f6',
    'dog': '#3b82f6',
    'mèo': '#22c55e',
    'cat': '#22c55e',
    'other': '#8b5cf6',
    'car': '#f59e0b',
    'xe': '#f59e0b',
  };
  
  // Return predefined color if exists
  if (predefinedColors[label]) {
    return predefinedColors[label];
  }
  
  // Generate color dynamically based on label name hash
  const colors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
  ];
  
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

const ManagerProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedLabelFilter, setSelectedLabelFilter] = useState('all');
  const [showLabelsDialogOpen, setShowLabelsDialogOpen] = useState(false);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedDatasetType, setSelectedDatasetType] = useState('all');

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

  // Extract unique labels from APPROVED tasks (tasks approved by reviewer)
  const approvedLabels = useMemo(() => {
    const labelSet = new Set();
    const approvedTasksData = tasks.filter(t => t.status === 'approved');
    
    console.log('Total tasks:', tasks.length);
    console.log('Approved tasks:', approvedTasksData.length);
    
    approvedTasksData.forEach((t, idx) => {
      console.log(`Task ${idx}:`, t);
      
      let labels = [];
      
      // Try different possible structures
      // Structure 1: t.labels.objects
      if (t.labels?.objects && Array.isArray(t.labels.objects)) {
        labels = t.labels.objects;
      }
      // Structure 2: t.labels as array
      else if (Array.isArray(t.labels)) {
        labels = t.labels;
      }
      // Structure 3: t.annotations with approved status
      else if (t.annotations) {
        const approvedAnn = t.annotations.find(a => a.status === 'approved');
        if (approvedAnn?.labels?.objects) {
          labels = approvedAnn.labels.objects;
        } else if (Array.isArray(approvedAnn?.labels)) {
          labels = approvedAnn.labels;
        }
      }
      
      console.log(`Task ${idx} labels:`, labels);
      
      labels.forEach((obj) => {
        if (obj.label) {
          labelSet.add(obj.label);
        } else if (typeof obj === 'string') {
          labelSet.add(obj);
        }
      });
    });
    
    console.log('Approved Labels found:', Array.from(labelSet));
    return Array.from(labelSet);
  }, [tasks]);

  // Get approved tasks with their labels
  const approvedTasks = useMemo(() => {
    const filtered = tasks.filter((t) => t.status === 'approved');
    console.log('Filtered approved tasks:', filtered);
    return filtered;
  }, [tasks]);

  // Filter items by selected label
  const filteredItems = useMemo(() => {
    if (selectedLabelFilter === 'all') return approvedTasks;
    return approvedTasks.filter((t) => {
      let labels = [];
      
      if (t.labels?.objects && Array.isArray(t.labels.objects)) {
        labels = t.labels.objects;
      } else if (Array.isArray(t.labels)) {
        labels = t.labels;
      } else if (t.annotations) {
        const approvedAnn = t.annotations.find(a => a.status === 'approved');
        if (approvedAnn?.labels?.objects) {
          labels = approvedAnn.labels.objects;
        } else if (Array.isArray(approvedAnn?.labels)) {
          labels = approvedAnn.labels;
        }
      }
      
      return labels.some((obj) => {
        if (obj.label === selectedLabelFilter) return true;
        if (obj === selectedLabelFilter) return true;
        return false;
      });
    });
  }, [approvedTasks, selectedLabelFilter]);

  const groupedByAnnotator = useMemo(() => {
    const groupsMap = new Map();
    tasks.forEach((t) => {
      const key = t.annotatorId?._id || 'unassigned';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          id: key,
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

  const groupedByReviewer = useMemo(() => {
    const groupsMap = new Map();
    tasks.forEach((t) => {
      (t.reviewers || []).forEach((rv) => {
        const rid = rv.reviewerId?._id || rv.reviewerId;
        if (!rid) return;
        const key = rid.toString();
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            id: key,
            name: rv.reviewerId?.fullName || rv.reviewerId?.username || 'Reviewer',
            assigned: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
          });
        }
        const g = groupsMap.get(key);
        g.assigned += 1;
        if (rv.status === 'approved') g.approved += 1;
        else if (rv.status === 'rejected') g.rejected += 1;
        else g.pending += 1;
      });
    });
    return Array.from(groupsMap.values());
  }, [tasks]);

  const filteredDatasets = useMemo(() => {
    if (selectedDatasetType === 'all') return datasets;
    return datasets.filter((ds) => ds.type === selectedDatasetType);
  }, [datasets, selectedDatasetType]);

  // Get approved datasets (datasets that have approved tasks)
  const approvedDatasets = useMemo(() => {
    const datasetIds = new Set();
    tasks.forEach((t) => {
      if (t.status === 'approved') {
        // Check multiple possible paths for datasetId
        let dsId = null;
        if (t.datasetItemId?.datasetId) {
          dsId = t.datasetItemId.datasetId._id || t.datasetItemId.datasetId;
        } else if (t.datasetId?._id) {
          dsId = t.datasetId._id;
        } else if (t.datasetId) {
          dsId = t.datasetId;
        }
        if (dsId) datasetIds.add(dsId);
      }
    });
    return datasets.filter((ds) => datasetIds.has(ds._id));
  }, [datasets, tasks]);

  // Get approved datasets with their labels
  const approvedDatasetsWithLabels = useMemo(() => {
    return approvedDatasets.map(ds => {
      const dsId = ds._id;
      const approvedTasksInDs = tasks.filter(t => {
        if (t.status !== 'approved') return false;
        
        // Check multiple possible paths for datasetId
        let taskDsId = null;
        if (t.datasetItemId?.datasetId) {
          taskDsId = t.datasetItemId.datasetId._id || t.datasetItemId.datasetId;
        } else if (t.datasetId?._id) {
          taskDsId = t.datasetId._id;
        } else if (t.datasetId) {
          taskDsId = t.datasetId;
        }
        return taskDsId === dsId;
      });
      
      const labelSet = new Set();
      approvedTasksInDs.forEach(t => {
        let labels = [];
        if (t.labels?.objects && Array.isArray(t.labels.objects)) {
          labels = t.labels.objects;
        } else if (Array.isArray(t.labels)) {
          labels = t.labels;
        } else if (t.dataItem?.labels?.objects) {
          labels = t.dataItem.labels.objects;
        } else if (Array.isArray(t.dataItem?.labels)) {
          labels = t.dataItem.labels;
        }
        labels.forEach(obj => {
          if (obj.label) labelSet.add(obj.label);
          else if (typeof obj === 'string') labelSet.add(obj);
        });
      });
      
      return {
        ...ds,
        approvedCount: approvedTasksInDs.length,
        labels: Array.from(labelSet)
      };
    });
  }, [approvedDatasets, tasks]);

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
    if (!selectedDataset) return alert('Vui lòng chọn dataset');
    if (!selectedAnnotators.length) return alert('Vui lòng chọn ít nhất một annotator');
    if (!selectedReviewers.length) return alert('Vui lòng chọn ít nhất một reviewer');

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
            Authorization: `Bearer ${(sessionStorage.getItem('token') || localStorage.getItem('token'))}`,
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
      const approvedTasksList = tasks.filter((t) => t.status === 'approved');
      if (approvedTasksList.length === 0) {
        alert('Không có task nào đã được phê duyệt để export.');
        return;
      }

      const response = await axios.get(`${API_URL}/api/projects/${id}/export`, {
        params: { format },
        responseType: 'blob',
      });

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const extensionMap = {
        'application/json': 'json',
        'text/plain': 'txt',
        'application/xml': 'xml',
        'text/csv': 'csv',
      };
      const fileExtension = extensionMap[contentType] || format.toLowerCase();
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_export_${Date.now()}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(`Đã xuất ${approvedTasksList.length} tasks thành công!`);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px" sx={{ background: '#0f172a' }}>
        <CircularProgress />
      </Box>
    );
  }

  const overallProgress =
    tasks.length > 0
      ? Math.round((tasks.filter((t) => ['submitted', 'approved'].includes(t.status)).length / tasks.length) * 100)
      : 0;

  const renderOverview = () => (
    <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#94a3b8' }}>Team Members</Typography>
              <Typography variant="h4" fontWeight={800}>{currentAnnotators.length + currentReviewers.length}</Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Active personnel</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#94a3b8' }}>Progress</Typography>
              <Typography variant="h4" fontWeight={800}>{overallProgress}%</Typography>
              <LinearProgress variant="determinate" value={overallProgress} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#94a3b8' }}>Review Pass Rate</Typography>
              <Typography variant="h4" fontWeight={800}>{qualityStats?.approvalRate || 0}%</Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Tỷ lệ task được reviewer duyệt</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#94a3b8' }}>Status</Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip label={project?.status?.toUpperCase() || 'DRAFT'} sx={{ bgcolor: project?.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(51,65,85,0.8)', color: project?.status === 'active' ? '#34d399' : '#94a3b8', fontWeight: 800 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
          </Grid>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={700} color="#e2e8f0">Team Performance</Typography>
              <Button variant="contained" startIcon={<AssignmentIcon />} onClick={() => setAssignDialogOpen(true)} sx={primaryBtnSx}>Phân công task từ dataset</Button>
            </Box>

            <Box sx={{ mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip label={`Annotators assigned: ${groupedByAnnotator.length}`} sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontWeight: 700 }} />
              <Chip label={`Reviewers assigned: ${groupedByReviewer.length}`} sx={{ bgcolor: 'rgba(16,185,129,0.2)', color: '#6ee7b7', fontWeight: 700 }} />
            </Box>

            <TableContainer component={Paper} sx={{ ...cardSx, '& .MuiTableCell-root': { borderColor: '#334155' } }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: '#0f172a' }}>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Annotator</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Workload</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Progress</TableCell>
                    <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Quality</TableCell>
                    <TableCell align="right" sx={{ color: '#94a3b8', fontWeight: 700 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedByAnnotator.map((g, idx) => {
                const progress = Math.min(Math.round((g.done / g.tasks.length) * 100), 100);
                    const reviewed = g.approved + g.rejected;
                    const quality = reviewed > 0 ? Math.round((g.approved / reviewed) * 100) : 0;

                    return (
                      <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: '#0f172a' } }}>
                        <TableCell><Typography variant="body2" fontWeight={700} color="#e2e8f0">{g.name}</Typography></TableCell>
                        <TableCell sx={{ color: '#94a3b8' }}>{g.tasks.length} tasks</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={progress} sx={{ width: 80, height: 5, borderRadius: 2, bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' } }} />
                            <Typography variant="caption" sx={{ color: '#e2e8f0' }}>{progress}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell><Chip label={`${quality}%`} size="small" sx={{ bgcolor: quality >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: quality >= 80 ? '#34d399' : '#f87171', fontWeight: 800 }} /></TableCell>
                        <TableCell align="right"><Button size="small" sx={{ color: '#60a5fa', fontWeight: 700 }} onClick={() => navigate(`/manager/projects/${id}/annotator/${g.tasks[0]?.annotatorId?._id}`)}>DETAILS</Button></TableCell>
                      </TableRow>
                );
              })}
                </TableBody>
              </Table>
            </TableContainer>
      </Box>
    </>
  );

  const renderItems = () => (
    <Box>
      {/* Hiển thị datasets đã được duyệt với labels */}
      {approvedDatasetsWithLabels.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} color="#e2e8f0" sx={{ mb: 2 }}>
            Datasets đã duyệt ({approvedDatasetsWithLabels.length})
          </Typography>
          <Grid container spacing={2}>
            {approvedDatasetsWithLabels.map((ds) => (
              <Grid item xs={12} sm={6} md={3} key={ds._id}>
                <Card sx={{
                  ...cardSx,
                  border: '2px solid #22c55e',
                  '&:hover': { borderColor: '#34d399' }
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'rgba(34,197,94,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Typography sx={{ color: '#22c55e', fontWeight: 700 }}>DS</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="#e2e8f0">
                          {ds.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                          {ds.approvedCount} items đã duyệt
                        </Typography>
                      </Box>
                      <Chip 
                        label="Approved" 
                        size="small"
                        sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: '#22c55e', fontWeight: 700 }} 
                      />
                    </Box>
                    
                    {/* Hiển thị các nhãn đã duyệt của dataset */}
                    {ds.labels.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>
                          Nhãn đã duyệt:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {ds.labels.map((label, idx) => (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              sx={{
                                bgcolor: getLabelColor(label),
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" fontWeight={700} color="#e2e8f0">
          Items đã duyệt ({approvedTasks.length})
        </Typography>
        
        {/* Hiển thị các nhãn đã duyệt */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {approvedLabels.length > 0 && (
            <Typography variant="body2" sx={{ color: '#94a3b8', mr: 1 }}>Nhãn đã duyệt:</Typography>
          )}
          {approvedLabels.map((label) => {
            const count = approvedTasks.filter((t) => {
              let taskLabels = [];
              if (t.labels?.objects && Array.isArray(t.labels.objects)) {
                taskLabels = t.labels.objects;
              } else if (Array.isArray(t.labels)) {
                taskLabels = t.labels;
              } else if (t.annotations) {
                const approvedAnn = t.annotations.find(a => a.status === 'approved');
                if (approvedAnn?.labels?.objects) {
                  taskLabels = approvedAnn.labels.objects;
                } else if (Array.isArray(approvedAnn?.labels)) {
                  taskLabels = approvedAnn.labels;
                }
              }
              return taskLabels.some((obj) => {
                const labelName = obj.label || obj;
                return labelName === label;
              });
            }).length;
            return (
              <Chip
                key={label}
                label={`${label} (${count})`}
                onClick={() => setSelectedLabelFilter(selectedLabelFilter === label ? 'all' : label)}
                sx={{
                  bgcolor: selectedLabelFilter === label ? getLabelColor(label) : `${getLabelColor(label)}33`,
                  color: selectedLabelFilter === label ? 'white' : getLabelColor(label),
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: selectedLabelFilter === label ? '2px solid' : '1px solid',
                  borderColor: selectedLabelFilter === label ? '#fff' : getLabelColor(label),
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: getLabelColor(label),
                    color: 'white',
                  }
                }}
              />
            );
          })}
        </Box>

        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel sx={{ color: '#94a3b8' }}><FilterListIcon sx={{ mr: 0.5, verticalAlign: 'middle' }} />Filter by Label</InputLabel>
          <Select
            value={selectedLabelFilter}
            label="Filter by Label"
            onChange={(e) => setSelectedLabelFilter(e.target.value)}
            sx={{
              bgcolor: '#0f172a',
              color: '#e2e8f0',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#64748b' },
            }}
          >
            <MenuItem value="all">All Labels ({approvedTasks.length} items)</MenuItem>
            {approvedLabels.map((label) => {
              const count = approvedTasks.filter((t) => {
                let taskLabels = [];
                if (t.labels?.objects && Array.isArray(t.labels.objects)) {
                  taskLabels = t.labels.objects;
                } else if (Array.isArray(t.labels)) {
                  taskLabels = t.labels;
                } else if (t.annotations) {
                  const approvedAnn = t.annotations.find(a => a.status === 'approved');
                  if (approvedAnn?.labels?.objects) {
                    taskLabels = approvedAnn.labels.objects;
                  } else if (Array.isArray(approvedAnn?.labels)) {
                    taskLabels = approvedAnn.labels;
                  }
                }
                return taskLabels.some((obj) => {
                  const labelName = obj.label || obj;
                  return labelName === label;
                });
              }).length;
              return (
                <MenuItem key={label} value={label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={label}
                      size="small"
                      sx={{
                        bgcolor: getLabelColor(label),
                        color: 'white',
                        fontWeight: 700,
                        height: 20,
                        fontSize: '0.7rem',
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>({count} items)</Typography>
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {filteredItems.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" sx={{ color: '#94a3b8' }}>No approved items found.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {approvedTasks.flatMap((task, taskIdx) => {
            // Get labels from different possible structures
            let labels = [];
            if (task.labels?.objects && Array.isArray(task.labels.objects)) {
              labels = task.labels.objects;
            } else if (Array.isArray(task.labels)) {
              labels = task.labels;
            } else if (task.annotations) {
              const approvedAnn = task.annotations.find(a => a.status === 'approved');
              if (approvedAnn?.labels?.objects) {
                labels = approvedAnn.labels.objects;
              } else if (Array.isArray(approvedAnn?.labels)) {
                labels = approvedAnn.labels;
              }
            } else if (task.dataItem?.labels?.objects) {
              labels = task.dataItem.labels.objects;
            } else if (Array.isArray(task.dataItem?.labels)) {
              labels = task.dataItem.labels;
            }
            
            // Get image URL from multiple possible paths
            const imageUrl = 
              task.datasetItemId?.imageUrl || 
              task.datasetItemId?.url || 
              task.datasetItemId?.path ||
              task.dataItem?.imageUrl ||
              task.dataItem?.url ||
              task.dataItem?.path ||
              task.itemId?.imageUrl ||
              task.itemId?.url;
            
            // Check filter match
            const hasMatchingLabel = labels.some((obj) => {
              const labelName = obj.label || obj;
              return selectedLabelFilter === 'all' || labelName === selectedLabelFilter;
            });
            
            if (!hasMatchingLabel && selectedLabelFilter !== 'all') {
              return [];
            }

            // Return each label as a separate card
            return labels.map((obj, labelIdx) => {
              const labelName = obj.label || obj;
              const matchesFilter = selectedLabelFilter === 'all' || labelName === selectedLabelFilter;
              
              if (!matchesFilter) return null;
              
              return (
                <Grid item xs={6} sm={4} md={3} key={`${taskIdx}-${labelIdx}`}>
                  <Card sx={{
                    ...cardSx,
                    border: `2px solid ${getLabelColor(labelName)}`,
                    '&:hover': { borderColor: '#3b82f6' }
                  }}>
                    <Box sx={{
                      position: 'relative',
                      paddingTop: '100%',
                      bgcolor: '#0f172a',
                      overflow: 'hidden',
                    }}>
                      {imageUrl ? (
                        <ImageViewer
                          imageUrl={getFullImageUrl(imageUrl)}
                          annotations={[{ bbox: obj.bbox || obj.box, label: labelName }]}
                          readOnly
                          maxHeight="100%"
                        />
                      ) : (
                        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ color: '#64748b' }}>No Image</Typography>
                        </Box>
                      )}
                    </Box>
                    <CardContent sx={{ py: 1, px: 2 }}>
                      <Chip
                        label={labelName}
                        size="small"
                        sx={{
                          bgcolor: getLabelColor(labelName),
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              );
            });
          })}
        </Grid>
      )}
    </Box>
  );

  return (
    <Box sx={{ ...pageSx, p: { xs: 2, sm: 3, md: 4 } }}>
      <Box sx={panelSx}>
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #334155', background: 'linear-gradient(to right, #0f172a, #1e293b)' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <IconButton onClick={() => navigate('/manager/projects')} sx={{ color: '#e2e8f0' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Projects / {project?.name}
            </Typography>
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 300 }}>
              <Typography variant="h4" fontWeight={700} sx={{ color: '#e2e8f0', mb: 1, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {project?.name}
              </Typography>
              <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 800, lineHeight: '1.7' }}>
                {project?.description || 'No description provided.'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" startIcon={<AssessmentIcon />} onClick={() => setQualityDialogOpen(true)} sx={secondaryBtnSx}>Analytics</Button>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => setExportDialogOpen(true)} sx={secondaryBtnSx}>Export</Button>
              <Button variant="contained" startIcon={<SettingsIcon />} onClick={() => setEditDialogOpen(true)} sx={primaryBtnSx}>Settings</Button>
            </Stack>
          </Box>
          </Box>

        <Box sx={{ borderBottom: 1, borderColor: '#334155' }}>
          <Tabs
            value={currentTab}
            onChange={(e, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTab-root': { color: '#94a3b8', textTransform: 'none', fontWeight: 600 },
              '& .Mui-selected': { color: '#3b82f6' },
              '& .MuiTabs-indicator': { bgcolor: '#3b82f6' },
            }}
          >
            <Tab label="OVERVIEW" />
            <Tab label="ITEMS" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {currentTab === 0 && renderOverview()}
          {currentTab === 1 && renderItems()}
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" fontWeight={700} color="#e2e8f0" sx={{ mb: 2 }}>Reviewer Performance</Typography>
        <TableContainer component={Paper} sx={{ ...cardSx, '& .MuiTableCell-root': { borderColor: '#334155' } }}>
          <Table>
            <TableHead>
              <TableRow sx={{ background: '#0f172a' }}>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Reviewer</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Assigned</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Approved Votes</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Rejected Votes</TableCell>
                <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Pending Votes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedByReviewer.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: '#94a3b8' }}>No reviewer assignments found.</TableCell>
                </TableRow>
              ) : (
                groupedByReviewer.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:hover': { bgcolor: '#0f172a' } }}>
                    <TableCell><Typography variant="body2" fontWeight={700} color="#e2e8f0">{r.name}</Typography></TableCell>
                    <TableCell sx={{ color: '#94a3b8' }}>{r.assigned}</TableCell>
                    <TableCell sx={{ color: '#34d399' }}>{r.approved}</TableCell>
                    <TableCell sx={{ color: '#f87171' }}>{r.rejected}</TableCell>
                    <TableCell sx={{ color: '#fbbf24' }}>{r.pending}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Dialogs */}
      <Dialog open={qualityDialogOpen} onClose={() => setQualityDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: modalPaperSx }} BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Project Analytics</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#334155' }}>
          {qualityStats && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#0f172a', border: '1px solid #334155' }}><Typography variant="h4">{qualityStats.total}</Typography><Typography variant="caption" color="#94a3b8">Total Tasks</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(34,197,94,0.12)', border: '1px solid #334155' }}><Typography variant="h4" color="#22c55e">{qualityStats.approved}</Typography><Typography variant="caption" color="#94a3b8">Approved</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid #334155' }}><Typography variant="h4" color="#ef4444">{qualityStats.rejected}</Typography><Typography variant="caption" color="#94a3b8">Rejected</Typography></Paper></Grid>
              <Grid item xs={6} md={3}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#0f172a', border: '1px solid #334155' }}><Typography variant="h4" color="#3b82f6">{qualityStats.submitted}</Typography><Typography variant="caption" color="#94a3b8">Pending Review</Typography></Paper></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setQualityDialogOpen(false)} sx={secondaryBtnSx}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: modalPaperSx }} BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Export Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: '#94a3b8' }}>Choose your preferred format for export.</Typography>
          <Stack spacing={2}>
            {['JSON', 'YOLO', 'VOC', 'COCO', 'CSV'].map((fmt) => (
              <Button key={fmt} variant="outlined" fullWidth sx={secondaryBtnSx} onClick={() => { handleExport(fmt.toLowerCase()); setExportDialogOpen(false); }}>{fmt} Format</Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setExportDialogOpen(false)} sx={secondaryBtnSx}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: modalPaperSx }} BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Assign New Tasks</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Dataset Type</InputLabel>
              <Select value={selectedDatasetType} label="Dataset Type" onChange={(e) => { setSelectedDatasetType(e.target.value); setSelectedDataset(''); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="image">Image</MenuItem>
                <MenuItem value="audio">Audio</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Dataset</InputLabel>
              <Select value={selectedDataset} label="Dataset" onChange={(e) => setSelectedDataset(e.target.value)}>
                {filteredDatasets.map((ds) => <MenuItem key={ds._id} value={ds._id}>{ds.name} ({ds.type || 'unknown'})</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Annotators</InputLabel>
              <Select multiple value={selectedAnnotators} label="Annotators" onChange={(e) => setSelectedAnnotators(e.target.value)} renderValue={(selected) => annotators.filter((a) => selected.includes(a._id)).map((a) => a.fullName || a.username).join(', ')}>
                {annotators.map((a) => <MenuItem key={a._id} value={a._id}><Checkbox checked={selectedAnnotators.indexOf(a._id) > -1} /><ListItemText primary={a.fullName || a.username} secondary={a.email} /></MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Reviewers</InputLabel>
              <Select multiple value={selectedReviewers} label="Reviewers" onChange={(e) => setSelectedReviewers(e.target.value)} renderValue={(selected) => reviewers.filter((r) => selected.includes(r._id)).map((r) => r.fullName || r.username).join(', ')}>
                {reviewers.map((r) => <MenuItem key={r._id} value={r._id}><Checkbox checked={selectedReviewers.indexOf(r._id) > -1} /><ListItemText primary={r.fullName || r.username} secondary={r.email} /></MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setAssignDialogOpen(false)} sx={secondaryBtnSx}>Close</Button><Button variant="contained" onClick={handleAssign} sx={primaryBtnSx}>Assign</Button></DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: modalPaperSx }} BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Project</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <TextField label="Name" fullWidth value={editFormData.name} onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))} sx={inputSx} />
            <TextField label="Description" fullWidth multiline rows={3} value={editFormData.description} onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))} sx={inputSx} />
            <TextField label="Guidelines" fullWidth multiline rows={4} value={editFormData.guidelines} onChange={(e) => setEditFormData((prev) => ({ ...prev, guidelines: e.target.value }))} sx={inputSx} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Deadline" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={editFormData.deadline} onChange={(e) => setEditFormData((prev) => ({ ...prev, deadline: e.target.value }))} sx={inputSx} />
              <FormControl fullWidth sx={inputSx}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={editFormData.status} onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value }))}>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth sx={inputSx}>
                <InputLabel>Export Format</InputLabel>
                <Select label="Export Format" value={editFormData.exportFormat} onChange={(e) => setEditFormData((prev) => ({ ...prev, exportFormat: e.target.value }))}>
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
        <DialogActions><Button onClick={() => setEditDialogOpen(false)} sx={secondaryBtnSx}>Close</Button><Button variant="contained" onClick={handleUpdateProject} sx={primaryBtnSx}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={showLabelsDialogOpen} onClose={() => setShowLabelsDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: modalPaperSx }} BackdropProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Các nhãn đã được duyệt</DialogTitle>
        <DialogContent>
          {approvedLabels.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#94a3b8', py: 2 }}>Chưa có nhãn nào được duyệt.</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 2 }}>
              {approvedLabels.map((label, idx) => {
                const count = approvedTasks.filter((t) => {
                  const labels = t.labels?.objects || [];
                  return labels.some((obj) => obj.label === label);
                }).length;
                return (
                  <Chip
                    key={idx}
                    label={`${label} (${count})`}
                    sx={{
                      bgcolor: getLabelColor(label),
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  />
                );
              })}
    </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setShowLabelsDialogOpen(false)} sx={secondaryBtnSx}>Đóng</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerProjectDetail;
