import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ReviewerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ pending: [], reviewed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterProject, setFilterProject] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');
  const [projects, setProjects] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/reviews/all');
      setData(res.data);
      const allTasks = [...(res.data.pending || []), ...(res.data.reviewed || [])];
      const uniqueProjects = {};
      allTasks.forEach((t) => {
        const pid = t.projectId?._id || t.projectId;
        if (pid && t.projectId?.name) uniqueProjects[pid] = t.projectId.name;
      });
      setProjects(Object.entries(uniqueProjects).map(([id, name]) => ({ _id: id, name })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const pendingTasks = data.pending || [];
  const reviewedTasks = data.reviewed || [];
  const approvedTasks = reviewedTasks.filter((t) => t.status === 'approved');

  const myPendingCount = pendingTasks.filter((t) => {
    const myReview = t.reviewers?.find((r) => (r.reviewerId?._id || r.reviewerId) === (user?._id || user?.id));
    return myReview?.status === 'pending';
  }).length;

  const myWaitingCount = pendingTasks.filter((t) => {
    const myReview = t.reviewers?.find((r) => (r.reviewerId?._id || r.reviewerId) === (user?._id || user?.id));
    return myReview?.status === 'approved' || myReview?.status === 'rejected';
  }).length;

  const consensusRate = reviewedTasks.length > 0 ? Math.round((approvedTasks.length / reviewedTasks.length) * 100) : 0;

  const allTasks = [...pendingTasks, ...reviewedTasks];
  const filtered = allTasks.filter((t) => {
    const matchesSearch = !searchTerm ||
      (t.projectId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.datasetId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.annotatorId?.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = filterProject === 'all' || (t.projectId?._id || t.projectId) === filterProject;
    let matchesStatus = true;
    if (filterStatus === 'pending') matchesStatus = t.status === 'submitted';
    else if (filterStatus === 'approved') matchesStatus = t.status === 'approved';
    else if (filterStatus === 'rejected') matchesStatus = t.status === 'rejected';
    return matchesSearch && matchesProject && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'deadline') {
      const aDate = a.projectId?.deadline ? new Date(a.projectId.deadline) : new Date('9999');
      const bDate = b.projectId?.deadline ? new Date(b.projectId.deadline) : new Date('9999');
      return aDate - bDate;
    }
    const aDate = a.submittedAt ? new Date(a.submittedAt) : new Date('9999');
    const bDate = b.submittedAt ? new Date(b.submittedAt) : new Date('9999');
    return bDate - aDate;
  });

  const getTaskKind = (task) => {
    const mt = (task?.dataItem?.mimeType || '').toLowerCase();
    const fn = (task?.dataItem?.filename || task?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fn)) return 'image';
    if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fn)) return 'audio';
    return 'text';
  };

  const getMyVoteStatus = (task) => {
    if (!user) return null;
    const myReview = task.reviewers?.find((r) => (r.reviewerId?._id || r.reviewerId) === (user?._id || user?.id));
    return myReview?.status || null;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Reviewer Dashboard</h1>
              <p className="mt-1 text-sm text-gray-400">Quality control for annotation projects</p>
            </div>
            <button onClick={fetchData} className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Awaiting My Vote', value: myPendingCount, color: 'text-blue-400', border: 'border-blue-700/40' },
            { label: 'Waiting Finalize', value: myWaitingCount, color: 'text-amber-400', border: 'border-amber-700/40' },
            { label: 'Approved', value: approvedTasks.length, color: 'text-emerald-400', border: 'border-emerald-700/40' },
            { label: 'Consensus Rate', value: consensusRate + '%', color: 'text-violet-400', border: 'border-violet-700/40' },
          ].map((stat, idx) => (
            <div key={idx} className={'rounded-xl border bg-gray-800 p-4 shadow-lg ' + stat.border}>
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className={'text-2xl font-bold ' + stat.color}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Search project, dataset, annotator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-lg border border-gray-600 bg-gray-900 py-2 px-3 text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-gray-200 focus:border-blue-500 focus:outline-none">
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Status</option>
            </select>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-gray-200 focus:border-blue-500 focus:outline-none">
              <option value="all">All Projects</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-gray-200 focus:border-blue-500 focus:outline-none">
              <option value="deadline">Sort by Deadline</option>
              <option value="submitted">Sort by Submitted</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center">
              <p className="text-gray-400">No tasks found matching your filters.</p>
            </div>
          ) : sorted.map((task) => {
            const kind = getTaskKind(task);
            const myVote = getMyVoteStatus(task);
            const overdue = task.projectId?.deadline && new Date(task.projectId.deadline) < new Date();
            const kindLabel = kind === 'image' ? 'IMG' : kind === 'audio' ? 'AUD' : 'TXT';
            const kindColor = kind === 'image' ? 'bg-sky-500/10 text-sky-300' : kind === 'audio' ? 'bg-violet-500/10 text-violet-300' : 'bg-emerald-500/10 text-emerald-300';

            return (
              <div key={task._id} className={'rounded-xl border bg-gray-800 p-4 transition hover:border-gray-600 ' + (overdue ? 'border-rose-700/50' : 'border-gray-700')}>
                <div className="flex items-center gap-4">
                  <div className={'flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ' + kindColor}>{kindLabel}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="truncate text-sm font-semibold text-gray-100">{task.projectId?.name || 'Unknown Project'}</h3>
                      <span className="text-xs text-gray-500">| {task.datasetId?.name || 'Unknown Dataset'}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>Annotator: <span className="text-gray-300">{task.annotatorId?.fullName || task.annotatorId?.username || 'N/A'}</span></span>
                      {task.submittedAt && <span>Submitted: <span className="text-gray-300">{new Date(task.submittedAt).toLocaleString('vi-VN')}</span></span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <div className="hidden sm:flex gap-1">
                      {(task.reviewers || []).map((r, idx) => (
                        <div key={idx} className={'w-2.5 h-2.5 rounded-full ' + (r.status === 'approved' ? 'bg-emerald-500' : r.status === 'rejected' ? 'bg-rose-500' : 'bg-gray-600')} title={'Reviewer ' + (idx + 1) + ': ' + r.status} />
                      ))}
                    </div>
                    {myVote && (
                      <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + (myVote === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : myVote === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-700 text-gray-400')}>
                        YOU: {myVote.toUpperCase()}
                      </span>
                    )}
                    <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (task.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : task.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400')}>
                      {task.status === 'submitted' ? 'PENDING' : task.status.toUpperCase()}
                    </span>
                    {overdue && <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400">OVERDUE</span>}
                    <button onClick={() => navigate('/reviewer/tasks/' + task._id)}
                      className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      {task.status === 'submitted' && myVote === 'pending' ? 'Review' : 'View'}
                    </button>
                  </div>
                </div>
                {task.status === 'rejected' && task.reviewComments && (
                  <div className="mt-2 rounded border border-rose-700/30 bg-rose-500/5 px-3 py-1.5">
                    <p className="text-xs text-rose-300 truncate">Comment: {task.reviewComments}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;