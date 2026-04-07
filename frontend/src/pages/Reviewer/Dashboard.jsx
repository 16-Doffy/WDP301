import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');
const sameId = (a, b) => String(a || '') === String(b || '');

const statusColor = (s) => {
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (s === 'rejected') return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  if (s === 'submitted') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  if (s === 'in_progress') return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  return 'bg-gray-700/50 text-gray-400 border-gray-600/30';
};

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtRelative = (d) => {
  if (!d) return null;
  const now = new Date();
  const deadline = new Date(d);
  const diff = deadline - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diff < 0) {
    const overDays = Math.abs(days);
    if (overDays > 0) return overDays + ' ngay truoc';
    return Math.abs(hours) + ' gio truoc';
  }
  if (days > 0) return days + ' ngay';
  if (hours > 0) return hours + ' gio';
  return 'Sap den han';
};

const ReviewerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState({ pending: [], reviewed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAnnotators, setSelectedAnnotators] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});
  const [showQueue, setShowQueue] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/reviews/all', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
      setAllTasks({
        pending: res.data.pending || [],
        reviewed: res.data.reviewed || [],
      });
    } catch (err) { setError(err.response?.data?.message || 'Failed'); } finally { setLoading(false); }
  };

  const getMyVote = (task) => {
    if (!user) return null;
    const r = task.reviewers?.find((rev) => sameId(rev.reviewerId?._id || rev.reviewerId, user?._id || user?.id));
    return r?.status || null;
  };

  const projectGroups = useMemo(() => {
    const all = [...allTasks.pending, ...allTasks.reviewed];
    const projMap = {};
    all.forEach((t) => {
      const pid = t.projectId?._id || t.projectId;
      if (!pid) return;
      if (!projMap[pid]) {
        projMap[pid] = {
          projectId: pid,
          name: t.projectId?.name || 'Unknown',
          deadline: t.projectId?.deadline || null,
          tasks: [],
        };
      }
      projMap[pid].tasks.push(t);
    });
    return Object.values(projMap).map((pg) => {
      const byAnno = {};
      pg.tasks.forEach((t) => {
        const aid = String(t.annotatorId?._id || t.annotatorId || '');
        const aname = t.annotatorId?.fullName || t.annotatorId?.username || 'Unknown';
        if (!byAnno[aid]) byAnno[aid] = { annotatorId: aid, annotatorName: aname, tasks: [] };
        byAnno[aid].tasks.push(t);
      });
      const annotators = Object.values(byAnno);
      const submitted = pg.tasks.filter((t) => t.status === 'submitted').length;
      const approved = pg.tasks.filter((t) => t.status === 'approved').length;
      const rejected = pg.tasks.filter((t) => t.status === 'rejected').length;
      const assigned = pg.tasks.filter((t) => ['assigned', 'in_progress', 'completed', 'revised'].includes(t.status)).length;
      const overdue = pg.deadline && new Date(pg.deadline) < new Date();
      return { ...pg, annotators, submitted, approved, rejected, assigned, overdue };
    });
  }, [allTasks]);

  const toggleProject = (pid) => setExpandedProjects((p) => ({ ...p, [pid]: !p[pid] }));

  const toggleAnnotator = (pid, aid) => {
    setSelectedAnnotators((p) => {
      const cur = new Set(p[pid] || []);
      if (cur.has(aid)) cur.delete(aid); else cur.add(aid);
      return { ...p, [pid]: Array.from(cur) };
    });
    if (!showQueue[pid]) setShowQueue((p) => ({ ...p, [pid]: true }));
  };

  const toggleQueue = (pid) => setShowQueue((p) => ({ ...p, [pid]: !p[pid] }));

  const openReview = (pg) => {
    const sel = selectedAnnotators[pg.projectId] || [];
    if (sel.length === 0) { alert('Chon it nhat 1 annotator'); return; }
    const anns = sel.join(',');
    const eligible = pg.tasks
      .filter((t) => {
        const aid = String(t.annotatorId?._id || t.annotatorId || '');
        if (!sel.includes(aid)) return false;
        return t.status === 'submitted' && (!getMyVote(t) || getMyVote(t) === 'pending');
      })
      .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    if (eligible.length === 0) { alert('Khong co task nao de review'); return; }
    navigate('/reviewer/tasks/' + eligible[0]._id + '?anns=' + anns);
  };

  const queueTasks = (pg) => {
    const sel = selectedAnnotators[pg.projectId] || [];
    if (sel.length === 0) return pg.tasks;
    return pg.tasks.filter((t) => {
      const aid = String(t.annotatorId?._id || t.annotatorId || '');
      return sel.includes(aid);
    });
  };

  const queueTasksSorted = (pg) => {
    return queueTasks(pg).sort((a, b) => {
      const sa = getMyVote(a);
      const sb = getMyVote(b);
      if (sa === 'pending' && sb !== 'pending') return -1;
      if (sa !== 'pending' && sb === 'pending') return 1;
      return new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0);
    });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-900"><div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Review Dashboard</h1>
            <p className="mt-1 text-sm text-gray-400">Tong hop project va task cho reviewer</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center">
            <p className="text-xl font-bold text-gray-100">{projectGroups.length}</p>
            <p className="text-xs text-gray-400">Project</p>
          </div>
          <div className="rounded-xl border border-amber-700/30 bg-amber-500/5 p-4 text-center">
            <p className="text-xl font-bold text-amber-400">{projectGroups.reduce((s, p) => s + p.submitted, 0)}</p>
            <p className="text-xs text-gray-400">Can Review</p>
          </div>
          <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-4 text-center">
            <p className="text-xl font-bold text-emerald-400">{projectGroups.reduce((s, p) => s + p.approved, 0)}</p>
            <p className="text-xs text-gray-400">Approved</p>
          </div>
          <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-4 text-center">
            <p className="text-xl font-bold text-rose-400">{projectGroups.reduce((s, p) => s + p.rejected, 0)}</p>
            <p className="text-xs text-gray-400">Rejected</p>
          </div>
          <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-4 text-center">
            <p className="text-xl font-bold text-rose-400">{projectGroups.filter(p => p.overdue).length}</p>
            <p className="text-xs text-gray-400">Project Quá Hạn</p>
          </div>
        </div>

        {projectGroups.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center text-gray-400">Chua co project nao</div>
        ) : projectGroups.map((pg) => {
          const expanded = expandedProjects[pg.projectId];
          const sel = selectedAnnotators[pg.projectId] || [];
          const queueVisible = showQueue[pg.projectId];
          const qTasks = queueTasksSorted(pg);
          const selTasks = sel.length > 0 ? qTasks.filter((t) => t.status === 'submitted' && (!getMyVote(t) || getMyVote(t) === 'pending')).length : 0;

          return (
            <div key={pg.projectId} className="mb-4 rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/30" onClick={() => toggleProject(pg.projectId)}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{expanded ? String.fromCharCode(9650) : String.fromCharCode(9654)}</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">{pg.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {pg.deadline && (
                        <span className={'text-xs ' + (pg.overdue ? 'text-rose-400' : 'text-gray-400')}>
                          Deadline: {fmtDate(pg.deadline)} {pg.overdue ? '(Qua han)' : ''}
                        </span>
                      )}
                      {pg.deadline && !pg.overdue && (
                        <span className="text-xs text-amber-400">{fmtRelative(pg.deadline)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {pg.submitted > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">{pg.submitted} pending</span>
                    )}
                    {pg.approved > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">{pg.approved} approved</span>
                    )}
                    {pg.rejected > 0 && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">{pg.rejected} rejected</span>
                    )}
                    {pg.assigned > 0 && (
                      <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs font-semibold text-gray-400">{pg.assigned} assigned</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{pg.annotators.length} annotator{pg.annotators.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-gray-700">
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-300">Chon Annotator de Review:</h4>
                      <div className="flex gap-2">
                        {sel.length > 0 && (
                          <button onClick={() => openReview(pg)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
                            Review ({selTasks})
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setSelectedAnnotators((p) => ({ ...p, [pg.projectId]: pg.annotators.map((a) => a.annotatorId) })); }} className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500">All</button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedAnnotators((p) => ({ ...p, [pg.projectId]: [] })); }} className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white">Clear</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pg.annotators.map((a) => {
                        const isSel = sel.includes(a.annotatorId);
                        const submitted = a.tasks.filter((t) => t.status === 'submitted').length;
                        const total = a.tasks.length;
                        return (
                          <button key={a.annotatorId} onClick={(e) => { e.stopPropagation(); toggleAnnotator(pg.projectId, a.annotatorId); }}
                            className={'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ' + (isSel ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500')}>
                            <div className={'w-2 h-2 rounded-full ' + (isSel ? 'bg-blue-400' : 'bg-gray-600')} />
                            <div>
                              <p className="font-medium">{a.annotatorName}</p>
                              <p className="text-xs opacity-70">{submitted} pending / {total}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {sel.length > 0 && (
                    <div>
                      <button onClick={() => toggleQueue(pg.projectId)} className="flex w-full items-center justify-between p-4 hover:bg-gray-700/20 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{queueVisible ? String.fromCharCode(9650) : String.fromCharCode(9654)}</span>
                          <h4 className="text-sm font-semibold text-gray-200">Review Queue ({qTasks.length} tasks)</h4>
                          {selTasks > 0 && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{selTasks} Project cần Review</span>}
                        </div>
                        {qTasks.length > 0 && <button onClick={(e) => { e.stopPropagation(); openReview(pg); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">Review tu day</button>}
                      </button>

                      {queueVisible && (
                        <div className="max-h-96 overflow-y-auto">
                          {qTasks.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">Khong co task nao</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-gray-900 text-gray-400 sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold">Annotator</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold">Task</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold">Submitted</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold">Status</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold">Your Vote</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {qTasks.map((t) => {
                                  const vote = getMyVote(t);
                                  const annName = pg.annotators.find((a) => sameId(a.annotatorId, t.annotatorId?._id || t.annotatorId))?.annotatorName || '?';
                                  return (
                                    <tr key={t._id} className="border-t border-gray-700/50 hover:bg-gray-700/20 transition">
                                      <td className="px-4 py-3 text-gray-300">{annName}</td>
                                      <td className="px-4 py-3 text-gray-300">{t.dataItem?.originalName || t.dataItem?.filename || 'Task ' + t._id.slice(-4)}</td>
                                      <td className="px-4 py-3 text-gray-400">{t.submittedAt ? new Date(t.submittedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                                      <td className="px-4 py-3"><span className={'rounded border px-2 py-0.5 text-xs font-semibold ' + statusColor(t.status)}>{t.status}</span></td>
                                      <td className="px-4 py-3"><span className={'rounded px-2 py-0.5 text-xs font-semibold ' + (vote === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : vote === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-700 text-gray-400')}>{vote || 'pending'}</span></td>
                                      <td className="px-4 py-3 text-right">
                                        <button onClick={() => navigate('/reviewer/tasks/' + t._id + '?anns=' + sel.join(','))} className="rounded-lg border border-blue-500/50 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10 transition">Review</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
