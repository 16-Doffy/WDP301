import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AnnotatorOverview = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/tasks/my-tasks`);
        const tasks = res.data || [];
        const now = new Date();
        let total = tasks.length;
        let completed = tasks.filter((t) => t.status === 'approved').length;
        let inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'submitted' || t.status === 'rejected').length;
        let overdue = tasks.filter((t) => t.projectId?.deadline && new Date(t.projectId.deadline) < now && t.status !== 'approved').length;
        setStats({ total, completed, inProgress, overdue });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Tasks',
      value: stats.total,
      hint: 'All assigned tasks',
      chip: 'All',
      border: 'border-blue-500',
      chipBg: 'bg-blue-50 text-blue-700',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      hint: 'Working / needs revision',
      chip: 'Active',
      border: 'border-amber-500',
      chipBg: 'bg-amber-50 text-amber-700',
    },
    {
      title: 'Completed',
      value: stats.completed,
      hint: 'Approved tasks',
      chip: 'Done',
      border: 'border-emerald-500',
      chipBg: 'bg-emerald-50 text-emerald-700',
    },
    {
      title: 'Overdue',
      value: stats.overdue,
      hint: 'Past project deadline',
      chip: 'Urgent',
      border: 'border-rose-500',
      chipBg: 'bg-rose-50 text-rose-700',
    },
  ];

  const StatCard = ({ title, value, hint, chip, border, chipBg }) => (
    <button
      type="button"
      onClick={() => navigate('/annotator/tasks')}
      className={`group text-left bg-white border ${border} rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">{value}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${chipBg}`}>{chip}</span>
      </div>
      <p className="mt-3 text-xs text-gray-500">{hint}</p>
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="p-6">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Annotator Dashboard</h1>
              <p className="mt-1 text-white/80">Overview of your tasks and progress</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors font-semibold"
            >
              Open My Tasks
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <StatCard key={c.title} {...c} />
          ))}
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Next step</h2>
              <p className="mt-1 text-sm text-gray-600">Continue labeling the most relevant task in your queue.</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold"
            >
              Go to My Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorOverview;
