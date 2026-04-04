import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const StatCard = ({ title, value, hint }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg transition hover:border-gray-600">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    <p className="mt-2 text-xs text-gray-400">{hint}</p>
  </div>
);

const AnnotatorOverview = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/tasks/my-tasks`);
        const tasks = res.data || [];
        const now = new Date();
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'approved').length;
        const inProgress = tasks.filter(t =>
          ['in_progress', 'completed', 'assigned', 'revised'].includes(t.status)
        ).length;
        const submitted = tasks.filter(t => t.status === 'submitted').length;
        const overdue = tasks.filter(t =>
          t.projectId?.deadline &&
          new Date(t.projectId.deadline) < now &&
          !['approved'].includes(t.status)
        ).length;
        setStats({ total, completed, inProgress, overdue, submitted });
      } catch (err) {
        setError(err.response?.data?.message || 'Loi tai du lieu');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Hello, Annotator</h1>
              <p className="mt-1 text-sm text-gray-400">Tong quan khoi luong cong viec.</p>
            </div>
            <button onClick={() => navigate('/annotator/tasks')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700">
              Mo My Tasks
            </button>
          </div>
        </div>
        {error && <div className="rounded-xl border border-rose-700/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Tong task" value={stats.total} hint="Tat ca task" />
          <StatCard title="Dang lam" value={stats.inProgress} hint="Task chua nop" />
          <StatCard title="Cho review" value={stats.submitted || 0} hint="Da nop, cho reviewer" />
          <StatCard title="Da duyet" value={stats.completed} hint="Task da duyet" />
          <StatCard title="Qua han" value={stats.overdue} hint="Project qua han" />
        </div>
      </div>
    </div>
  );
};

export default AnnotatorOverview;