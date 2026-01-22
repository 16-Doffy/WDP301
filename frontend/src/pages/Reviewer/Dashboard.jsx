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
  Tabs,
  Tab,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ReviewerDashboard = () => {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [allPendingTasks, setAllPendingTasks] = useState([]);
  const [allReviewedTasks, setAllReviewedTasks] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('all');
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [selectedDataset, allPendingTasks, allReviewedTasks]);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      const pending = response.data.pending || [];
      const reviewed = response.data.reviewed || [];
      
      setAllPendingTasks(pending);
      setAllReviewedTasks(reviewed);
      
      // Extract unique datasets
      const datasetSet = new Set();
      [...pending, ...reviewed].forEach(task => {
        if (task.datasetId?._id) {
          datasetSet.add(JSON.stringify({
            _id: task.datasetId._id,
            name: task.datasetId.name || 'Unknown Dataset'
          }));
        }
      });
      setDatasets(Array.from(datasetSet).map(ds => JSON.parse(ds)));
      
      filterTasks(pending, reviewed);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = (pending = allPendingTasks, reviewed = allReviewedTasks) => {
    if (selectedDataset === 'all') {
      setPendingTasks(pending);
      setReviewedTasks(reviewed);
    } else {
      setPendingTasks(pending.filter(task => 
        task.datasetId?._id === selectedDataset || 
        task.datasetId?._id?.toString() === selectedDataset
      ));
      setReviewedTasks(reviewed.filter(task => 
        task.datasetId?._id === selectedDataset || 
        task.datasetId?._id?.toString() === selectedDataset
      ));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      submitted: 'warning',
      approved: 'success',
      rejected: 'error',
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

  const currentTasks = tabValue === 0 ? pendingTasks : reviewedTasks;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Review Dashboard
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Dataset</InputLabel>
          <Select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            label="Filter by Dataset"
          >
            <MenuItem value="all">All Datasets</MenuItem>
            {datasets.map((dataset) => (
              <MenuItem key={dataset._id} value={dataset._id}>
                {dataset.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
        <Tab label={`Pending Reviews (${pendingTasks.length})`} />
        <Tab label={`Reviewed (${reviewedTasks.length})`} />
      </Tabs>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Annotator</TableCell>
              <TableCell>File</TableCell>
              {tabValue === 0 ? (
                <>
                  <TableCell>Submitted At</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              ) : (
                <>
                  <TableCell>Status</TableCell>
                  <TableCell>Reviewed At</TableCell>
                  <TableCell>Review Comments</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {currentTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tabValue === 0 ? 5 : 7} align="center">
                  <Alert severity="info">
                    {tabValue === 0 
                      ? 'Không có tasks nào đang chờ review' 
                      : 'Bạn chưa review task nào'}
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              currentTasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell>{task.projectId?.name}</TableCell>
                  <TableCell>{task.annotatorId?.fullName || task.annotatorId?.username}</TableCell>
                  <TableCell>{task.dataItem?.filename}</TableCell>
                  {tabValue === 0 ? (
                    <>
                      <TableCell>
                        {task.submittedAt
                          ? new Date(task.submittedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/reviewer/tasks/${task._id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Chip
                          label={task.status}
                          color={getStatusColor(task.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {task.reviewedAt
                          ? new Date(task.reviewedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {task.reviewComments ? (
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.reviewComments}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            {task.status === 'approved' ? 'Đã phê duyệt' : '-'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/reviewer/tasks/${task._id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ReviewerDashboard;
