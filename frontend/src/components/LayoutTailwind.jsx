import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  FolderOpen,
  ClipboardList,
  History,
  Users,
  FileText,
  BarChart3,
  LogOut,
} from 'lucide-react';

const LayoutTailwind = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getMenuItems = () => {
    if (!user) return [];

    const baseItems = [
      {
        text: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        path: user.role === 'annotator'
          ? '/annotator'
          : user.role === 'reviewer'
            ? '/reviewer'
            : '/dashboard',
      },
    ];

    if (user.role === 'manager' || user.role === 'admin') {
      baseItems.push({
        text: 'Projects',
        icon: <FolderKanban size={18} />,
        path: '/manager/projects',
      });
      baseItems.push({
        text: 'Datasets',
        icon: <Database size={18} />,
        path: '/manager/datasets',
      });
      baseItems.push({
        text: 'Topics',
        icon: <FolderOpen size={18} />,
        path: '/manager/topics',
      });
    }

    if (user.role === 'annotator') {
      baseItems.push({ text: 'My Tasks', icon: <ClipboardList size={18} />, path: '/annotator/tasks' });
    }

    if (user.role === 'reviewer') {
      baseItems.push({ text: 'Review Tasks', icon: <ClipboardList size={18} />, path: '/reviewer/tasks' });
      baseItems.push({ text: 'History', icon: <History size={18} />, path: '/reviewer/history' });
    }

    if (user.role === 'admin') {
      baseItems.push({ text: 'Users', icon: <Users size={18} />, path: '/admin/users' });
      baseItems.push({ text: 'Activity Logs', icon: <FileText size={18} />, path: '/admin/activity-logs' });
      baseItems.push({ text: 'Datasets', icon: <Database size={18} />, path: '/admin/datasets' });
    }

    return baseItems;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  // Hide sidebar on workspace pages for more screen space
  const isAnnotatorWorkspace = location.pathname.startsWith('/annotator/workspace');
  const isReviewerWorkspace = location.pathname.startsWith('/reviewer/workspace');

  if (isAnnotatorWorkspace || isReviewerWorkspace) {
    return (
      <div className="min-h-screen bg-slate-900 text-gray-200">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-gray-200">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
              <BarChart3 size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">LabelFlow</h1>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                {getRoleDisplay()}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {getMenuItems().map((item) => {
            const isActive = item.path === '/dashboard' || item.path === '/annotator' || item.path === '/reviewer'
              ? location.pathname === item.path
              : (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full rounded-lg px-3 py-2.5 transition text-left flex items-center gap-3 ${
                  isActive
                    ? 'bg-gray-800 text-gray-100 border border-gray-700'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                <span className="text-sm font-medium">{item.text}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 border border-gray-700">
              <span className="text-xs font-bold text-gray-200">
                {user?.fullName?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-200">{user?.fullName || 'User'}</p>
              <p className="truncate text-xs text-gray-400">{getRoleDisplay()}</p>
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

export default LayoutTailwind;
