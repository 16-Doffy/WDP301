import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ title, value, hint }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg transition hover:border-gray-600">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    <p className="mt-2 text-xs text-gray-400">{hint}</p>
  </div>
);

const ReviewerOverview = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.fullName || user?.username || 'Reviewer';

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/reviews/overview`);
        setTasks(res.data?.tasks || []);
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Bạn không có quyền truy cập dữ liệu Reviewer.');
        } else {
          setError(err.response?.data?.message || 'Không tải được dữ liệu overview. Vui lòng thử lại.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  const stats = useMemo(() => {
    const submitted = tasks.filter((t) => t.status === 'submitted').length;
    const reviewed = tasks.filter((t) => t.status === 'approved' || t.status === 'rejected').length;
    const pending = tasks.filter((t) => ['assigned', 'in_progress', 'completed', 'revised'].includes(t.status)).length;

    return {
      total: tasks.length,
      submitted,
      reviewed,
      pending,
    };
  }, [tasks]);

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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Hello, {userName}</h1>
              <p className="mt-1 text-sm text-gray-400">Overview of your review workload and progress.</p>
            </div>
            <button
              onClick={() => navigate('/reviewer/tasks')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              Open Review Tasks
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Assigned" value={stats.total} hint="All tasks in reviewer scope" />
          <StatCard title="Waiting Review" value={stats.submitted} hint="Submitted by annotators" />
          <StatCard title="Reviewed" value={stats.reviewed} hint="Approved or rejected" />
          <StatCard title="Not Submitted" value={stats.pending} hint="Still pending from annotators" />
        </div>
      </div>
    </div>
  );
};

export default ReviewerOverview;
