<<<<<<< HEAD
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
=======
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AnnotatorDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`);
      const tasks = response.data || [];
      
      // Group tasks by dataset
      const batchMap = new Map();
      tasks.forEach(task => {
        const datasetId = task.datasetId?._id || task.datasetId || 'unknown';
        const datasetName = task.datasetId?.name || 'Unknown Dataset';
        const projectName = task.projectId?.name || 'Unknown Project';
        
        if (!batchMap.has(datasetId)) {
          batchMap.set(datasetId, {
            id: datasetId,
            name: datasetName,
            project: projectName,
            tasks: [],
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            status: 'new',
            assignedDate: task.createdAt || new Date(),
            previewImage: task.dataItem?.path || null,
          });
        }
        
        const batch = batchMap.get(datasetId);
        batch.tasks.push(task);
        batch.totalTasks++;
        
        if (task.status === 'approved') {
          batch.completedTasks++;
        } else if (task.status === 'submitted') {
          batch.completedTasks++; // Count submitted as completed (waiting review)
        } else if (task.status === 'in_progress') {
          batch.inProgressTasks++;
        } else if (task.status === 'rejected') {
          batch.inProgressTasks++; // Rejected tasks need to be redone
        }
        
        // Determine batch status
        if (batch.completedTasks === batch.totalTasks && batch.totalTasks > 0) {
          batch.status = 'completed';
        } else if (batch.inProgressTasks > 0 || batch.completedTasks > 0) {
          batch.status = 'in_progress';
        }
        
        // Get earliest assigned date
        if (new Date(task.createdAt) < new Date(batch.assignedDate)) {
          batch.assignedDate = task.createdAt;
        }
        
        // Get first image as preview
        if (!batch.previewImage && task.dataItem?.path) {
          batch.previewImage = task.dataItem.path;
        }
      });
      
      const batchesList = Array.from(batchMap.values());
      setBatches(batchesList);
    } catch (error) {
      console.error('Error fetching batches:', error);
      if (error.response?.status === 403) {
        alert('Bạn không có quyền xem tasks. Vui lòng liên hệ Manager.');
      } else {
        alert('Lỗi khi tải danh sách batches: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      new: { text: 'NEW', color: 'bg-green-100 text-green-800' },
      in_progress: { text: 'IN PROGRESS', color: 'bg-blue-100 text-blue-800' },
      completed: { text: 'COMPLETED', color: 'bg-gray-100 text-gray-800' },
      urgent: { text: 'URGENT', color: 'bg-orange-100 text-orange-800' },
    };
    return badges[status] || badges.new;
  };

  const getProgressPercentage = (batch) => {
    if (batch.totalTasks === 0) return 0;
    return Math.round((batch.completedTasks / batch.totalTasks) * 100);
  };

  const getTimeRemaining = (batch) => {
    // Calculate estimated time based on average completion rate
    const remaining = batch.totalTasks - batch.completedTasks;
    if (remaining === 0) return 'Completed';
    if (batch.totalTasks === 0) return 'No limit';
    
    // Estimate: 2 minutes per image on average
    const minutes = remaining * 2;
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h left`;
  };

  // Separate batches into active and completed
  const activeBatches = batches.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.project.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && batch.status !== 'completed';
  });

  const completedBatches = batches.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.project.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && batch.status === 'completed';
  });

  // Helper function to render batch card
  const renderBatchCard = (batch) => {
    const progress = getProgressPercentage(batch);
    const statusBadge = getStatusBadge(batch.status);
    const timeRemaining = getTimeRemaining(batch);
    const firstTask = batch.tasks[0];

    return (
      <div
        key={batch.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => {
          if (firstTask) {
            navigate(`/annotator/tasks/${firstTask._id}`);
          }
        }}
      >
        {/* Image Preview */}
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          {batch.previewImage ? (
            <img
              src={`${API_URL}/${batch.previewImage}`}
              alt={batch.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
            {statusBadge.text}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>

        {/* Batch Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1">{batch.name}</h3>
          <p className="text-sm text-gray-600 mb-2">Project: {batch.project}</p>
          
          {/* Task Status Summary */}
          {batch.tasks.some(t => t.status === 'rejected') && (
            <div className="mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs">
              <span className="text-red-700 font-semibold">⚠ {batch.tasks.filter(t => t.status === 'rejected').length} task(s) rejected - needs revision</span>
            </div>
          )}
          {batch.tasks.some(t => t.status === 'approved') && (
            <div className="mb-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs">
              <span className="text-green-700 font-semibold">✓ {batch.tasks.filter(t => t.status === 'approved').length} task(s) approved</span>
            </div>
          )}
          {batch.tasks.some(t => t.status === 'submitted') && (
            <div className="mb-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <span className="text-yellow-700 font-semibold">⏳ {batch.tasks.filter(t => t.status === 'submitted').length} task(s) pending review</span>
            </div>
          )}

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-medium text-gray-900">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div className="flex items-center gap-1">
              <span>🖼️</span>
              <span>{batch.totalTasks} Images</span>
            </div>
            <div className="flex items-center gap-1">
              <span>⏰</span>
              <span>{timeRemaining}</span>
            </div>
          </div>

          {/* Action Button */}
          {(() => {
            const rejectedTask = batch.tasks.find(t => t.status === 'rejected');
            const inProgressTask = batch.tasks.find(t => t.status === 'in_progress');
            const newTask = batch.tasks.find(t => !t.status || t.status === 'new' || t.status === 'assigned');
            const submittedTask = batch.tasks.find(t => t.status === 'submitted');
            const approvedTask = batch.tasks.find(t => t.status === 'approved');
            const targetTask = rejectedTask || inProgressTask || newTask || submittedTask || approvedTask || firstTask;
            
            let buttonText = 'View Tasks';
            let buttonColor = 'bg-blue-600 text-white hover:bg-blue-700';
            
            if (rejectedTask) {
              buttonText = '🔧 Fix Rejected Task';
              buttonColor = 'bg-red-600 text-white hover:bg-red-700';
            } else if (inProgressTask) {
              buttonText = 'Continue Labeling';
              buttonColor = 'bg-blue-600 text-white hover:bg-blue-700';
            } else if (newTask) {
              buttonText = 'Start Labeling';
              buttonColor = 'bg-green-600 text-white hover:bg-green-700';
            } else if (submittedTask) {
              buttonText = '⏳ Check Review Status';
              buttonColor = 'bg-yellow-600 text-white hover:bg-yellow-700';
            } else if (batch.tasks.every(t => t.status === 'approved')) {
              buttonText = '✓ View Completed';
              buttonColor = 'bg-green-500 text-white hover:bg-green-600';
            }
            
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (targetTask) {
                    navigate(`/annotator/tasks/${targetTask._id}`);
                  }
                }}
                className={`w-full py-2 rounded-lg font-medium transition-colors ${buttonColor}`}
              >
                {buttonText}
              </button>
            );
          })()}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
        <p className="text-gray-600">Manage and track your assigned data collection batches.</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search batches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <span>Filter</span>
          <span>🔽</span>
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <span>Sort</span>
          <span>⇅</span>
        </button>
      </div>

      {/* Active Batches Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Active Projects</h2>
            <p className="text-sm text-gray-600 mt-1">Các project đang được giao và cần hoàn thành</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {activeBatches.length} Active
          </span>
        </div>

        {activeBatches.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No active batches found matching your search.' : 'Bạn chưa có project nào đang được giao. Vui lòng liên hệ Manager để được phân công tasks.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/manager/projects')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Request Batch
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBatches.map((batch) => {
              return renderBatchCard(batch);
            })}

            {/* Request More Work Card - Only show in active section */}
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Request More Work</h3>
              <p className="text-sm text-gray-600 mb-4">
                Finished your batches? Ask your manager for more assignments.
              </p>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Request Batch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Completed Batches Section */}
      {completedBatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Completed Projects</h2>
              <p className="text-sm text-gray-600 mt-1">Các project đã hoàn thành và được phê duyệt</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {completedBatches.length} Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedBatches.map((batch) => {
              return renderBatchCard(batch);
            })}
          </div>
        </div>
      )}

      {/* Show empty state only if both sections are empty */}
      {activeBatches.length === 0 && completedBatches.length === 0 && !searchTerm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-4">
            Bạn chưa có batches nào được phân công. Vui lòng liên hệ Manager để được phân công tasks.
          </p>
          <button
            onClick={() => navigate('/manager/projects')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Request Batch
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnotatorDashboard;
>>>>>>> NDuy
