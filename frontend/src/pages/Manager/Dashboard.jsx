import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Folder,
  ClipboardList,
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Loader2,
  Users,
  Database
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      const projects = projectsRes.data;
      const tasks = tasksRes.data;

      const approvedTasks = tasks.filter(t => t.status === 'approved').length;
      const rejectedTasks = tasks.filter(t => t.status === 'rejected').length;
      const totalReviewed = approvedTasks + rejectedTasks;
      const approvalRate = totalReviewed > 0
        ? ((approvedTasks / totalReviewed) * 100).toFixed(1)
        : 0;

      setStats({
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        totalTasks: tasks.length,
        pendingTasks: tasks.filter(t => t.status === 'submitted').length,
        approvedTasks,
        rejectedTasks,
        approvalRate,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030014]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Projects',
      value: stats?.totalProjects || 0,
      subValue: `${stats?.activeProjects || 0} active`,
      icon: Folder,
      color: 'blue',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconColor: 'text-blue-400'
    },
    {
      title: 'Total Tasks',
      value: stats?.totalTasks || 0,
      subValue: `${stats?.inProgressTasks || 0} in progress`,
      icon: ClipboardList,
      color: 'purple',
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400'
    },
    {
      title: 'Pending Reviews',
      value: stats?.pendingTasks || 0,
      subValue: 'Requires attention',
      icon: Clock,
      color: 'amber',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400'
    },
    {
      title: 'Approval Rate',
      value: `${stats?.approvalRate || 0}%`,
      subValue: `${stats?.approvedTasks || 0} approved`,
      icon: CheckCircle2,
      color: 'emerald',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400'
    }
  ];

  const quickActions = [
    { name: 'New Project', icon: Plus, path: '/manager/projects/create', bg: 'bg-indigo-600 hover:bg-indigo-500' },
    { name: 'Manage Team', icon: Users, path: '/manager/team', bg: 'bg-violet-600 ' },
    { name: 'Datasets', icon: Database, path: '/manager/datasets', bg: 'bg-violet-600' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 overflow-y-auto font-sans">
      {/* Decorative Blur Elements - Lighter */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-7xl mx-auto"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-slate-900">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{user?.fullName?.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-500 font-medium">Here's what's happening with your projects today.</p>
          </div>
          <div className="flex items-center gap-3">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.path)}
                className={`${action.bg} flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95 text-white`}
              >
                <action.icon size={18} />
                {action.name}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative group overflow-hidden bg-white/70 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-6 hover:border-indigo-300 transition-all hover:shadow-xl hover:shadow-indigo-500/5`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

              <div className="relative flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-slate-50 border border-slate-100 ${card.iconColor}`}>
                  <card.icon size={24} />
                </div>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowUpRight size={20} />
                </button>
              </div>

              <div className="relative">
                <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-3xl font-black text-slate-900 mb-1">{card.value}</h3>
                <p className="text-xs font-semibold text-slate-400">{card.subValue}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ManagerDashboard;

