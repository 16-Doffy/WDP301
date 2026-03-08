import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  CheckCircleOutline as CheckIcon,
  Schedule as PendingIcon,
  HighlightOff as RejectedIcon,
  ChevronRight as ArrowIcon,
  Refresh as RefreshIcon,
  DescriptionOutlined as FileIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  IconButton,
} from '@mui/material';

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
    setLoading(true);
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

  if (loading && pendingTasks.length === 0 && reviewedTasks.length === 0) {
    return (
      <Box className="flex items-center justify-center h-[60vh]">
        <CircularProgress size={30} thickness={4} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center gap-4 transition-all hover:border-indigo-300">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}10`, color: color }}>
        <Icon fontSize="medium" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-tight">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );

  const StatusTag = ({ status }) => {
    const config = {
      approved: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Approved' },
      rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rejected' },
      submitted: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Pending' }
    }[status] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'Unknown' };

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${config.bg} ${config.text} ${config.border}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reviewer Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and audit labeling tasks for quality control.</p>
        </div>
        <IconButton onClick={fetchTasks} disabled={loading} size="small" className="border border-gray-200 bg-white">
          <RefreshIcon fontSize="small" className={loading ? 'animate-spin' : ''} />
        </IconButton>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
        <StatCard title="All Assigned" value={pendingTasks.length + reviewedTasks.length} icon={SearchIcon} color="#4f46e5" />
        <StatCard title="In Queue" value={pendingTasks.length} icon={PendingIcon} color="#f59e0b" />
        <StatCard title="Approved" value={reviewedTasks.filter(t => t.status === 'approved').length} icon={CheckIcon} color="#10b981" />
        <StatCard title="Rejected" value={reviewedTasks.filter(t => t.status === 'rejected').length} icon={RejectedIcon} color="#ef4444" />
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mx-2">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2 bg-gray-50/30">
          <button
            onClick={() => setTabValue(0)}
            className={`py-3 px-6 text-sm font-bold transition-all border-b-2 ${tabValue === 0 ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Pending ({pendingTasks.length})
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`py-3 px-6 text-sm font-bold transition-all border-b-2 ${tabValue === 1 ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            History ({reviewedTasks.length})
          </button>
        </div>

        {/* List View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Project / Task</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-nowrap">Assigned Annotator</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Last Update</th>
                {tabValue === 1 && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Result</th>}
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <SearchIcon sx={{ fontSize: 40, mb: 1 }} />
                      <p className="text-sm font-medium italic">No tasks found in this section.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTasks.map((task) => (
                  <tr
                    key={task._id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/reviewer/tasks/${task._id}`)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-indigo-600 border border-transparent group-hover:border-indigo-100 transition-all">
                          <FileIcon fontSize="small" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{task.projectId?.name || 'Archived Project'}</p>
                          <p className="text-[11px] text-gray-400 font-medium truncate max-w-[180px]">ID: {task.dataItem?.filename || task._id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Avatar sx={{ width: 26, height: 26, fontSize: 10, bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 800, border: '1px solid #e2e8f0' }}>
                          {(task.annotatorId?.fullName || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                        <span className="text-sm text-gray-700 font-semibold">{task.annotatorId?.fullName || task.annotatorId?.username || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-gray-700 font-medium">
                        {new Date(task.reviewedAt || task.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {new Date(task.reviewedAt || task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    {tabValue === 1 && (
                      <td className="px-6 py-5">
                        <StatusTag status={task.status} />
                      </td>
                    )}
                    <td className="px-6 py-5 text-right w-10">
                      <ArrowIcon fontSize="small" className="text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em]">
            Processing {currentTasks.length} total entries
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;

