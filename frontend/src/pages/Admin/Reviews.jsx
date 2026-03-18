import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  InputAdornment,
  TextField,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  RateReview as RateReviewIcon,
  Pending as PendingIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
  });

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      
      const pending = response.data?.pending || [];
      const reviewed = response.data?.reviewed || [];
      const allTasks = [...pending, ...reviewed];
      
      setReviews(allTasks);
      
      setStats({
        total: allTasks.length,
        approved: allTasks.filter(t => t.status === 'approved').length,
        rejected: allTasks.filter(t => t.status === 'rejected').length,
        pending: allTasks.filter(t => t.status === 'submitted').length,
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    let filtered = reviews;

    if (tabValue === 1) filtered = filtered.filter(t => t.status === 'approved');
    else if (tabValue === 2) filtered = filtered.filter(t => t.status === 'rejected');
    else if (tabValue === 3) filtered = filtered.filter(t => t.status === 'submitted');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t._id?.toLowerCase().includes(term) ||
        t.projectId?.name?.toLowerCase().includes(term) ||
        t.datasetId?.name?.toLowerCase().includes(term) ||
        t.annotatorId?.username?.toLowerCase().includes(term) ||
        t.annotatorId?.fullName?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [reviews, tabValue, searchTerm]);

  const handleOpenDetail = (task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedTask(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircleIcon sx={{ color: '#22c55e' }} />;
      case 'rejected': return <CancelIcon sx={{ color: '#ef4444' }} />;
      default: return <PendingIcon sx={{ color: '#f59e0b' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'rejected': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 1 }}>
          Admin Reviews
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
          Monitor all review activities across the platform
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#3b82f620', color: '#3b82f6' }}>
                  <AssignmentIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.total}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Total Reviews</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#22c55e20', color: '#22c55e' }}>
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.approved}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approved</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#ef444420', color: '#ef4444' }}>
                  <CancelIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.rejected}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Rejected</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#f59e0b20', color: '#f59e0b' }}>
                  <PendingIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.pending}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pending</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {stats.total > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Approval Rate</Typography>
            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
              {Math.round((stats.approved / stats.total) * 100)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(stats.approved / stats.total) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#334155',
              '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' }
            }}
          />
        </Box>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search reviews..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 300, '& .MuiOutlinedInput-root': { bgcolor: '#1e293b' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
          }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReviews} sx={{ borderColor: '#334155', color: '#94a3b8' }}>
          Refresh
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3, '& .MuiTab-root': { color: '#94a3b8' }, '& .Mui-selected': { color: '#3b82f6' }, '& .MuiTabs-indicator': { bgcolor: '#3b82f6' } }}>
        <Tab label={`All (${reviews.length})`} />
        <Tab label={`Approved (${stats.approved})`} />
        <Tab label={`Rejected (${stats.rejected})`} />
        <Tab label={`Pending (${stats.pending})`} />
      </Tabs>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Task ID</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Project</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Dataset</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Annotator</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Reviewer</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Reviewed At</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#64748b' }}>No reviews found</TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((task) => (
                <TableRow key={task._id} sx={{ '&:hover': { bgcolor: '#33415520' } }}>
                  <TableCell>
                    <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {task._id?.substring(0, 8).toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#e2e8f0' }}>
                      {task.projectId?.name || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#94a3b8' }}>
                      {task.datasetId?.name || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                      <Typography sx={{ color: '#e2e8f0' }}>
                        {task.annotatorId?.fullName || task.annotatorId?.username || 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#94a3b8' }}>
                      {task.reviewerId?.fullName || task.reviewerId?.username || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(task.status)}
                      label={task.status === 'approved' ? 'Approved' : task.status === 'rejected' ? 'Rejected' : 'Pending'}
                      size="small"
                      sx={{
                        bgcolor: `${getStatusColor(task.status)}20`,
                        color: getStatusColor(task.status),
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        '& .MuiChip-icon': { color: getStatusColor(task.status) }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      {task.reviewedAt ? new Date(task.reviewedAt).toLocaleString('vi-VN') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" onClick={() => handleOpenDetail(task)} sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid #334155' } }}>
        <DialogTitle sx={{ borderBottom: '1px solid #334155' }}>
          <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
            Review Details
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedTask && (
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Task ID</Typography>
                <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', mb: 2 }}>{selectedTask._id}</Typography>
                
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Project</Typography>
                <Typography sx={{ color: '#e2e8f0', mb: 2 }}>{selectedTask.projectId?.name || 'N/A'}</Typography>
                
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Dataset</Typography>
                <Typography sx={{ color: '#e2e8f0', mb: 2 }}>{selectedTask.datasetId?.name || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Annotator</Typography>
                <Typography sx={{ color: '#e2e8f0', mb: 2 }}>{selectedTask.annotatorId?.fullName || selectedTask.annotatorId?.username || 'N/A'}</Typography>
                
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reviewer</Typography>
                <Typography sx={{ color: '#e2e8f0', mb: 2 }}>{selectedTask.reviewerId?.fullName || selectedTask.reviewerId?.username || '-'}</Typography>
                
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Status</Typography>
                <Box>
                  <Chip
                    label={selectedTask.status}
                    size="small"
                    sx={{
                      bgcolor: `${getStatusColor(selectedTask.status)}20`,
                      color: getStatusColor(selectedTask.status),
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  />
                </Box>
              </Grid>
              
              {selectedTask.reviewComments && (
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Review Comments</Typography>
                  <Box sx={{ p: 2, mt: 1, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155' }}>
                    <Typography sx={{ color: '#e2e8f0', fontStyle: 'italic' }}>
                      "{selectedTask.reviewComments}"
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {selectedTask.errorCategory && (
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Error Category</Typography>
                  <Typography sx={{ color: '#ef4444', fontWeight: 600, mt: 1 }}>
                    {selectedTask.errorCategory === 'incorrect_label' && 'Incorrect Label'}
                    {selectedTask.errorCategory === 'missing_label' && 'Missing Label'}
                    {selectedTask.errorCategory === 'poor_quality' && 'Poor Quality'}
                    {selectedTask.errorCategory === 'does_not_follow_guidelines' && 'Does Not Follow Guidelines'}
                    {selectedTask.errorCategory === 'other' && 'Other'}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
          <Button onClick={handleCloseDetail} sx={{ color: '#94a3b8' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReviews;
