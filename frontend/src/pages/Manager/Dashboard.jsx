import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg transition hover:border-gray-600">
    <p className="text-sm text-gray-400">{label}</p>
    <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    {hint ? <p className="mt-2 text-xs text-gray-400">{hint}</p> : null}
  </div>
);

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          axios.get(`${API_URL}/api/projects`),
          axios.get(`${API_URL}/api/tasks/my-tasks`),
        ]);

        const projects = projectsRes.data || [];
        const tasks = tasksRes.data || [];

        const approvedTasks = tasks.filter((t) => t.status === 'approved').length;
        const rejectedTasks = tasks.filter((t) => t.status === 'rejected').length;
        const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
        const pendingTasks = tasks.filter((t) => t.status === 'submitted').length;

        const totalReviewed = approvedTasks + rejectedTasks;
        const approvalRate = totalReviewed > 0 ? Number(((approvedTasks / totalReviewed) * 100).toFixed(1)) : 0;

        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p) => p.status === 'active').length,
          totalTasks: tasks.length,
          pendingTasks,
          approvedTasks,
          rejectedTasks,
          approvalRate,
          inProgressTasks,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const safeStats = stats || {
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    pendingTasks: 0,
    approvedTasks: 0,
    rejectedTasks: 0,
    approvalRate: 0,
    inProgressTasks: 0,
  };

  const managerName = user?.fullName || user?.username || 'Manager';

  const statusRows = useMemo(
    () => [
      {
        label: 'In progress',
        value: safeStats.inProgressTasks,
        badgeClass: 'bg-blue-500/10 text-blue-400',
      },
      {
        label: 'Pending review',
        value: safeStats.pendingTasks,
        badgeClass: 'bg-amber-500/10 text-amber-400',
      },
      {
        label: 'Approved',
        value: safeStats.approvedTasks,
        badgeClass: 'bg-green-500/10 text-green-400',
      },
      {
        label: 'Rejected',
        value: safeStats.rejectedTasks,
        badgeClass: 'bg-rose-500/10 text-rose-400',
      },
    ],
    [safeStats]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Welcome back, {managerName}</h1>
              <p className="mt-1 text-sm text-gray-400">Manager overview with project health and review throughput.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/manager/projects')}
                className="rounded-lg bg-gray-700 px-4 py-2 text-gray-200 transition hover:bg-gray-600"
              >
                Projects
              </button>
              <button
                onClick={() => navigate('/manager/datasets')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                Datasets
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Projects Active" value={safeStats.activeProjects} hint="Projects currently running" />
          <StatCard label="Total Tasks" value={safeStats.totalTasks} hint="All tasks in your projects" />
          <StatCard label="Pending Review" value={safeStats.pendingTasks} hint="Waiting for reviewer action" />
          <StatCard label="Approval Rate" value={`${safeStats.approvalRate}%`} hint="Approved / reviewed tasks" />
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">Task Status Breakdown</h2>
            <span className="text-sm text-gray-400">Live distribution</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="border-b border-gray-700 text-gray-400">
                <tr>
                  <th className="py-3 text-left text-sm font-semibold">Status</th>
                  <th className="py-3 text-left text-sm font-semibold">Count</th>
                  <th className="py-3 text-left text-sm font-semibold">Indicator</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-800 transition hover:bg-gray-800/70">
                    <td className="py-3 text-gray-200">{row.label}</td>
                    <td className="py-3 text-gray-200">{row.value}</td>
                    <td className="py-3">
                      <span className={`rounded px-2 py-1 text-sm ${row.badgeClass}`}>{row.label.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
