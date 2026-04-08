import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const stringToColor = (str) => {
  if (!str) return '#6b7280';
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const ReviewerOverview = () => {
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pendingRes, reviewedRes] = await Promise.all([
          axios.get(API_URL + '/api/reviews/pending', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
          axios.get(API_URL + '/api/reviews/reviewed', { headers: { Authorization: 'Bearer ' + getAuthToken() } }),
        ]);
        setPendingTasks(pendingRes.data || []);
        setReviewedTasks(reviewedRes.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Khong tai duoc du lieu');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const pending = pendingTasks.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reviewedToday = reviewedTasks.filter(t => {
      const d = new Date(t.reviewedAt || t.submittedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    const approved = reviewedTasks.filter(t => t.status === 'approved').length;
    const rejected = reviewedTasks.filter(t => t.status === 'rejected').length;
    return { pending, reviewedToday, approved, rejected };
  }, [pendingTasks, reviewedTasks]);

  const queueItems = useMemo(() => {
    const itemMap = {};
    pendingTasks.forEach(task => {
      const key = task.dataItem?.filename || task.dataItem?.originalName || task._id;
      if (!itemMap[key]) {
        itemMap[key] = {
          itemId: key,
          itemName: task.dataItem?.originalName || task.dataItem?.filename || key,
          projectName: task.projectId?.name || '-',
          subtopicName: task.subtopicId?.name || '-',
          annotators: [],
          taskId: task._id,
          projectId: task.projectId?._id || task.projectId,
        };
      }
      const annotName = task.annotatorId?.fullName || task.annotatorId?.username || '?';
      const annotId = task.annotatorId?._id || task.annotatorId;
      if (!itemMap[key].annotators.find(a => a.id === annotId)) {
        itemMap[key].annotators.push({ id: annotId, name: annotName });
      }
    });
    return Object.values(itemMap);
  }, [pendingTasks]);

  const filteredQueue = useMemo(() => {
    let result = [...queueItems];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.itemName.toLowerCase().includes(q) ||
        item.projectName.toLowerCase().includes(q) ||
        item.subtopicName.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'newest') return b.itemId.localeCompare(a.itemId);
      if (sortBy === 'oldest') return a.itemId.localeCompare(b.itemId);
      return b.annotators.length - a.annotators.length;
    });
    return result;
  }, [queueItems, search, sortBy]);

  const handleReview = (item) => {
    navigate('/reviewer/workspace/' + item.projectId + '?taskId=' + item.taskId);
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
      <div className="mx-auto w-full max-w-7xl space-y-5">

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">Ban co {stats.pending} item can review</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
            <p className="mt-1 text-xs text-gray-400">Pending</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">{stats.reviewedToday}</p>
            <p className="mt-1 text-xs text-gray-400">Reviewed Today</p>
          </div>
          <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.approved}</p>
            <p className="mt-1 text-xs text-gray-400">Approved</p>
          </div>
          <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-rose-400">{stats.rejected}</p>
            <p className="mt-1 text-xs text-gray-400">Rejected</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
            <h2 className="text-sm font-bold text-gray-200">Review Queue</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Tim kiem..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-900 pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/50 w-44"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 focus:outline-none"
              >
                <option value="newest">Moi nhat</option>
                <option value="oldest">Cu nhat</option>
                <option value="annotators">Nhieu annotator nhat</option>
              </select>
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm">Khong co item can review</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-left">Subtopic</th>
                    <th className="px-4 py-3 text-left">Annotators</th>
                    <th className="px-4 py-3 text-right">Han dong</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.map((item, idx) => (
                    <tr
                      key={item.itemId}
                      className={'border-t border-gray-700/50 transition-colors hover:bg-gray-800/40' + (idx % 2 === 0 ? ' bg-gray-800/20' : '')}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-200 text-sm max-w-[160px] truncate">{item.itemName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300 text-sm">{item.projectName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 text-sm">{item.subtopicName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="flex -space-x-1.5">
                            {item.annotators.slice(0, 4).map(a => (
                              <div
                                key={a.id}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-gray-800"
                                style={{ backgroundColor: stringToColor(a.name) }}
                                title={a.name}
                              >
                                {getInitials(a.name)}
                              </div>
                            ))}
                            {item.annotators.length > 4 && (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-600 text-gray-300 border-2 border-gray-800">
                                +{item.annotators.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 ml-2">{item.annotators.length}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReview(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-all"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredQueue.length > 0 && (
          <div className="text-center text-xs text-gray-500">
            Hien thi {filteredQueue.length} / {queueItems.length} item
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerOverview;
