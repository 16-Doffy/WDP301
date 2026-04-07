import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');
const sameId = (a, b) => String(a || '') === String(b || '');

const statusColor = (s) => {
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'rejected') return 'bg-rose-500/10 text-rose-400';
  if (s === 'submitted') return 'bg-amber-500/10 text-amber-400';
  if (s === 'in_progress') return 'bg-blue-500/10 text-blue-400';
  return 'bg-gray-700/50 text-gray-400';
};

const statusLabel = (s) => {
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'submitted') return 'Pending';
  return s;
};

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
  const [searchParams] = useSearchParams();
  const [allTasks, setAllTasks] = useState({ pending: [], reviewed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSubtopics, setExpandedSubtopics] = useState({});
  const [selectedAnnotators, setSelectedAnnotators] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  const filterSubtopicId = searchParams.get('subtopicId');

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
          subtopics: {},
          tasks: [],
        };
      }
      projMap[pid].tasks.push(t);

      const sid = t.subtopicId?._id || t.subtopicId || 'unknown';
      const sname = t.subtopicId?.name || 'Subtopic';
      const sguideline = t.subtopicId?.guideline || '';
      if (!projMap[pid].subtopics[sid]) {
        projMap[pid].subtopics[sid] = { id: sid, name: sname, guideline: sguideline, tasks: [] };
      }
      projMap[pid].subtopics[sid].tasks.push(t);
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
      const overdue = pg.deadline && new Date(pg.deadline) < new Date();

      const subtopicList = Object.values(pg.subtopics).map((st) => ({
        ...st,
        submitted: st.tasks.filter((t) => t.status === 'submitted').length,
        approved: st.tasks.filter((t) => t.status === 'approved').length,
        rejected: st.tasks.filter((t) => t.status === 'rejected').length,
      }));

      return { ...pg, subtopicList, annotators, submitted, approved, rejected, overdue };
    });
  }, [allTasks]);

  const toggleProject = (pid) => setExpandedProjects((p) => ({ ...p, [pid]: !p[pid] }));

  const toggleSubtopic = (pid, sid) => {
    setExpandedSubtopics((prev) => {
      const cur = prev[pid] ? new Set(prev[pid]) : new Set();
      if (cur.has(sid)) cur.delete(sid); else cur.add(sid);
      return { ...prev, [pid]: cur };
    });
  };

  const toggleAnnotator = (pid, aid) => {
    setSelectedAnnotators((p) => {
      const cur = new Set(p[pid] || []);
      if (cur.has(aid)) cur.delete(aid); else cur.add(aid);
      return { ...p, [pid]: Array.from(cur) };
    });
  };

  const openSubtopicReview = (pg, subtopic, sel) => {
    if (sel.length === 0) { alert('Chon it nhat 1 annotator'); return; }
    const anns = sel.join(',');
    const eligible = subtopic.tasks
      .filter((t) => {
        const aid = String(t.annotatorId?._id || t.annotatorId || '');
        if (!sel.includes(aid)) return false;
        return t.status === 'submitted' && (!getMyVote(t) || getMyVote(t) === 'pending');
      })
      .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    if (eligible.length === 0) { alert('Khong co task nao de review'); return; }
    navigate('/reviewer/tasks/' + eligible[0]._id + '?anns=' + anns + '&subtopicId=' + subtopic.id);
  };

  const openProjectReview = (pg) => {
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
    const first = eligible[0];
    const sid = first.subtopicId?._id || first.subtopicId || '';
    navigate('/reviewer/tasks/' + first._id + '?anns=' + anns + (sid ? '&subtopicId=' + sid : ''));
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Review Dashboard</h1>
            <p className="mt-1 text-sm text-gray-400">
              {filterSubtopicId
                ? 'Dang xem chi tiet subtopic'
                : 'Tong hop project va task cho reviewer'}
            </p>
          </div>
          {filterSubtopicId && (
            <button onClick={() => navigate('/reviewer')} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700">
              Tat ca Project
            </button>
          )}
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
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center">
            <p className="text-xl font-bold text-gray-100">{projectGroups.reduce((s, p) => s + p.subtopicList.length, 0)}</p>
            <p className="text-xs text-gray-400">Subtopic</p>
          </div>
        </div>

        {projectGroups.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center text-gray-400">Chua co project nao</div>
        ) : projectGroups.map((pg) => {
          const expanded = expandedProjects[pg.projectId];
          const sel = selectedAnnotators[pg.projectId] || [];
          const visibleSubtopics = filterSubtopicId
            ? pg.subtopicList.filter((st) => sameId(st.id, filterSubtopicId))
            : pg.subtopicList;
          const autoExpandedSubs = filterSubtopicId
            ? new Set([filterSubtopicId])
            : (expandedSubtopics[pg.projectId] || new Set());

          return (
            <div key={pg.projectId} className="mb-4 rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/30"
                onClick={() => !filterSubtopicId && toggleProject(pg.projectId)}
              >
                <div className="flex items-center gap-3">
                  {!filterSubtopicId && <div className="text-2xl">{expanded ? '▼' : '▶'}</div>}
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
                    <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs font-semibold text-gray-400">
                      {pg.subtopicList.length} subtopics
                    </span>
                    {pg.submitted > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">{pg.submitted} pending</span>
                    )}
                    {pg.approved > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">{pg.approved} approved</span>
                    )}
                    {pg.rejected > 0 && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">{pg.rejected} rejected</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{pg.annotators.length} annotator{pg.annotators.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {(expanded || filterSubtopicId) && (
                <div className="border-t border-gray-700">
                  <div className="p-4 border-b border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-300">Chon Annotator de Review:</h4>
                      <div className="flex gap-2">
                        {sel.length > 0 && (
                          <button onClick={() => openProjectReview(pg)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
                            Review Full ({pg.subtopicList.length} subtopics)
                          </button>
                        )}
                        <button onClick={() => setSelectedAnnotators((p) => ({ ...p, [pg.projectId]: pg.annotators.map((a) => a.annotatorId) }))}
                          className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500">All</button>
                        <button onClick={() => setSelectedAnnotators((p) => ({ ...p, [pg.projectId]: [] }))}
                          className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white">Clear</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pg.annotators.map((a) => {
                        const isSel = sel.includes(a.annotatorId);
                        const submitted = a.tasks.filter((t) => t.status === 'submitted').length;
                        const total = a.tasks.length;
                        return (
                          <button key={a.annotatorId}
                            onClick={() => toggleAnnotator(pg.projectId, a.annotatorId)}
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

                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">
                      {filterSubtopicId ? 'Subtopic hien tai' : 'Chi tiet theo Subtopic:'}
                    </h4>
                    <div className="space-y-2">
                      {visibleSubtopics.map((st) => {
                        const isSubExpanded = autoExpandedSubs.has(st.id);
                        const subSelTasks = sel.length > 0
                          ? st.tasks.filter((t) => {
                              const aid = String(t.annotatorId?._id || t.annotatorId || '');
                              if (!sel.includes(aid)) return false;
                              return t.status === 'submitted' && (!getMyVote(t) || getMyVote(t) === 'pending');
                            }).length
                          : 0;

                        return (
                          <div key={st.id} className="rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/50 transition"
                              onClick={() => toggleSubtopic(pg.projectId, st.id)}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-lg shrink-0">{isSubExpanded ? '▼' : '▶'}</div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-100 truncate">{st.name}</p>
                                  {st.guideline && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{st.guideline}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs text-gray-400">{st.tasks.length} task</span>
                                {st.submitted > 0 && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">{st.submitted} pending</span>
                                )}
                                {st.approved > 0 && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">{st.approved}</span>
                                )}
                                {st.rejected > 0 && (
                                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">{st.rejected}</span>
                                )}
                                {sel.length > 0 && subSelTasks > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openSubtopicReview(pg, st, sel); }}
                                    className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
                                  >
                                    Review ({subSelTasks})
                                  </button>
                                )}
                              </div>
                            </div>

                            {isSubExpanded && (
                              <div className="border-t border-gray-700/50 max-h-80 overflow-y-auto">
                                {st.tasks.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-gray-500">Khong co task</div>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-900 text-gray-400 sticky top-0">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Task</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Annotator</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Submitted</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Status</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Your Vote</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {st.tasks
                                        .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
                                        .map((t) => {
                                          const vote = getMyVote(t);
                                          const annName = pg.annotators.find((a) => sameId(a.annotatorId, t.annotatorId?._id || t.annotatorId))?.annotatorName || '?';
                                          const isEligible = sel.includes(String(t.annotatorId?._id || t.annotatorId || '')) &&
                                            t.status === 'submitted' && (!vote || vote === 'pending');

                                          return (
                                            <tr key={t._id} className="border-t border-gray-700/30 hover:bg-gray-800/20 transition">
                                              <td className="px-4 py-2.5 text-gray-200 text-sm max-w-[200px] truncate">
                                                {t.dataItem?.originalName || t.dataItem?.filename || 'Task ' + t._id.slice(-4)}
                                              </td>
                                              <td className="px-4 py-2.5 text-gray-300 text-sm">{annName}</td>
                                              <td className="px-4 py-2.5 text-gray-400 text-xs">{fmtDateTime(t.submittedAt)}</td>
                                              <td className="px-4 py-2.5">
                                                <span className={'rounded px-2 py-0.5 text-xs font-semibold ' + statusColor(t.status)}>
                                                  {statusLabel(t.status)}
                                                </span>
                                              </td>
                                              <td className="px-4 py-2.5">
                                                <span className={'rounded px-2 py-0.5 text-xs font-semibold ' +
                                                  (vote === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                                   vote === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                                                   'bg-gray-700 text-gray-400')}>
                                                  {vote || 'pending'}
                                                </span>
                                              </td>
                                              <td className="px-4 py-2.5 text-right">
                                                <button
                                                  onClick={() => navigate('/reviewer/tasks/' + t._id + '?anns=' + sel.join(',') + '&subtopicId=' + st.id)}
                                                  className={'rounded-lg border px-3 py-1 text-xs transition ' +
                                                    (isEligible ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10' : 'border-gray-600 text-gray-400 hover:bg-gray-700')}
                                                >
                                                  {isEligible ? 'Review' : 'Xem'}
                                                </button>
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
                        );
                      })}
                    </div>
                  </div>
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