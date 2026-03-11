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
  InboxOutlined as EmptyIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';


const ReviewerDashboard = () => {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0: Pending, 1: Reviewed
  const { user } = useAuth();
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
      setTimeout(() => setLoading(false), 500); // Small delay for smoother feel
    }
  };

  const currentTasks = tabValue === 0 ? pendingTasks : reviewedTasks;

  if (loading && pendingTasks.length === 0 && reviewedTasks.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-10 py-6 px-4 animate-pulse">
        {/* Skeleton Hero */}
        <div className="rounded-[2.5rem] bg-slate-900/5 h-64 border border-slate-100 flex items-center px-12">
          <div className="space-y-4 w-full">
            <div className="h-6 w-32 bg-indigo-500/10 rounded-full"></div>
            <div className="h-12 w-1/2 bg-slate-200 rounded-2xl"></div>
            <div className="h-4 w-1/3 bg-slate-100 rounded-xl"></div>
          </div>
        </div>

        {/* Skeleton Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 shadow-sm"></div>
          ))}
        </div>

        {/* Skeleton Table */}
        <div className="bg-white rounded-3xl border border-gray-100 h-96"></div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, secondary }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner`} style={{ backgroundColor: `${color}10`, color: color }}>
          <Icon fontSize="medium" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-0.5">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-800">{value}</h3>
            {secondary && <span className="text-[10px] font-bold text-gray-400">{secondary}</span>}
          </div>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <TrendingIcon sx={{ fontSize: 16, color: color, opacity: 0.5 }} />
      </div>
    </div>
  );

  const StatusTag = ({ status }) => {
    const config = {
      approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500', label: 'Approved' },
      rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-500', label: 'Rejected' },
      submitted: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500', label: 'Pending Review' }
    }[status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100', dot: 'bg-slate-500', label: 'Unknown' };

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${config.bg} ${config.text} ${config.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`}></span>
        {config.label}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-6 px-4 animate-fadeIn">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                Performance Dashboard
              </span>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                Welcome back, <span className="text-indigo-400 capitalize">{user?.fullName?.split(' ')[0] || 'Reviewer'}!</span>
              </h1>
              <p className="text-slate-400 mt-3 text-lg font-medium max-w-xl">
                Ready to ensure the highest quality for our datasets? You have <span className="text-amber-400 font-bold">{pendingTasks.length} tasks</span> waiting for your audit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Tooltip title="Refresh Data">
              <button
                onClick={fetchTasks}
                disabled={loading}
                className={`p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shadow-xl group ${loading ? 'opacity-50' : ''}`}
              >
                <RefreshIcon className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Assigned" value={pendingTasks.length + reviewedTasks.length} icon={SearchIcon} color="#6366f1" secondary="items" />
        <StatCard title="Pending Queue" value={pendingTasks.length} icon={PendingIcon} color="#f59e0b" secondary="waiting" />
        <StatCard title="Approved" value={reviewedTasks.filter(t => t.status === 'approved').length} icon={CheckIcon} color="#10b981" secondary="verified" />
        <StatCard title="Rejected" value={reviewedTasks.filter(t => t.status === 'rejected').length} icon={RejectedIcon} color="#ef4444" secondary="failed" />
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xl shadow-slate-200/50">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 p-2 bg-slate-50/50 gap-2">
          <button
            onClick={() => setTabValue(0)}
            className={`py-3 px-8 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${tabValue === 0
              ? 'bg-white text-indigo-600 shadow-sm border border-gray-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
          >
            Pending Tasks ({pendingTasks.length})
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`py-3 px-8 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${tabValue === 1
              ? 'bg-white text-indigo-600 shadow-sm border border-gray-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
          >
            Audit History ({reviewedTasks.length})
          </button>
        </div>

        {/* List View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 text-slate-400 bg-slate-50/30">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Identification</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-nowrap">Collaborator</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Timeline</th>
                {tabValue === 1 && <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Audit Outcome</th>}
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center text-slate-300">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                        <EmptyIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-400">All caught up!</p>
                        <p className="text-sm font-medium">No tasks found in this section.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTasks.map((task, index) => (
                  <tr
                    key={task._id}
                    className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => navigate(`/reviewer/tasks/${task._id}`)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-xl group-hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden border border-transparent group-hover:border-indigo-100 flex-shrink-0">
                          {task.dataItem?.mimeType?.startsWith('image/') ? (
                            <img
                              src={`${API_URL}/${task.dataItem.path}`}
                              alt=""
                              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <FileIcon fontSize="medium" className="opacity-40 group-hover:opacity-100 text-indigo-600 transition-all" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] font-black text-indigo-600 uppercase tracking-wider">
                              {task.projectId?.name || 'Project'}
                            </span>
                            {task.dataItem?.mimeType && (
                              <span className="text-[9px] font-bold text-slate-300 uppercase">
                                {task.dataItem.mimeType.split('/')[1]}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                            {task.dataItem?.filename || `ID: ${task._id.slice(-8)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar
                            sx={{
                              width: 38,
                              height: 38,
                              fontSize: 14,
                              bgcolor: '#f8fafc',
                              color: '#6366f1',
                              fontWeight: 900,
                              border: '2px solid #fff',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                          >
                            {(task.annotatorId?.fullName || task.annotatorId?.username || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full ring-2 ring-emerald-500/10"></div>
                        </div>
                        <div>
                          <p className="text-[13px] text-slate-700 font-bold group-hover:text-slate-900 transition-colors">
                            {task.annotatorId?.fullName || task.annotatorId?.username || 'Unknown'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Collaborator</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-[13px] text-slate-700 font-bold">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          {new Date(task.reviewedAt || task.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 ml-3">
                          {new Date(task.reviewedAt || task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    {tabValue === 1 && (
                      <td className="px-8 py-6">
                        <StatusTag status={task.status} />
                      </td>
                    )}
                    <td className="px-8 py-6 text-right w-10">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-transparent group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300">
                        <ArrowIcon fontSize="small" className="transform group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/50 px-8 py-5 border-t border-gray-50 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
            Database Insight: {currentTasks.length} Active Records
          </p>
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-indigo-300' : 'bg-slate-200'}`}></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
