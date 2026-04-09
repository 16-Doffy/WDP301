import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    <div className="flex min-h-screen bg-slate-900 text-gray-200">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="border-b border-gray-800 px-5 py-4">
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
        <nav className="flex-1 space-y-1 p-3">
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
        <div className="border-t border-gray-800 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 border border-gray-700">
              <span className="text-xs font-bold text-white">
                {user?.fullName?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-200">{user?.fullName || 'User'}</p>
              <p className="truncate text-xs text-gray-400">Annotator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-900">
        <Outlet />
      </main>
    </div>
  );
};

export default LayoutAnnotator;
