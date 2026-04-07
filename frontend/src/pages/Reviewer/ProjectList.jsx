import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getProjectStatus = (stats, deadline) => {
  const overdue = deadline && new Date(deadline) < new Date();
  if (!stats || stats.total === 0) return { label: 'Chua co bai de review', color: 'bg-gray-600 text-gray-300', icon: '○' };
  if (stats.reviewed === stats.total) {
    if (stats.rejected === stats.total) {
      return { label: 'Da reject het', color: 'bg-rose-500/15 text-rose-400 border border-rose-500/30', icon: '✗' };
    }
    return { label: 'Da review xong', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', icon: '✓' };
  }
  if (stats.rejected > 0) {
    return { label: 'Cho annotator sua lai', color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', icon: '↩' };
  }
  if (stats.pending > 0) {
    return { label: 'Dang review', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30', icon: '▶' };
  }
  if (overdue) {
    return { label: 'Qua han', color: 'bg-rose-500/15 text-rose-400 border border-rose-500/30', icon: '⚠' };
  }
  return { label: 'Dang review', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30', icon: '▶' };
};

const StatusBadge = ({ stats, deadline }) => {
  const status = getProjectStatus(stats, deadline);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
      <span>{status.icon}</span>
      {status.label}
    </span>
  );
};

const ProjectCard = ({ project, onOpen }) => {
  const stats = project.stats || {};
  const overdue = project.deadline && new Date(project.deadline) < new Date();

  return (
    <div
      className="group relative rounded-2xl border border-gray-700/60 bg-gray-800/80 p-5 shadow-lg backdrop-blur transition-all duration-200 hover:border-violet-500/40 hover:bg-gray-800 hover:shadow-xl cursor-pointer"
      onClick={onOpen}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-gray-100 group-hover:text-violet-300 transition-colors">
            {project.name}
          </h3>
          <p className="mt-1 text-xs text-gray-500 truncate">
            {project.datasetId?.name || project.datasetName || 'Dataset'}
          </p>
        </div>
        <StatusBadge stats={stats} deadline={project.deadline} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-gray-900/60 p-2.5 text-center">
          <p className="text-lg font-bold text-gray-200">{stats.total || 0}</p>
          <p className="text-xs text-gray-500">Tong item</p>
        </div>
        <div className="rounded-lg bg-yellow-500/5 p-2.5 text-center border border-yellow-500/10">
          <p className="text-lg font-bold text-yellow-400">{stats.pending || 0}</p>
          <p className="text-xs text-yellow-500/70">Can review</p>
        </div>
        <div className="rounded-lg bg-emerald-500/5 p-2.5 text-center border border-emerald-500/10">
          <p className="text-lg font-bold text-emerald-400">{stats.reviewed || 0}</p>
          <p className="text-xs text-emerald-500/70">Da review</p>
        </div>
      </div>

      {/* Approved / Rejected row */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg bg-gray-900/40 p-2 text-center">
          <p className="text-sm font-bold text-emerald-400">{stats.approved || 0} approved</p>
        </div>
        <div className="rounded-lg bg-gray-900/40 p-2 text-center">
          <p className="text-sm font-bold text-rose-400">{stats.rejected || 0} rejected</p>
        </div>
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">Tien do review</span>
            <span className="font-semibold text-gray-300">
              {stats.reviewed}/{stats.total}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-700/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.reviewed === stats.total
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'
              }`}
              style={{ width: `${stats.total ? Math.round((stats.reviewed / stats.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Deadline */}
      {project.deadline && (
        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-rose-400' : 'text-gray-500'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Deadline: {fmtDateTime(project.deadline)}
          {overdue && <span className="ml-1 font-semibold">(Qua han)</span>}
        </div>
      )}

      {/* Hover CTA */}
      <div className="mt-4 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-violet-400 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:bg-violet-600/10">
          Mo review
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
};

const ReviewerProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/reviews/projects`);
      const projectList = res.data || [];

      // Enrich with review stats per project
      const enriched = await Promise.all(
        projectList.map(async (p) => {
          try {
            const statsRes = await axios.get(`${API_URL}/api/reviews/projects/${p._id}/stats`);
            return { ...p, stats: statsRes.data || {} };
          } catch {
            return { ...p, stats: { total: 0, pending: 0, approved: 0, rejected: 0, reviewed: 0 } };
          }
        })
      );

      setProjects(enriched);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong tai duoc danh sach project');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleOpenProject = (project) => {
    navigate(`/reviewer/projects/${project._id}`);
  };

  const filtered = projects.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchDataset = (p.datasetId?.name || '') .toLowerCase().includes(q);
      if (!matchName && !matchDataset) return false;
    }

    if (filter === 'all') return true;
    const s = p.stats || {};
    const overdue = p.deadline && new Date(p.deadline) < new Date();

    if (filter === 'pending') return (s.pending || 0) > 0;
    if (filter === 'reviewed') return s.reviewed === s.total && s.total > 0;
    if (filter === 'has_rejected') return (s.rejected || 0) > 0;
    if (filter === 'overdue') return overdue;
    return true;
  });

  const counts = {
    all: projects.length,
    pending: projects.filter((p) => (p.stats?.pending || 0) > 0).length,
    reviewed: projects.filter((p) => p.stats?.reviewed === p.stats?.total && p.stats?.total > 0).length,
    has_rejected: projects.filter((p) => (p.stats?.rejected || 0) > 0).length,
    overdue: projects.filter((p) => p.deadline && new Date(p.deadline) < new Date()).length,
  };

  const filterTabs = [
    { key: 'all', label: 'Tat ca' },
    { key: 'pending', label: 'Can review' },
    { key: 'has_rejected', label: 'Bi reject' },
    { key: 'reviewed', label: 'Da xong' },
    { key: 'overdue', label: 'Qua han' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-violet-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Dang tai danh sach project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-gray-700/60 bg-gray-800/80 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Cong viec Review</h1>
              <p className="mt-1 text-sm text-gray-400">
                {projects.length} project &mdash; {projects.reduce((acc, p) => acc + (p.stats?.pending || 0), 0)} item can review
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Tim kiem project, dataset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/80 py-3 pl-11 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filter === tab.key
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-800/80 text-gray-400 hover:text-gray-200 border border-gray-700/60'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  filter === tab.key ? 'bg-violet-500/30' : 'bg-gray-700'
                }`}>
                  {counts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Project Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-12 text-center">
            <svg className="mx-auto w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-gray-400">
              {filter === 'all' && !searchQuery
                ? 'Ban chua co project nao duoc phan cong review.'
                : 'Khong co project nao phu hop.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p._id} project={p} onOpen={() => handleOpenProject(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerProjectList;