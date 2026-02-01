import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import dashboardIcon from '../icons/dashboard.png';
import projectsIcon from '../icons/projects.png';
import datasetsIcon from '../icons/datasets.png';

const LayoutTailwind = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getMenuItems = () => {
    if (!user) return [];

    // For annotators we will directly show their task list; other roles keep generic Dashboard
    const baseItems = [];
    if (user.role !== 'annotator') {
      baseItems.push({
        text: 'Dashboard',
        icon: <img src={dashboardIcon} alt="Dashboard" className="w-5 h-5" />,
        path: '/dashboard',
      });
    }

    if (user.role === 'manager' || user.role === 'admin') {
      baseItems.push({
        text: 'Projects',
        icon: <img src={projectsIcon} alt="Projects" className="w-5 h-5" />,
        path: '/manager/projects',
      });
      baseItems.push({
        text: 'Datasets',
        icon: <img src={datasetsIcon} alt="Datasets" className="w-5 h-5" />,
        path: '/manager/datasets',
      });
      baseItems.push({
        text: 'Penalties & Scores',
        icon: '⚖️',
        path: '/manager/penalties',
      });
    }

    if (user.role === 'annotator') {
      baseItems.push({
        text: 'Dashboard',
        icon: <img src={dashboardIcon} alt="Dashboard" className="w-5 h-5" />,
        path: '/annotator',
      });
      baseItems.push({
        text: 'My Tasks',
        icon: '📝',
        path: '/annotator/tasks',
      });
    }

    if (user.role === 'reviewer' || user.role === 'admin') {
      baseItems.push({
        text: 'Reviews',
        icon: '🔍',
        path: '/reviewer/tasks',
      });
    }

    if (user.role === 'admin') {
      baseItems.push({
        text: 'Users',
        icon: '👤',
        path: '/admin/users',
      });
      baseItems.push({
        text: 'Activity Logs',
        icon: '📜',
        path: '/admin/activity-logs',
      });
      baseItems.push({
        text: 'Settings',
        icon: '⚙️',
        path: '/admin/settings',
      });
    }

    return baseItems;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleDisplay = () => {
    const roleMap = {
      manager: ' Manager',
      annotator: 'Annotator',
      reviewer: 'Reviewer',
      admin: 'Administrator',
    };
    return roleMap[user?.role] || 'User';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-gradient-to-b from-blue-600/60 to-white text-white flex flex-col">
        <div className="p-6 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">LabelFlow</h1>
              <p className="text-xs text-black uppercase font-bold">
                {user?.role === 'manager'
                  ? 'Manager'
                  : user?.role === 'annotator'
                    ? 'Annotator'
                    : user?.role === 'reviewer'
                      ? 'Reviewer'
                      : 'Admin'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 ">
          {getMenuItems().map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-white'
                    : 'text-black hover:bg-blue-800 hover:text-white text-lg'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.text}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">
                {user?.fullName
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 hover:bg-blue-900/10 ">
              <p className="text-xl text-black font-medium">{user?.fullName || 'User'}</p>
              <p className="text-lg text-sky-600 flex text-center  ">{getRoleDisplay()}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 px-4 py-2 text-sm text-black hover:text-black hover:bg-blue-900/50 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default LayoutTailwind;
