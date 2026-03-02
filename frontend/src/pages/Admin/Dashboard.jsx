import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const StatCard = ({ title, value }) => (
  <div className="rounded-ui border border-border bg-card p-6 shadow-lg transition hover:border-gray-600">
    <p className="text-sm text-text-sub">{title}</p>
    <p className="mt-2 text-3xl font-bold text-text-main">{value}</p>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, projectsRes, tasksRes] = await Promise.all([
          axios.get(`${API_URL}/api/users`),
          axios.get(`${API_URL}/api/projects`),
          axios.get(`${API_URL}/api/tasks/my-tasks`),
        ]);

        const users = usersRes.data || [];
        const projects = projectsRes.data || [];
        const tasks = tasksRes.data || [];

        setStats({
          totalUsers: users.length,
          totalProjects: projects.length,
          totalTasks: tasks.length,
          activeUsers: users.filter((u) => u.isActive).length,
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-content-x py-content-y text-text-main">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-ui border border-border bg-surface p-6 shadow-lg lg:p-7">
          <h1 className="text-title-md font-bold text-text-main lg:text-title-lg">Admin Dashboard</h1>
          <p className="mt-1 text-sm leading-6 text-text-sub">System health overview and global activity metrics.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Users" value={stats?.totalUsers || 0} />
          <StatCard title="Active Users" value={stats?.activeUsers || 0} />
          <StatCard title="Total Projects" value={stats?.totalProjects || 0} />
          <StatCard title="Total Tasks" value={stats?.totalTasks || 0} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
