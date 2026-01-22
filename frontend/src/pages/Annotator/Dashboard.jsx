import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Chip,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AnnotatorDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      console.log('Fetched tasks:', response.data);
      setTasks(response.data || []);
      
      if (response.data && response.data.length === 0) {
        console.log('No tasks found for this annotator');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      console.error('Error details:', error.response?.data);
      // Show error message to user
      if (error.response?.status === 403) {
        alert('Bạn không có quyền xem tasks. Vui lòng liên hệ Manager.');
      } else {
        alert('Lỗi khi tải danh sách tasks: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'default',
      in_progress: 'info',
      submitted: 'warning',
      approved: 'success',
      rejected: 'error',
      revised: 'info',
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
      <Typography variant="h4" gutterBottom>
        My Tasks
      </Typography>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Dataset</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 3 }}>
                    {loading ? 'Đang tải...' : 'Bạn chưa có tasks nào được phân công. Vui lòng liên hệ Manager để được phân công tasks.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell>{task.projectId?.name || 'N/A'}</TableCell>
                  <TableCell>{task.datasetId?.name || 'N/A'}</TableCell>
                  <TableCell>{task.dataItem?.filename || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={task.status}
                      color={getStatusColor(task.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/annotator/tasks/${task._id}`)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AnnotatorDashboard;
