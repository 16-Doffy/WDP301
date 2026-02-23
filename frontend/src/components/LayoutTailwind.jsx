import React from 'react';
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

    const baseItems = [
      {
        text: 'Dashboard',
        icon: (
          <img
            src={dashboardIcon}
            alt="Dashboard"
            className="w-5 h-5"
          />
        ),
        path: '/dashboard',
      },
    ];

    if (user.role === 'manager' || user.role === 'admin') {
      baseItems.push({
        text: 'Projects',
        icon: (
          <img
            src={projectsIcon}
            alt="Projects"
            className="w-5 h-5"
          />
        ),
        path: '/manager/projects',
      });
      baseItems.push({
        text: 'Datasets',
        icon: (
          <img
            src={datasetsIcon}
            alt="Datasets"
            className="w-5 h-5"
          />
        ),
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
        text: 'My Tasks',
        icon: '📝',
        path: '/annotator/tasks',
      });
      // baseItems.push({
      //   text: 'Reviews',
      //   icon: '✅',
      //   path: '/annotator/reviews',
      // });
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
    <div className="flex h-screen bg-[#2c3e50] text-slate-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-gradient-to-b from-[#1488CC] to-[#2B32B2] text-white flex flex-col shadow-xl border-r border-white/10">
        {/* Logo */}
        <div className="p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">LabelFlow</h1>
              <p className="text-[10px] text-blue-100 uppercase font-bold tracking-widest opacity-80">
                {user?.role === 'manager' ? 'Manager' : 
                 user?.role === 'annotator' ? 'Annotator' :
                 user?.role === 'reviewer' ? 'Reviewer' : 'Admin'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {getMenuItems().map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-white text-[#1488CC] shadow-lg shadow-black/10 font-semibold scale-[1.02]'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? '' : 'opacity-90'}`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.text}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10 bg-black/5">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30 shadow-sm">
              <span className="text-sm font-bold text-white">
                {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-semibold truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-blue-100/70 truncate uppercase tracking-tighter">{getRoleDisplay()}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-white/10 hover:bg-red-500/20 hover:text-red-100 rounded-lg border border-white/10 transition-all duration-200"
          >
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#2c3e50]">
        <Outlet />
      </div>
    </div>
  );
};

export default LayoutTailwind;
