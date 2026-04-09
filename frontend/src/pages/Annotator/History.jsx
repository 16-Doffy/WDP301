import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');

const fmtDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_MAP = {
  approved: { label: 'Da duyet', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Bi tu choi', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  submitted: { label: 'Cho review', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  revised: { label: 'Da sua', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  in_progress: { label: 'Dang lam', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Hoan thanh', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
  assigned: { label: 'Da nhan', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
};

const AnnotatorHistory = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/tasks/my-tasks`, {
          headers: { Authorization: 'Bearer ' + getAuthToken() },
        });
        const allTasks = res.data || [];
        // Only show completed/rejected/revised/submitted tasks (not in-progress)
        const historyTasks = allTasks.filter(t =>
          ['approved', 'rejected', 'submitted', 'revised', 'completed'].includes(t.status)
        );
        setTasks(historyTasks);
      } catch (err) {
        setError(err.response?.data?.message || 'Loi tai du lieu');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const counts = {
    all: tasks.length,
    approved: tasks.filter(t => t.status === 'approved').length,
    rejected: tasks.filter(t => t.status === 'rejected').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-100">Lich su lam viec</h1>
          <p className="mt-1 text-sm text-gray-400">Xem lai cac bai da nop va trang thai review</p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: `Tat ca (${counts.all})` },
            { key: 'approved', label: `Da duyet (${counts.approved})` },
            { key: 'submitted', label: `Cho review (${counts.submitted})` },
            { key: 'rejected', label: `Bi tu choi (${counts.rejected})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                filter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-12 text-center">
            <p className="text-gray-500">Chua co lich su nao.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const st = STATUS_MAP[task.status] || STATUS_MAP.submitted;
              return (
                <div
                  key={task._id}
                  className="rounded-xl border border-gray-700 bg-gray-800 p-4 cursor-pointer hover:border-gray-600 transition-all"
                  onClick={() => task.status === 'revised' && navigate(`/annotator/workspace/${task.subtopicId?._id || task.subtopicId}`)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-200 truncate">
                        {task.dataItem?.filename || task.dataItem?.originalName || 'Unknown file'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {task.projectId?.name || 'Project'} &bull; {task.subtopicId?.name || 'Subtopic'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${st.color} ${st.bg}`}>
                        {st.label}
                      </span>
                      {task.submittedAt && (
                        <span className="text-xs text-gray-500">{fmtDate(task.submittedAt)}</span>
                      )}
                    </div>
                  </div>
                  {task.reviewComments && (
                    <div className="mt-2 rounded bg-rose-500/10 border border-rose-500/20 p-2">
                      <p className="text-xs text-rose-300">{task.reviewComments}</p>
                    </div>
                  )}
                  {task.status === 'revised' && (
                    <p className="mt-2 text-xs text-amber-400">Bam de tiep tuc sua bai</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnotatorHistory;
