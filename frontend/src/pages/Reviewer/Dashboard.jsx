
import React, { useEffect, useMemo, useState } from 'react';
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
  const [selectedDataType, setSelectedDataType] = useState('all');
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

  const dataTypeTabs = useMemo(() => {
    const allTasks = [...pendingTasks, ...reviewedTasks];

    const byType = (type) => {
      if (type === 'image') return allTasks.filter((t) => (t.dataItem?.mimeType || '').startsWith('image/')).length;
      if (type === 'text') return allTasks.filter((t) => (t.dataItem?.mimeType || '').startsWith('text/') || !!t.dataItem?.text).length;
      if (type === 'audio') return allTasks.filter((t) => (t.dataItem?.mimeType || '').startsWith('audio/')).length;
      return allTasks.length;
    };

    return [
      { id: 'all', label: 'All', count: byType('all') },
      { id: 'image', label: 'Image', count: byType('image') },
      { id: 'text', label: 'Text', count: byType('text') },
      { id: 'audio', label: 'Audio', count: byType('audio') },
    ];
  }, [pendingTasks, reviewedTasks]);

  const matchesDataType = (task) => {
    if (selectedDataType === 'all') return true;
    const mime = (task.dataItem?.mimeType || '').toLowerCase();
    if (selectedDataType === 'image') return mime.startsWith('image/');
    if (selectedDataType === 'text') return mime.startsWith('text/') || !!task.dataItem?.text;
    if (selectedDataType === 'audio') return mime.startsWith('audio/');
    return true;
  };

  const filteredPending = useMemo(() => pendingTasks.filter(matchesDataType), [pendingTasks, selectedDataType]);
  const filteredReviewed = useMemo(() => reviewedTasks.filter(matchesDataType), [reviewedTasks, selectedDataType]);

  const currentTasks = tabValue === 0 ? filteredPending : filteredReviewed;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, colorClass, subtext }) => (
    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-2xl border border-slate-700 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)] transition-shadow active:scale-[0.98] cursor-default group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-semibold text-slate-200">{value}</h3>
          {subtext && <p className="text-slate-400 text-xs mt-2">{subtext}</p>}
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
        bg: 'bg-amber-500/15',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
        label: 'Pending',
      },
      approved: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        dot: 'bg-emerald-400',
        label: 'Approved',
      },
      rejected: {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        dot: 'bg-red-400',
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
    <div className="min-h-screen bg-[#0f172a] p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 text-slate-200 leading-relaxed">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Review Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Manage and quality check data labeling tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Efficiency</p>
            <p className="text-sm font-semibold text-blue-400">
              {reviewedTasks.length > 0
                ? `${Math.round((reviewedTasks.filter(t => t.status === 'approved').length / reviewedTasks.length) * 100)}% Pass Rate`
                : 'N/A'}
            </p>
          </div>
          <button
            onClick={fetchTasks}
            className="p-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition"
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
          colorClass="bg-blue-500/20 text-blue-400"
          subtext="Total tasks in your queue"
        />
        <StatCard
          title="Pending"
          value={filteredPending.length}
          icon={PendingIcon}
          colorClass="bg-amber-500/20 text-amber-400"
          subtext="Action required soon"
        />
        <StatCard
          title="Approved"
          value={filteredReviewed.filter(t => t.status === 'approved').length}
          icon={CheckCircleIcon}
          colorClass="bg-emerald-500/20 text-emerald-400"
          subtext="High quality labels"
        />
        <StatCard
          title="Rejected"
          value={filteredReviewed.filter(t => t.status === 'rejected').length}
          icon={RejectedIcon}
          colorClass="bg-red-500/20 text-red-400"
          subtext="Need re-annotation"
        />
      </div>

      {/* Content Section */}
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        {/* Data type tabs */}
        <div className="px-6 pt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {dataTypeTabs.map((typeTab) => (
              <button
                key={typeTab.id}
                onClick={() => setSelectedDataType(typeTab.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedDataType === typeTab.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0f172a] text-slate-300 border-slate-600 hover:border-blue-500 hover:bg-slate-700/50'
                  }`}
              >
                {typeTab.label} <span className="ml-1 opacity-80">({typeTab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Review status tabs */}
        <div className="flex border-b border-slate-700 px-6">
          <button
            onClick={() => setTabValue(0)}
            className={`pb-4 px-4 text-sm font-semibold transition-all relative ${tabValue === 0 ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Pending Reviews
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${tabValue === 0 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {filteredPending.length}
            </span>
            {tabValue === 0 && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 animate-in slide-in-from-left-full duration-300"></div>
            )}
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`pb-4 px-4 text-sm font-semibold transition-all relative ${tabValue === 1 ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Reviewed History
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${tabValue === 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {filteredReviewed.length}
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
              <tr className="bg-[#0f172a]">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">Project & File</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">Annotator</th>
                {tabValue === 0 ? (
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">Submitted At</th>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">Reviewed At</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {currentTasks.length === 0 ? (
                <tr>
                  <td colSpan={tabValue === 0 ? 4 : 5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-[#0f172a] border border-slate-700 rounded-full flex items-center justify-center">
                        <SearchIcon className="text-slate-500 w-8 h-8" />
                      </div>
                      <p className="text-slate-400 font-medium">
                        {tabValue === 0
                          ? 'No tasks pending review'
                          : "You haven't reviewed any tasks yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTasks.map((task) => (
                  <tr key={task._id} className="group hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate(`/reviewer/tasks/${task._id}`)}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-100">{task.projectId?.name || 'Unknown Project'}</span>
                        <span className="text-xs text-slate-400 mt-1 flex items-center">
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
                        <span className="text-sm text-slate-200 font-medium">{task.annotatorId?.fullName || task.annotatorId?.username}</span>
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

