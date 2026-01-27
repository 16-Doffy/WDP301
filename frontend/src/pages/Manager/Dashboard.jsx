import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Avatar,
  Chip,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  PendingActions as PendingActionsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

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
      const approvalRate =
        totalReviewed > 0 ? Number(((approvedTasks / totalReviewed) * 100).toFixed(1)) : 0;

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

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

  const {
    totalProjects,
    activeProjects,
    totalTasks,
    pendingTasks,
    approvedTasks,
    rejectedTasks,
    approvalRate,
    inProgressTasks,
  } = safeStats;

  const managerName = user?.fullName || user?.username || 'Manager';

  const totalActionTasks = inProgressTasks + pendingTasks + approvedTasks + rejectedTasks;

  return (
    <Box
      sx={{
        py: 3,
        px: { xs: 1, sm: 2, md: 3 },
        bgcolor: '#f5f7fb',
        minHeight: '100%',
      }}
    >
      {/* Top greeting + quick actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: '#1976d2' }}>
              {managerName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Hello, {managerName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hãy cùng theo dõi tiến độ dự án và chất lượng gán nhãn hôm nay 👀
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<FolderIcon />}
            onClick={() => navigate('/manager/projects')}
          >
            Quản lý Projects
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AssignmentIcon />}
            onClick={() => navigate('/manager/datasets')}
          >
            Quản lý Datasets
          </Button>
        </Stack>
      </Box>

      {/* Summary stat cards */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: '#fff',
              boxShadow: '0 18px 45px rgba(79,70,229,0.25)',
            }}
          >
            <CardContent>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                Projects
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {totalProjects}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {activeProjects} đang active
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.22)',
                    width: 44,
                    height: 44,
                  }}
                >
                  <FolderIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: '#ffffff',
              boxShadow: '0 18px 45px rgba(15,23,42,0.06)',
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Tổng Tasks
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {totalTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {inProgressTasks} đang thực hiện
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#e0f2fe', color: '#0369a1', width: 44, height: 44 }}>
                  <AssignmentIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: '#fff7ed',
              boxShadow: '0 18px 45px rgba(248,250,252,0.9)',
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Pending Reviews
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {pendingTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Chờ reviewer kiểm tra
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#fed7aa', color: '#c2410c', width: 44, height: 44 }}>
                  <PendingActionsIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: '#ecfdf3',
              boxShadow: '0 18px 45px rgba(22,163,74,0.15)',
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Approval rate
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                    {approvalRate}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#22c55e', color: '#ecfdf3', width: 44, height: 44 }}>
                  <PlaylistAddCheckIcon />
                </Avatar>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {approvedTasks} approved / {rejectedTasks} rejected
              </Typography>
              <LinearProgress
                variant="determinate"
                value={approvalRate}
                sx={{
                  mt: 1.5,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: '#bbf7d0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    bgcolor: '#16a34a',
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Task analysis strip */}
      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid item xs={12} md={7}>
          <Card
            sx={{
              borderRadius: 3,
              height: '100%',
              boxShadow: '0 18px 45px rgba(15,23,42,0.04)',
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  Tổng quan Tasks
                </Typography>
                <Chip
                  size="small"
                  label={`${totalActionTasks} tasks`}
                  color="primary"
                  variant="outlined"
                />
              </Stack>

              <Stack spacing={1.8}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Đang thực hiện
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {inProgressTasks}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={
                      totalActionTasks > 0 ? (inProgressTasks / totalActionTasks) * 100 : 0
                    }
                    sx={{ mt: 0.5, height: 6, borderRadius: 999 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Chờ review
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {pendingTasks}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    color="warning"
                    variant="determinate"
                    value={
                      totalActionTasks > 0 ? (pendingTasks / totalActionTasks) * 100 : 0
                    }
                    sx={{ mt: 0.5, height: 6, borderRadius: 999 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Đã approve
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {approvedTasks}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    color="success"
                    variant="determinate"
                    value={
                      totalActionTasks > 0 ? (approvedTasks / totalActionTasks) * 100 : 0
                    }
                    sx={{ mt: 0.5, height: 6, borderRadius: 999 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Bị reject
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {rejectedTasks}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    color="error"
                    variant="determinate"
                    value={
                      totalActionTasks > 0 ? (rejectedTasks / totalActionTasks) * 100 : 0
                    }
                    sx={{ mt: 0.5, height: 6, borderRadius: 999 }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card
            sx={{
              borderRadius: 3,
              height: '100%',
              background: 'linear-gradient(135deg, #0f172a, #111827)',
              color: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 20px 45px rgba(15,23,42,0.65)',
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600}>
                Trạng thái review hôm nay
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: 'rgba(249,250,251,0.7)', maxWidth: 320 }}
              >
                Theo dõi quickly các tasks đang chờ review để đảm bảo tiến độ dự án và chất lượng
                dữ liệu.
              </Typography>

              <Box
                sx={{
                  mt: 3,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(248,250,252,0.06)',
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Chờ review
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {pendingTasks}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(248,250,252,0.06)',
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Đã review
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {approvedTasks + rejectedTasks}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(34,197,94,0.08)',
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Tỉ lệ approve
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {approvalRate}%
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(248,113,113,0.16)',
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Bị reject
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {rejectedTasks}
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="contained"
                fullWidth
                sx={{
                  mt: 3,
                  borderRadius: 999,
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: '#facc15',
                  color: '#0f172a',
                  '&:hover': {
                    bgcolor: '#eab308',
                  },
                }}
                onClick={() => navigate('/manager/projects')}
              >
                Xem chi tiết dự án & tasks
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ManagerDashboard;
