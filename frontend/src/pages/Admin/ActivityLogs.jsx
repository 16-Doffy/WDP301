import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Pagination,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    resourceType: '',
  });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, filters]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (filters.action) params.append('action', filters.action);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);

      const response = await axios.get(`${API_URL}/api/activity-logs?${params}`);
      console.log('Activity logs response:', response.data);
      setLogs(response.data.logs || []);
      setTotalPages(response.data.totalPages || 1);
      
      if (response.data.logs && response.data.logs.length === 0) {
        console.log('No activity logs found');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/activity-logs/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('create') || action.includes('approve')) return 'success';
    if (action.includes('delete') || action.includes('reject') || action.includes('deactivate')) return 'error';
    if (action.includes('update') || action.includes('submit')) return 'warning';
    return 'default';
  };

  if (loading && !logs.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <HistoryIcon />
        <Typography variant="h4">
          Activity Logs
        </Typography>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Top Actions</Typography>
                {stats.actionStats?.slice(0, 5).map((stat, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{stat._id}</Typography>
                    <Typography variant="body2" fontWeight="bold">{stat.count}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Most Active Users</Typography>
                {stats.userStats?.slice(0, 5).map((stat, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {stat.user?.fullName || stat.user?.username || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">{stat.count}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={filters.action}
              label="Action"
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="login">Login</MenuItem>
              <MenuItem value="project_create">Create Project</MenuItem>
              <MenuItem value="task_assign">Assign Task</MenuItem>
              <MenuItem value="task_submit">Submit Task</MenuItem>
              <MenuItem value="task_approve">Approve Task</MenuItem>
              <MenuItem value="task_reject">Reject Task</MenuItem>
              <MenuItem value="export_data">Export Data</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Resource Type</InputLabel>
            <Select
              value={filters.resourceType}
              label="Resource Type"
              onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="project">Project</MenuItem>
              <MenuItem value="task">Task</MenuItem>
              <MenuItem value="dataset">Dataset</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>IP Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No activity logs found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {log.userId?.fullName || log.userId?.username || 'Unknown'}
                    <Chip
                      label={log.userId?.role}
                      size="small"
                      sx={{ ml: 1 }}
                      color={log.userId?.role === 'admin' ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.action}
                      size="small"
                      color={getActionColor(log.action)}
                    />
                  </TableCell>
                  <TableCell>
                    {log.resourceType && (
                      <Chip label={log.resourceType} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="textSecondary">
                      {log.ipAddress || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default ActivityLogs;
