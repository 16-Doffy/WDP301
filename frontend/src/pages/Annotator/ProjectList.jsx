import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Backend field name: approved (reviewer approved) + submitted (waiting review) + rejected (need rework)
const getProjStats = (project) => {
  if (!project) return { total: 0, done: 0, waiting: 0, rejected: 0, pct: 0 };

  const subs = project.subtopics || [];
  let total = 0, done = 0, waiting = 0, rejected = 0;

  subs.forEach((sub) => {
    total += sub.total || 0;
    done += sub.approved || 0;       // Da duyet boi reviewer
    waiting += sub.submitted || 0;   // Dang cho review (submitted)
    rejected += sub.rejected || 0;    // Bi tra lai
  });

  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, waiting, rejected, pct };
};

// Calculate project-level status for the annotator
const getProjectStatus = (project) => {
  const { total, done, waiting, rejected } = getProjStats(project);
  if (total === 0) return { label: 'Chua bat dau', color: 'bg-gray-600 text-gray-300', icon: '○' };

  const overdue = project.deadline && new Date(project.deadline) < new Date();

  if (done === total && total > 0) {
    return { label: 'Hoan tat', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', icon: '✓' };
  }
  if (rejected > 0) {
    return { label: 'Co task bi tra lai', color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', icon: '↩' };
  }
  if (waiting > 0) {
    return { label: 'Cho review', color: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30', icon: '⏳' };
  }
  if (done > 0) {
    return { label: 'Dang lam', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30', icon: '▶' };
  }
  if (overdue) {
    return { label: 'Qua han', color: 'bg-rose-500/15 text-rose-400 border border-rose-500/30', icon: '⚠' };
  }
  return { label: 'Chua bat dau', color: 'bg-gray-600/15 text-gray-400 border border-gray-600/30', icon: '○' };
};

const StatusBadge = ({ project }) => {
  const status = getProjectStatus(project);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
      <span>{status.icon}</span>
      {status.label}
    </span>
  );
};

const ProjectCard = ({ project, onOpen }) => {
  const { total, done, waiting, rejected, pct } = getProjStats(project);
  const overdue = project.deadline && new Date(project.deadline) < new Date();

  return (
    <div
      className="group relative rounded-2xl border border-gray-700/60 bg-gray-800/80 p-5 shadow-lg backdrop-blur transition-all duration-200 hover:border-blue-500/40 hover:bg-gray-800 hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer"
      onClick={onOpen}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-gray-100 group-hover:text-blue-300 transition-colors">
            {project.projectName || project.name}
          </h3>
          <p className="mt-1 text-xs text-gray-500 truncate">
            {project.datasetName || project.dataset?.name || 'Dataset'}
          </p>
        </div>
        <StatusBadge project={project} />
      </div>

      {/* Topic */}
      {project.topicName && (
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
            {project.topicName}
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg bg-gray-900/60 p-2.5">
          <p className="text-xs text-gray-500">Tong so item</p>
          <p className="mt-0.5 text-lg font-bold text-gray-200">{total}</p>
        </div>
        <div className="rounded-lg bg-gray-900/60 p-2.5">
          <p className="text-xs text-gray-500">Subtopics</p>
          <p className="mt-0.5 text-lg font-bold text-gray-200">{(project.subtopics || []).length}</p>
        </div>
        <div className="rounded-lg bg-emerald-500/5 p-2.5 border border-emerald-500/10">
          <p className="text-xs text-emerald-500/70">Da hoan thanh</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-400">{done}</p>
        </div>
        <div className="rounded-lg bg-yellow-500/5 p-2.5 border border-yellow-500/10">
          <p className="text-xs text-yellow-500/70">Dang cho review</p>
          <p className="mt-0.5 text-lg font-bold text-yellow-400">{waiting}</p>
        </div>
        {rejected > 0 && (
          <div className="col-span-2 rounded-lg bg-amber-500/5 p-2.5 border border-amber-500/10">
            <p className="text-xs text-amber-500/70">Bi tra ve (lam lai)</p>
            <p className="mt-0.5 text-lg font-bold text-amber-400">{rejected} item</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500">Tien do</span>
          <span className="font-semibold text-gray-300">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Deadline */}
      {project.deadline && (
        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-rose-400' : 'text-gray-500'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Deadline: {fmtDate(project.deadline)}
          {overdue && <span className="ml-1 font-semibold">(Qua han)</span>}
        </div>
      )}

      {/* Hover CTA */}
      <div className="mt-4 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600/0 px-3 py-1.5 text-xs font-semibold text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:bg-blue-600/10">
          Mo project
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
};

const AnnotatorProjectList = () => {
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
      const res = await axios.get(`${API_URL}/api/tasks/annotator-projects`);
      setProjects(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong tai duoc danh sach project');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleOpenProject = (project) => {
    navigate(`/annotator/projects/${project.projectId || project._id}`);
  };

  const filtered = projects.filter((p) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.projectName || p.name || '').toLowerCase().includes(q);
      const matchDataset = (p.datasetName || p.dataset?.name || '').toLowerCase().includes(q);
      const matchTopic = (p.topicName || '').toLowerCase().includes(q);
      if (!matchName && !matchDataset && !matchTopic) return false;
    }

    if (filter === 'all') return true;

    const { total, done, rejected } = getProjStats(p);
    const overdue = p.deadline && new Date(p.deadline) < new Date();

    if (filter === 'completed') return done === total && total > 0;
    if (filter === 'active') return done < total;
    if (filter === 'overdue') return overdue;
    if (filter === 'has_rejected') return rejected > 0;
    if (filter === 'waiting_review') {
      const subs = p.subtopics || [];
      return subs.some((s) => (s.submitted || 0) > 0);
    }
    return true;
  });

  const counts = {
    all: projects.length,
    active: projects.filter((p) => { const { total, done } = getProjStats(p); return done < total && total > 0; }).length,
    completed: projects.filter((p) => { const { total, done } = getProjStats(p); return done === total && total > 0; }).length,
    overdue: projects.filter((p) => p.deadline && new Date(p.deadline) < new Date()).length,
    has_rejected: projects.filter((p) => getProjStats(p).rejected > 0).length,
    waiting_review: projects.filter((p) => (p.subtopics || []).some((s) => (s.submitted || 0) > 0)).length,
  };

  const filterTabs = [
    { key: 'all', label: 'Tat ca' },
    { key: 'active', label: 'Dang lam' },
    { key: 'waiting_review', label: 'Cho review' },
    { key: 'has_rejected', label: 'Bi tra lai' },
    { key: 'completed', label: 'Hoan tat' },
    { key: 'overdue', label: 'Qua han' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Dang tai danh sach project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Cong viec cua toi</h1>
            <p className="mt-1 text-sm text-gray-400">{projects.length} project duoc phan cong</p>
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
              placeholder="Tim kiem project, dataset, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/80 py-3 pl-11 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filter === tab.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-gray-800/80 text-gray-400 hover:text-gray-200 border border-gray-700/60'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  filter === tab.key ? 'bg-blue-500/30' : 'bg-gray-700'
                }`}>
                  {counts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Project Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-12 text-center">
            <svg className="mx-auto w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-gray-400">
              {filter === 'all' && !searchQuery
                ? 'Ban chua co project nao duoc phan cong.'
                : `Khong co project nao phu hop voi "${filter === 'all' ? searchQuery : filter}".`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard
                key={p.projectId || p._id}
                project={p}
                onOpen={() => handleOpenProject(p)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnotatorProjectList;
