import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');
const sameId = (a, b) => String(a || '') === String(b || '');

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusBadge = (s) => {
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
  if (s === 'rejected') return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
  return 'bg-gray-700/50 text-gray-300 border border-gray-600/30';
};

const ReviewerHistory = () => {
  const { user } = useAuth();
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(API_URL + '/api/reviews/reviewed', { headers: { Authorization: 'Bearer ' + getAuthToken() } });
        setReviewedTasks(res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groupedByProject = reviewedTasks.reduce((acc, t) => {
    const pid = t.projectId?._id || t.projectId || 'unknown';
    if (!acc[pid]) {
      acc[pid] = { projectId: pid, name: t.projectId?.name || 'Unknown Project', tasks: [] };
    }
    acc[pid].tasks.push(t);
    return acc;
  }, {});

  const filtered = reviewedTasks.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const approved = reviewedTasks.filter((t) => t.status === 'approved').length;
  const rejected = reviewedTasks.filter((t) => t.status === 'rejected').length;
  const pending = reviewedTasks.filter((t) => t.status === 'submitted').length;

  const getMyVote = (task) => {
    if (!user || !task) return null;
    const r = task.reviewers?.find((rev) => sameId(rev.reviewerId?._id || rev.reviewerId, user?._id || user?.id));
    return r?.status || null;
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-100">Lich Su Cham Bai</h1>
          <p className="mt-1 text-sm text-gray-400">Lich su cac task ban da cham (approved/rejected)</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center cursor-pointer hover:bg-gray-700/30 transition" onClick={() => setFilter('all')}>
            <p className="text-2xl font-bold text-gray-100">{reviewedTasks.length}</p>
            <p className="mt-1 text-xs text-gray-400">Tat Ca</p>
          </div>
          <div className="rounded-xl border border-amber-700/30 bg-amber-500/5 p-4 text-center cursor-pointer hover:bg-amber-500/10 transition" onClick={() => setFilter('submitted')}>
            <p className="text-2xl font-bold text-amber-400">{pending}</p>
            <p className="mt-1 text-xs text-gray-400">Cho Xac Nhan</p>
          </div>
          <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-4 text-center cursor-pointer hover:bg-emerald-500/10 transition" onClick={() => setFilter('approved')}>
            <p className="text-2xl font-bold text-emerald-400">{approved}</p>
            <p className="mt-1 text-xs text-gray-400">Approved</p>
          </div>
          <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-4 text-center cursor-pointer hover:bg-rose-500/10 transition" onClick={() => setFilter('rejected')}>
            <p className="text-2xl font-bold text-rose-400">{rejected}</p>
            <p className="mt-1 text-xs text-gray-400">Rejected</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Chua co lich su cham bai</div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {Object.values(groupedByProject).map((pg) => {
                const pgFiltered = pg.tasks.filter((t) => filter === 'all' || t.status === filter);
                if (pgFiltered.length === 0) return null;

                return (
                  <div key={pg.projectId}>
                    <div className="px-6 py-4 bg-gray-900/50 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-100">{pg.name}</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{pgFiltered.length} task</span>
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">{pgFiltered.filter((t) => t.status === 'approved').length} approved</span>
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400">{pgFiltered.filter((t) => t.status === 'rejected').length} rejected</span>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-700/30">
                      {pgFiltered.map((t) => {
                        const isExpanded = expandedTask === t._id;
                        const vote = getMyVote(t);
                        return (
                          <div key={t._id} className="hover:bg-gray-800/30 transition">
                            <div className="flex items-center justify-between px-6 py-3 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : t._id)}>
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="text-gray-500">{isExpanded ? String.fromCharCode(9660) : String.fromCharCode(9654)}</div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-100 truncate">{t.dataItem?.originalName || t.dataItem?.filename || 'Task'}</p>
                                  <p className="text-xs text-gray-500">Subtopic: {t.subtopicId?.name || 'N/A'} | Annotator: {t.annotatorId?.fullName || t.annotatorId?.username || 'N/A'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className={'rounded px-2 py-0.5 text-xs font-semibold ' + statusBadge(t.status)}>{t.status}</span>
                                <span className="text-xs text-gray-500">{fmtDate(t.reviewedAt || t.submittedAt)}</span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-6 pb-4 bg-gray-900/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Thong Tin Task</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-gray-400">Task ID</span><span className="text-gray-200 font-mono text-xs">{t._id}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Dataset</span><span className="text-gray-200">{t.datasetId?.name || '-'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Subtopic</span><span className="text-gray-200">{t.subtopicId?.name || '-'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Annotator</span><span className="text-gray-200">{t.annotatorId?.fullName || t.annotatorId?.username || '-'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">File</span><span className="text-gray-200 text-xs truncate max-w-[200px]">{t.dataItem?.originalName || t.dataItem?.filename || '-'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Labels</span><span className="text-gray-200">{(t.labels?.objects?.length || 0)} objects</span></div>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Review Chi Tiet</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-gray-400">Your Vote</span><span className={'font-semibold ' + (vote === 'approved' ? 'text-emerald-400' : vote === 'rejected' ? 'text-rose-400' : 'text-gray-400')}>{vote || 'pending'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Final Status</span><span className={'font-semibold ' + (t.status === 'approved' ? 'text-emerald-400' : t.status === 'rejected' ? 'text-rose-400' : 'text-amber-400')}>{t.status}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Reviewed At</span><span className="text-gray-200">{fmtDate(t.reviewedAt)}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Submitted At</span><span className="text-gray-200">{fmtDate(t.submittedAt)}</span></div>
                                      {t.reviewComments && (
                                        <div className="pt-2 border-t border-gray-700">
                                          <p className="text-xs text-gray-400 mb-1">Feedback</p>
                                          <p className="text-gray-200 text-sm">{t.reviewComments}</p>
                                        </div>
                                      )}
                                      {t.errorCategory && (
                                        <div className="flex justify-between"><span className="text-gray-400">Error Category</span><span className="text-rose-400 text-xs">{t.errorCategory}</span></div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {t.reviewNotes && t.reviewNotes.length > 0 && (
                                  <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Review Notes</h4>
                                    <div className="space-y-2">
                                      {t.reviewNotes.map((note, idx) => (
                                        <div key={idx} className="rounded border border-gray-700 bg-gray-800 px-3 py-2">
                                          <p className="text-sm text-gray-200">{note.note || note.comment || JSON.stringify(note)}</p>
                                          <p className="mt-1 text-xs text-gray-500">{note.createdBy?.fullName || note.createdBy?.username || 'Reviewer'} - {fmtDate(note.createdAt)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {t.reviewers && t.reviewers.length > 0 && (
                                  <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">All Reviewer Votes</h4>
                                    <div className="space-y-2">
                                      {t.reviewers.map((r, idx) => (
                                        <div key={idx} className="flex items-center justify-between rounded bg-gray-800 px-3 py-2">
                                          <span className="text-sm text-gray-200">{r.reviewerId?.fullName || r.reviewerId?.username || 'Reviewer'}</span>
                                          <span className={'rounded px-2 py-0.5 text-xs font-semibold ' + (r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-700 text-gray-400')}>{r.status || 'pending'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="mt-4 flex justify-end">
                                  <button onClick={() => { window.location.href = '/reviewer/tasks/' + t._id; }}
                                    className="rounded-lg border border-blue-500/50 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition font-medium">
                                    Xem Chi Tiet Day Du
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewerHistory;