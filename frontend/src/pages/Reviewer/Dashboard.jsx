import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const ReviewerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAnnotators, setSelectedAnnotators] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/reviews/all', {
        headers: { Authorization: 'Bearer ' + getAuthToken() }
      });
      const uniqueProjects = {};
      (res.data.pending || []).forEach((t) => {
        const pid = t.projectId?._id || t.projectId;
        if (pid && !uniqueProjects[pid]) {
          uniqueProjects[pid] = { projectId: pid, name: t.projectId?.name || 'Unknown Project', deadline: t.projectId?.deadline || null, tasks: [] };
        }
        if (pid) uniqueProjects[pid].tasks.push(t);
      });
      setProjects(Object.values(uniqueProjects));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const sameId = (a, b) => String(a || '') === String(b || '');

  const getMyVote = (task) => {
    if (!user) return null;
    const r = task.reviewers?.find((rev) => sameId(rev.reviewerId?._id || rev.reviewerId, user?._id || user?.id));
    return r?.status || null;
  };

  const projectGroups = useMemo(() => {
    return projects.map((pg) => {
      const tasks = pg.tasks || [];
      const byAnnotator = {};
      tasks.forEach((t) => {
        const aid = String(t.annotatorId?._id || t.annotatorId || '');
        const aname = t.annotatorId?.fullName || t.annotatorId?.username || 'Unknown';
        if (!byAnnotator[aid]) byAnnotator[aid] = { annotatorId: aid, annotatorName: aname, tasks: [] };
        byAnnotator[aid].tasks.push(t);
      });
      const annotators = Object.values(byAnnotator);
      const pending = tasks.filter((t) => t.status === 'submitted').length;
      const approved = tasks.filter((t) => t.status === 'approved').length;
      const rejected = tasks.filter((t) => t.status === 'rejected').length;
      const notSubmitted = tasks.filter((t) => ['assigned', 'in_progress', 'completed'].includes(t.status)).length;
      return { ...pg, annotators, pending, approved, rejected, notSubmitted };
    });
  }, [projects]);

  const toggleProject = (projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const toggleAnnotator = (projectId, annotatorId) => {
    setSelectedAnnotators((prev) => {
      const cur = new Set(prev[projectId] || []);
      if (cur.has(annotatorId)) cur.delete(annotatorId);
      else cur.add(annotatorId);
      return { ...prev, [projectId]: Array.from(cur) };
    });
  };

  const selectAll = (projectId, allIds) => {
    setSelectedAnnotators((prev) => ({ ...prev, [projectId]: [...allIds] }));
  };

  const clearAll = (projectId) => {
    setSelectedAnnotators((prev) => ({ ...prev, [projectId]: [] }));
  };

  const openReview = (pg) => {
    const sel = selectedAnnotators[pg.projectId] || [];
    if (sel.length === 0) { alert('Chon it nhat 1 annotator'); return; }
    const eligible = pg.tasks
      .filter((t) => {
        const aid = String(t.annotatorId?._id || t.annotatorId || '');
        if (!sel.includes(aid)) return false;
        const v = getMyVote(t);
        return t.status === 'submitted' && (!v || v === 'pending');
      })
      .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    if (eligible.length === 0) { alert('Khong co bai nao cho review'); return; }
    navigate('/reviewer/tasks/' + eligible[0]._id);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 text-gray-200">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Reviewer Dashboard</h1>
            <p className="text-xs text-gray-400">Quality control</p>
          </div>
          <button onClick={fetchData} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded border border-rose-700/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
        )}

        {projectGroups.length === 0 && (
          <div className="rounded border border-gray-700 bg-gray-800 p-8 text-center">
            <p className="text-gray-400 text-sm">Khong co project nao can review.</p>
          </div>
        )}

        {projectGroups.map((pg) => {
          const isOpen = expandedProjects[pg.projectId];
          const sel = selectedAnnotators[pg.projectId] || [];
          const allIds = pg.annotators.map((a) => a.annotatorId);

          return (
            <div key={pg.projectId} className="rounded border border-gray-700 bg-gray-800">
              {/* Compact project header */}
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition"
                onClick={() => toggleProject(pg.projectId)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={"text-xs transition-transform " + (isOpen ? 'rotate-90' : '')}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-100 truncate">{pg.name}</p>
                    <p className="text-xs text-gray-500">
                      {pg.deadline ? new Date(pg.deadline).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''} &bull; {pg.tasks.length} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pg.pending > 0 && <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 font-medium">{pg.pending} cho</span>}
                  {pg.approved > 0 && <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 font-medium">{pg.approved} ok</span>}
                  <span className="text-xs text-gray-500">{pg.annotators.length} annotator</span>
                </div>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-gray-700 px-4 py-3 space-y-2">
                  {/* Controls */}
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => selectAll(pg.projectId, allIds)} className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">All</button>
                    <button onClick={() => clearAll(pg.projectId)} className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">Bo</button>
                    <button onClick={() => openReview(pg)} disabled={sel.length === 0}
                      className="ml-auto rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      Review ({sel.length})
                    </button>
                  </div>

                  {/* Annotator list */}
                  {pg.annotators.map((a) => {
                    const checked = sel.includes(a.annotatorId);
                    const aPending = a.tasks.filter((t) => t.status === 'submitted').length;
                    const aApproved = a.tasks.filter((t) => t.status === 'approved').length;
                    const aNotSubmitted = a.tasks.filter((t) => ['assigned', 'in_progress', 'completed'].includes(t.status)).length;
                    const aEligible = a.tasks.filter((t) => {
                      const v = getMyVote(t);
                      return t.status === 'submitted' && (!v || v === 'pending');
                    });

                    return (
                      <div key={a.annotatorId} className={"flex items-center justify-between rounded border px-3 py-2 text-xs " + (checked ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 bg-gray-900')}>
                        <div className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" checked={checked} onChange={() => toggleAnnotator(pg.projectId, a.annotatorId)} className="h-3.5 w-3.5 cursor-pointer flex-shrink-0" />
                          <span className="text-gray-200 font-medium truncate">{a.annotatorName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {aPending > 0 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">{aPending}</span>}
                          {aApproved > 0 && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{aApproved}</span>}
                          {aNotSubmitted > 0 && <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-400">{aNotSubmitted}</span>}
                          {aEligible.length > 0 && (
                            <button onClick={() => navigate('/reviewer/tasks/' + aEligible[0]._id)}
                              className="rounded bg-blue-600 px-2 py-0.5 text-white font-medium hover:bg-blue-700">
                              Mo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewerDashboard;
