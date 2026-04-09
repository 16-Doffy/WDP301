import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import {
  LayoutDashboard,
  ClipboardList,
  History,
  LogOut,
  BarChart3,
} from 'lucide-react';

const LayoutAnnotator = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [profileOpen, setProfileOpen] = useState(false);

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      path: '/annotator',
    },
    {
      text: 'My Tasks',
      icon: <ClipboardList size={18} />,
      path: '/annotator/tasks',
    },
    {
      text: 'History',
      icon: <History size={18} />,
      path: '/annotator/history',
    },
  ];

  const isActive = (path) => {
    if (path === '/annotator') return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Hide sidebar on workspace pages
  if (location.pathname.startsWith('/annotator/workspace')) {
    return (
      <div className="min-h-screen bg-slate-900 text-gray-200">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-gray-200">
      <aside className="fixed top-0 left-0 w-64 h-screen bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-50">
        {/* Header */}
        <div className="border-b border-gray-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
              <BarChart3 size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">LabelFlow</h1>
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">Annotator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full rounded-lg px-3 py-2.5 transition text-left flex items-center gap-3 ${
                isActive(item.path)
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
              <span className="text-sm font-medium">{item.text}</span>
            </button>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-800 p-3 shrink-0 sticky bottom-0 bg-gray-900 z-10">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full mb-3 flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-2 hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 border border-gray-700 shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.fullName?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'A'}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-gray-200">{user?.fullName || 'User'}</p>
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">Annotator</p>
            </div>
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-900 ml-64">
        <Outlet />
      </main>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
    </div>
  );
};

export default LayoutAnnotator;
