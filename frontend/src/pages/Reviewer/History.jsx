import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token');

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
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

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

  const filtered = reviewedTasks.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const approved = reviewedTasks.filter((t) => t.status === 'approved').length;
  const rejected = reviewedTasks.filter((t) => t.status === 'rejected').length;

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
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Lich Su Cham Bai</h1>
            <p className="mt-1 text-sm text-gray-400">Lich su cac task ban da cham (approved/rejected)</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center cursor-pointer hover:bg-gray-700/30 transition" onClick={() => setFilter('all')}>
            <p className="text-2xl font-bold text-gray-100">{reviewedTasks.length}</p>
            <p className="mt-1 text-xs text-gray-400">Tat Ca</p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
                    <th className="px-4 pb-3 text-left">Task</th>
                    <th className="px-4 pb-3 text-left">Project</th>
                    <th className="px-4 pb-3 text-left">Annotator</th>
                    <th className="px-4 pb-3 text-left">Trang Thai</th>
                    <th className="px-4 pb-3 text-left">Ngay Cham</th>
                    <th className="px-4 pb-3 text-left">Comment</th>
                    <th className="px-4 pb-3 text-right">Chi Tiet</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t._id} className="border-t border-gray-700/50 hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-100 text-sm">
                          {t.dataItem?.originalName || t.dataItem?.filename || 'Task'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {t.projectId?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {t.annotatorId?.fullName || t.annotatorId?.username || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={'rounded px-2 py-0.5 text-xs font-semibold ' + statusBadge(t.status)}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {fmtDate(t.submittedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {t.reviewComments || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { window.location.href = '/reviewer/tasks/' + t._id; }}
                          className="rounded-lg border border-blue-500/50 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10 transition"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewerHistory;
