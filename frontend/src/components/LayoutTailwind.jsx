import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Dashboard as DashboardIcon,
  Assignment as ProjectIcon,
  Storage as DatasetIcon,
  ListAlt as TaskIcon,
  RateReview as ReviewIcon,
  People as UsersIcon,
  History as LogIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { IconButton, Avatar, Tooltip } from '@mui/material';

const LayoutTailwind = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getMenuItems = () => {
    if (!user) return [];

    const baseItems = [
      {
        text: 'Dashboard',
        icon: <DashboardIcon fontSize="small" />,
        path: '/dashboard',
      },
    ];

    if (user.role === 'manager' || user.role === 'admin') {
      baseItems.push({
        text: 'Projects',
        icon: <ProjectIcon fontSize="small" />,
        path: '/manager/projects',
      });
      baseItems.push({
        text: 'Datasets',
        icon: <DatasetIcon fontSize="small" />,
        path: '/manager/datasets',
      });
    }

    if (user.role === 'annotator') {
      baseItems.push({
        text: 'My Tasks',
        icon: <TaskIcon fontSize="small" />,
        path: '/annotator/tasks',
      });
    }

    if (user.role === 'reviewer' || user.role === 'admin') {
      baseItems.push({
        text: 'Reviews',
        icon: <ReviewIcon fontSize="small" />,
        path: '/reviewer/tasks',
      });
    }

    if (user.role === 'admin') {
      baseItems.push({
        text: 'Users',
        icon: <UsersIcon fontSize="small" />,
        path: '/admin/users',
      });
      baseItems.push({
        text: 'Activity Logs',
        icon: <LogIcon fontSize="small" />,
        path: '/admin/activity-logs',
      });
      baseItems.push({
        text: 'Settings',
        icon: <SettingsIcon fontSize="small" />,
        path: '/admin/settings',
      });
    }

    return baseItems;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.fullName) return 'U';
    return user.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleDisplay = () => {
    const roleMap = {
      manager: 'Manager',
      annotator: 'Annotator',
      reviewer: 'Reviewer',
      admin: 'Administrator',
    };
    return roleMap[user?.role] || 'User';
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl z-20 transition-all duration-300">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white text-xl font-bold">L</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">LabelFlow</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {getRoleDisplay()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 space-y-8">
          <div>
            <p className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
              Main Menu
            </p>
            <nav className="space-y-1.5">
              {getMenuItems().map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'hover:bg-slate-800/50 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                        {item.icon}
                      </span>
                      <span className="text-[14px] font-semibold tracking-wide">
                        {item.text}
                      </span>
                    </div>
                    {isActive && <ChevronRightIcon sx={{ fontSize: 16, opacity: 0.7 }} />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Footer Account */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center gap-3 p-2 rounded-2xl">
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'indigo-600',
                fontSize: '0.875rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
              }}
            >
              {getUserInitials()}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate font-medium">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200"
          >
            <LogoutIcon sx={{ fontSize: 16 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#f8fafc]">
        {/* Subtle top shadow transition */}
        <div className="absolute top-0 left-0 right-0 h-px bg-slate-200 z-10"></div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default LayoutTailwind;
