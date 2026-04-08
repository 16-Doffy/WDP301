
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

// Format date: 07/04/2026 14:30
const fmtShortDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

// Get file type label
const getFileType = (filename) => {
  if (!filename) return '';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', webp: 'image', svg: 'image',
    mp3: 'audio', wav: 'audio', ogg: 'audio',
    mp4: 'video', mov: 'video', avi: 'video',
    txt: 'text', csv: 'text', json: 'text'
  };
  return map[ext] || 'file';
};

// Get avatar color from name
const stringToColor = (str) => {
  if (!str) return '#6b7280';
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Get annotator initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const ReviewerHistory = () => {
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(API_URL + '/api/reviews/reviewed', {
          headers: { Authorization: 'Bearer ' + getAuthToken() }
        });
        setReviewedTasks(res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Khong tai duoc du lieu');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build unique project list
  const projects = useMemo(() => {
    const map = {};
    reviewedTasks.forEach(t => {
      const pid = t.projectId?._id || t.projectId;
      if (pid) map[pid] = t.projectId?.name || 'Unknown';
    });
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reviewedTasks]);

  // Stats
  const total = reviewedTasks.length;
  const approvedCount = reviewedTasks.filter(t => t.status === 'approved').length;
  const rejectedCount = reviewedTasks.filter(t => t.status === 'rejected').length;

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...reviewedTasks];

    // Search: item name, annotator name, project name
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => {
        const itemName = (t.dataItem?.filename || t.dataItem?.originalName || '').toLowerCase();
        const annotName = (t.annotatorId?.fullName || t.annotatorId?.username || '').toLowerCase();
        const projName = (t.projectId?.name || '').toLowerCase();
        return itemName.includes(q) || annotName.includes(q) || projName.includes(q);
      });
    }

    // Decision filter
    if (decisionFilter !== 'all') {
      result = result.filter(t => t.status === decisionFilter);
    }

    // Project filter
    if (projectFilter !== 'all') {
      result = result.filter(t => {
        const pid = t.projectId?._id || t.projectId;
        return pid === projectFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.reviewedAt || a.submittedAt || 0);
      const dateB = new Date(b.reviewedAt || b.submittedAt || 0);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [reviewedTasks, search, decisionFilter, projectFilter, sortOrder]);

  const handleViewDetail = (task) => {
    window.location.href = '/reviewer/workspace/' + (task.projectId?._id || task.projectId) + '?taskId=' + task._id;
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

        {/* Header */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h1 className="text-xl font-bold text-gray-100">Lịch Sử Chấm Bài</h1>
          <p className="mt-1 text-sm text-gray-400">Xem lại các quyết định đã chấm</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => { setDecisionFilter('all'); setProjectFilter('all'); }}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${
              decisionFilter === 'all' && projectFilter === 'all'
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-gray-700 bg-gray-800 hover:bg-gray-700/30'
            }`}
          >
            <p className="text-2xl font-bold text-gray-100">{total}</p>
            <p className="mt-1 text-xs text-gray-400">Tất cả</p>
          </button>
          <button
            onClick={() => { setDecisionFilter('approved'); setProjectFilter('all'); }}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${
              decisionFilter === 'approved'
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-emerald-700/30 bg-emerald-500/5 hover:bg-emerald-500/10'
            }`}
          >
            <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
            <p className="mt-1 text-xs text-gray-400">Approved</p>
          </button>
          <button
            onClick={() => { setDecisionFilter('rejected'); setProjectFilter('all'); }}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${
              decisionFilter === 'rejected'
                ? 'border-rose-500/50 bg-rose-500/10'
                : 'border-rose-700/30 bg-rose-500/5 hover:bg-rose-500/10'
            }`}
          >
            <p className="text-2xl font-bold text-rose-400">{rejectedCount}</p>
            <p className="mt-1 text-xs text-gray-400">Rejected</p>
          </button>
        </div>

        {/* Filter Row */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tim item, annotator, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            {/* Decision Filter */}
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">Tat ca trang thai</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">Tat ca project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-500/50"
            >
              <option value="newest">Moi nhat</option>
              <option value="oldest">Cu nhat</option>
            </select>

            {/* Clear filters */}
            {(search || decisionFilter !== 'all' || projectFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setDecisionFilter('all'); setProjectFilter('all'); }}
                className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-all"
              >
                Xoa loc
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mb-3 text-4xl opacity-20">
                <svg className="w-12 h-12 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Khong co lich su cham bai</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-left">Subtopic</th>
                    <th className="px-4 py-3 text-left">Annotator</th>
                    <th className="px-4 py-3 text-left">Quyet dinh</th>
                    <th className="px-4 py-3 text-left">Feedback</th>
                    <th className="px-4 py-3 text-left">Thoi gian</th>
                    <th className="px-4 py-3 text-right">Han dong</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, idx) => {
                    const itemName = t.dataItem?.filename || t.dataItem?.originalName || 'Unknown';
                    const itemType = getFileType(itemName);
                    const annotName = t.annotatorId?.fullName || t.annotatorId?.username || 'Unknown';
                    const projName = t.projectId?.name || '-';
                    const subName = t.subtopicId?.name || '-';
                    const isApproved = t.status === 'approved';
                    const feedback = t.reviewComments;
                    const reviewTime = t.reviewedAt || t.submittedAt;

                    return (
                      <tr
                        key={t._id}
                        className={`border-t border-gray-700/50 transition-colors hover:bg-gray-800/40 ${
                          idx % 2 === 0 ? 'bg-gray-800/20' : ''
                        }`}
                      >
                        {/* Item */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-200 text-sm max-w-[180px] truncate" title={itemName}>
                            {itemName}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{itemType}</p>
                        </td>

                        {/* Project */}
                        <td className="px-4 py-3">
                          <span className="text-gray-300 text-sm">{projName}</span>
                        </td>

                        {/* Subtopic */}
                        <td className="px-4 py-3">
                          <span className="text-gray-400 text-sm">{subName}</span>
                        </td>

                        {/* Annotator */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: stringToColor(annotName) }}
                              title={annotName}
                            >
                              {getInitials(annotName)}
                            </div>
                            <span className="text-gray-300 text-sm truncate max-w-[120px]" title={annotName}>
                              {annotName}
                            </span>
                          </div>
                        </td>

                        {/* Decision */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isApproved ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            {isApproved ? 'Approved' : 'Rejected'}
                          </span>
                        </td>

                        {/* Feedback */}
                        <td className="px-4 py-3 max-w-[180px]">
                          {feedback ? (
                            <span className="text-gray-400 text-xs line-clamp-1" title={feedback}>
                              {feedback.length > 40 ? feedback.slice(0, 40) + '...' : feedback}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>

                        {/* Reviewed At */}
                        <td className="px-4 py-3">
                          <span className="text-gray-400 text-xs">{fmtShortDate(reviewTime)}</span>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleViewDetail(t)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/60 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Xem lai
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary footer */}
        {filtered.length > 0 && (
          <div className="text-center text-xs text-gray-500">
            Hien thi {filtered.length} / {total} ban ghi
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerHistory;