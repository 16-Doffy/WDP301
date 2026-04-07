import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

// Status helpers
const getTaskStatusLabel = (status) => {
  const map = {
    assigned: { label: 'Chua lam', color: 'bg-gray-500/15 text-gray-400 border border-gray-500/30' },
    in_progress: { label: 'Dang lam', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    completed: { label: 'Da xong (cho review)', color: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' },
    submitted: { label: 'Dang cho review', color: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
    approved: { label: 'Da duyet', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
    rejected: { label: 'Bi tra lai', color: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
    revised: { label: 'Dang sua lai', color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  };
  return map[status] || { label: status, color: 'bg-gray-500/15 text-gray-400 border border-gray-500/30' };
};

const getSubtopicStatus = (sub) => {
  const total = sub.total || 0;
  // Backend: approved includes BOTH truly-approved AND submitted tasks
  // (backend: case 'submitted': subtopic.submitted++; subtopic.approved++)
  // So approved = approved + submitted, and remaining = total - approved - rejected
  const approvedInclSubmitted = sub.approved || 0;
  const done = sub.submitted || 0;       // Only truly submitted (waiting review)
  const rejected = sub.rejected || 0;
  const remaining = total - approvedInclSubmitted - rejected;

  if (total === 0) return { label: 'Chua co item', color: 'text-gray-500', icon: '○' };
  // approvedInclSubmitted = all tasks either approved or submitted (waiting review)
  if (approvedInclSubmitted + rejected === total) return { label: 'Hoan tat', color: 'text-emerald-400', icon: '✓' };
  if (rejected > 0) return { label: 'Co item bi tra lai', color: 'text-amber-400', icon: '↩' };
  if (done > 0) return { label: 'Dang cho review', color: 'text-yellow-400', icon: '⏳' };
  if (approvedInclSubmitted > 0) return { label: 'Dang lam', color: 'text-blue-400', icon: '▶' };
  return { label: 'Chua bat dau', color: 'text-gray-400', icon: '○' };
};

const SubtopicCard = ({ sub, onStart }) => {
  const total = sub.total || 0;
  const approvedInclSubmitted = sub.approved || 0;   // includes both approved + submitted
  const done = sub.submitted || 0;                    // truly submitted waiting review
  const rejected = sub.rejected || 0;
  const remaining = Math.max(0, total - approvedInclSubmitted - rejected);
  const status = getSubtopicStatus(sub);
  const pct = total ? Math.round((approvedInclSubmitted / total) * 100) : 0;

  // Determine button state
  let btnText = 'Bat dau';
  let btnColor = 'bg-violet-600 hover:bg-violet-700 text-white';
  if (approvedInclSubmitted + rejected === total && total > 0) {
    btnText = 'Xem lai';
    btnColor = 'bg-emerald-600 hover:bg-emerald-700 text-white';
  } else if (rejected > 0) {
    btnText = 'Lam lai';
    btnColor = 'bg-amber-600 hover:bg-amber-700 text-white';
  } else if (approvedInclSubmitted > 0) {
    btnText = 'Tiep tuc';
    btnColor = 'bg-blue-600 hover:bg-blue-700 text-white';
  }

  return (
    <div className="group relative rounded-xl border border-gray-700/60 bg-gray-800/60 p-4 transition-all duration-200 hover:border-blue-500/40 hover:bg-gray-800">
      {/* Subtopic name & status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-100 group-hover:text-blue-300 transition-colors">
            {sub.subtopicName || sub.name || 'Subtopic'}
          </h3>
          {sub.guideline && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{sub.guideline}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
          <span>{status.icon}</span>
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-gray-900/60 p-2 text-center">
          <p className="text-lg font-bold text-gray-200">{total}</p>
          <p className="text-xs text-gray-500">Tong item</p>
        </div>
        <div className="rounded-lg bg-yellow-500/5 p-2 text-center border border-yellow-500/10">
          <p className="text-lg font-bold text-yellow-400">{done}</p>
          <p className="text-xs text-yellow-500/70">Cho review</p>
        </div>
        <div className="rounded-lg bg-emerald-500/5 p-2 text-center border border-emerald-500/10">
          <p className="text-lg font-bold text-emerald-400">{rejected}</p>
          <p className="text-xs text-emerald-500/70">Bi tra lai</p>
        </div>
      </div>

      {/* Second row: remaining + approved */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-gray-900/40 p-2 text-center">
          <p className="text-sm font-bold text-gray-400">{remaining}</p>
          <p className="text-xs text-gray-600">Chua lam</p>
        </div>
        <div className="rounded-lg bg-gray-900/40 p-2 text-center">
          <p className="text-sm font-bold text-gray-400">{approvedInclSubmitted}</p>
          <p className="text-xs text-gray-600">Da xong</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Tien do</span>
          <span className="font-medium text-gray-300">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={() => onStart(sub)}
        className={`w-full rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all duration-200 ${btnColor}`}
      >
        {btnText}
      </button>
    </div>
  );
};

const AnnotatorProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/tasks/annotator-projects`);
      const allProjects = res.data || [];
      const found = allProjects.find((p) => p.projectId === projectId || p._id === projectId);
      setProject(found || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong tai duoc thong tin project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleStartSubtopic = async (sub) => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks/my-tasks`, {
        params: { subtopicId: sub.subtopicId || sub._id },
      });
      const tasks = res.data || [];

      // Priority: rejected > in_progress > assigned > completed > submitted
      const priorityOrder = ['rejected', 'revised', 'in_progress', 'assigned', 'completed', 'submitted'];
      let target = tasks.find((t) => priorityOrder.includes(t.status)) || tasks[0];

      if (target) {
        navigate(`/annotator/workspace/${sub.subtopicId || sub._id}?taskId=${target._id}`);
      } else {
        alert('Khong co task nao trong subtopic nay.');
      }
    } catch {
      alert('Khong tai duoc task.');
    }
  };

  // Compute overall project stats
  const computeProjectStats = () => {
    if (!project) return { total: 0, done: 0, waiting: 0, rejected: 0, pct: 0 };
    const subs = project.subtopics || [];
    let total = 0, done = 0, waiting = 0, rejected = 0;
    subs.forEach((s) => {
      total += s.total || 0;
      done += s.approved || 0;        // includes approved + submitted (backend logic)
      waiting += s.submitted || 0;    // truly submitted (waiting review)
      rejected += s.rejected || 0;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, waiting, rejected, pct };
  };

  const { total, done, waiting, rejected, pct } = computeProjectStats();
  const overdue = project?.deadline && new Date(project.deadline) < new Date();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Dang tai thong tin project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="mx-auto w-12 h-12 text-rose-500/60 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-400 mb-4">{error || 'Khong tim thay project nay.'}</p>
          <button
            onClick={() => navigate('/annotator/tasks')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 transition"
          >
            Quay lai danh sach project
          </button>
        </div>
      </div>
    );
  }

  const guideline = project.guidelines || project.guideline || project.projectId?.guidelines || '';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/annotator/tasks')}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800/80 px-3 py-1.5 text-sm text-gray-400 border border-gray-700/60 hover:text-gray-200 hover:border-gray-600 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lai
          </button>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-sm text-gray-500 truncate">{project.projectName || project.name}</span>
        </div>

        {/* Project Header */}
        <div className="rounded-2xl border border-gray-700/60 bg-gray-800/80 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-100 mb-1">
                {project.projectName || project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                {project.datasetName || project.dataset?.name ? (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    {project.datasetName || project.dataset?.name}
                  </span>
                ) : null}
                {project.topicName ? (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {project.topicName}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Deadline */}
            {project.deadline && (
              <div className={`shrink-0 rounded-xl px-4 py-3 border ${
                overdue
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-gray-900/60 border-gray-700/60 text-gray-300'
              }`}>
                <p className="text-xs font-medium mb-0.5">{overdue ? 'Qua han!' : 'Deadline'}</p>
                <p className="text-lg font-bold">{fmtDateTime(project.deadline)}</p>
              </div>
            )}
          </div>

          {/* Overall stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-5">
            <div className="rounded-lg bg-gray-900/60 p-3">
              <p className="text-xs text-gray-500">Tong so item</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-200">{total}</p>
            </div>
            <div className="rounded-lg bg-yellow-500/5 p-3 border border-yellow-500/10">
              <p className="text-xs text-yellow-500/70">Dang cho review</p>
              <p className="mt-0.5 text-2xl font-bold text-yellow-400">{waiting}</p>
            </div>
            <div className="rounded-lg bg-rose-500/5 p-3 border border-rose-500/10">
              <p className="text-xs text-rose-500/70">Bi tra lai</p>
              <p className="mt-0.5 text-2xl font-bold text-rose-400">{rejected}</p>
            </div>
            <div className="rounded-lg bg-gray-900/60 p-3">
              <p className="text-xs text-gray-500">Da nop / Da duyet</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-200">{done}</p>
            </div>
          </div>

          {/* Overall progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-400 font-medium">Tien do tong the</span>
              <span className="text-gray-200 font-semibold">{pct}% ({done}/{total} items)</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-700/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Guidelines toggle */}
          {guideline && (
            <div className="mt-4 border-t border-gray-700/60 pt-4">
              <button
                onClick={() => setShowGuidelines(!showGuidelines)}
                className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showGuidelines ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Huong dan ghi nhan (Guidelines)
              </button>
              {showGuidelines && (
                <div className="mt-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{guideline}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtopics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">
              Subtopics ({project.subtopics?.length || 0})
            </h2>
            <p className="text-sm text-gray-500">
              Chia nho cong viec theo subtopic de de quan ly
            </p>
          </div>

          {!project.subtopics || project.subtopics.length === 0 ? (
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-12 text-center">
              <svg className="mx-auto w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m2 0h5" />
              </svg>
              <p className="text-gray-500">Chua co subtopic nao trong project nay.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {project.subtopics.map((sub) => (
                <SubtopicCard
                  key={sub.subtopicId || sub._id}
                  sub={sub}
                  onStart={handleStartSubtopic}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnotatorProjectDetail;
