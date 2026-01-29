<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  ErrorOutline as RejectedIcon,
  KeyboardArrowRight as ArrowRightIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ReviewerDashboard = () => {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0: Pending, 1: Reviewed
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      setPendingTasks(response.data.pending || []);
      setReviewedTasks(response.data.reviewed || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentTasks = tabValue === 0 ? pendingTasks : reviewedTasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, colorClass, subtext }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.98] cursor-default group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
          {subtext && <p className="text-gray-400 text-xs mt-2">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  const StatusPill = ({ status }) => {
    const configs = {
      submitted: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        label: 'Pending',
      },
      approved: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        label: 'Approved',
      },
      rejected: {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
        label: 'Rejected',
      },
    };
    const config = configs[status] || configs.submitted;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${config.dot}`}></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Review Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Manage and quality check data labeling tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Efficiency</p>
            <p className="text-sm font-bold text-blue-600">
              {reviewedTasks.length > 0
                ? `${Math.round((reviewedTasks.filter(t => t.status === 'approved').length / reviewedTasks.length) * 100)}% Pass Rate`
                : 'N/A'}
            </p>
          </div>
          <button
            onClick={fetchTasks}
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Assigned"
          value={pendingTasks.length + reviewedTasks.length}
          icon={SearchIcon}
          colorClass="bg-blue-50 text-blue-600"
          subtext="Total tasks in your queue"
        />
        <StatCard
          title="Pending"
          value={pendingTasks.length}
          icon={PendingIcon}
          colorClass="bg-amber-50 text-amber-600"
          subtext="Action required soon"
        />
        <StatCard
          title="Approved"
          value={reviewedTasks.filter(t => t.status === 'approved').length}
          icon={CheckCircleIcon}
          colorClass="bg-emerald-50 text-emerald-600"
          subtext="High quality labels"
        />
        <StatCard
          title="Rejected"
          value={reviewedTasks.filter(t => t.status === 'rejected').length}
          icon={RejectedIcon}
          colorClass="bg-rose-50 text-rose-600"
          subtext="Need re-annotation"
        />
      </div>

      {/* Content Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 pt-6">
          <button
            onClick={() => setTabValue(0)}
            className={`pb-4 px-4 text-sm font-semibold transition-all relative ${tabValue === 0 ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Pending Reviews
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${tabValue === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {pendingTasks.length}
            </span>
            {tabValue === 0 && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 animate-in slide-in-from-left-full duration-300"></div>
            )}
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`pb-4 px-4 text-sm font-semibold transition-all relative ${tabValue === 1 ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Reviewed History
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${tabValue === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {reviewedTasks.length}
            </span>
            {tabValue === 1 && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 animate-in slide-in-from-left-full duration-300"></div>
            )}
          </button>
        </div>

        {/* Table/List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Project & File</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Annotator</th>
                {tabValue === 0 ? (
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Submitted At</th>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Reviewed At</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentTasks.length === 0 ? (
                <tr>
                  <td colSpan={tabValue === 0 ? 4 : 5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <SearchIcon className="text-gray-300 w-8 h-8" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {tabValue === 0
                          ? 'No tasks pending review'
                          : "You haven't reviewed any tasks yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTasks.map((task) => (
                  <tr key={task._id} className="group hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => navigate(`/reviewer/tasks/${task._id}`)}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">{task.projectId?.name || 'Unknown Project'}</span>
                        <span className="text-xs text-gray-400 mt-1 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {task.dataItem?.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-[10px] font-bold text-blue-600 border border-blue-200">
                          {(task.annotatorId?.fullName || task.annotatorId?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-600 font-medium">{task.annotatorId?.fullName || task.annotatorId?.username}</span>
                      </div>
                    </td>
                    {tabValue === 0 ? (
                      <td className="px-6 py-5">
                        <span className="text-sm text-gray-500">
                          {task.submittedAt ? new Date(task.submittedAt).toLocaleDateString() : '-'}
                          <span className="text-[10px] block text-gray-400">
                            {task.submittedAt ? new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-5">
                          <StatusPill status={task.status} />
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-gray-500">
                            {task.reviewedAt ? new Date(task.reviewedAt).toLocaleDateString() : '-'}
                            <span className="text-[10px] block text-gray-400">
                              {task.reviewedAt ? new Date(task.reviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-5 text-right">
                      <button
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-100 text-gray-400 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:bg-blue-50 transition-all shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/reviewer/tasks/${task._id}`);
                        }}
                      >
                        <ArrowRightIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="bg-gray-50/50 px-6 py-4 flex justify-between items-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
          <span>Showing {currentTasks.length} tasks</span>
          <div className="flex gap-4">
            <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span> Priority: Medium</span>
            <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span> Data Quality: High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
=======
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
>>>>>>> NDuy
