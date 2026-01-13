import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  RateReview as ReviewIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);

  const getMenuItems = () => {
    if (!user) return [];

    const baseItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ];

    if (user.role === 'manager' || user.role === 'admin') {
      baseItems.push({
        text: 'Projects',
        icon: <FolderIcon />,
        path: '/manager/projects',
      });
    }

    if (user.role === 'annotator') {
      baseItems.push({
        text: 'My Tasks',
        icon: <AssignmentIcon />,
        path: '/annotator/tasks',
      });
    }

    if (user.role === 'reviewer' || user.role === 'admin') {
      baseItems.push({
        text: 'Reviews',
        icon: <ReviewIcon />,
        path: '/reviewer/tasks',
      });
    }

    if (user.role === 'admin') {
      baseItems.push({
        text: 'Users',
        icon: <PeopleIcon />,
        path: '/admin/users',
      });
    }

    return baseItems;
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Data Labeling Support System
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">{user?.fullName}</Typography>
            <Avatar
              sx={{ cursor: 'pointer' }}
              onClick={handleMenuOpen}
            >
              {user?.fullName?.charAt(0).toUpperCase()}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {getMenuItems().map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
