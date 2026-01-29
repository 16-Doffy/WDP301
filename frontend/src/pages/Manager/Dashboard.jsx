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
  Stack,
} from '@mui/material';
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
      const approvalRate = totalReviewed > 0 ? Number(((approvedTasks / totalReviewed) * 100).toFixed(1)) : 0;

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

  const { activeProjects, totalTasks, pendingTasks, approvedTasks, rejectedTasks, approvalRate, inProgressTasks } = safeStats;

  const managerName = user?.fullName || user?.username || 'Manager';
  const totalReviewed = approvedTasks + rejectedTasks;

  return (
    <Box
      sx={{
        py: 4,
        px: { xs: 2, sm: 3, md: 4 },
        bgcolor: '#f5f7fb',
        minHeight: '100vh',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          mb: 4,
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
            Hello, {managerName}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Chào mừng trở lại với nền tảng quản lý nhân dữ liệu chuyên nghiệp.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/manager/projects')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.5,
              bgcolor: 'white',
              borderColor: '#e5e7eb',
              color: '#374151',
              '&:hover': {
                bgcolor: '#f9fafb',
                borderColor: '#d1d5db',
              },
            }}
          >
            QUẢN LÝ PROJECTS
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/manager/datasets')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.5,
              bgcolor: '#1e40af',
              '&:hover': {
                bgcolor: '#1e3a8a',
              },
            }}
          >
            QUẢN LÝ DATASETS
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                PROJECTS ACTIVE
              </Typography>
              <Typography variant="h3" fontWeight={700} sx={{ mt: 1 }}>
                {activeProjects}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                TASKS TOTAL
              </Typography>
              <Typography variant="h3" fontWeight={700} sx={{ mt: 1 }}>
                {totalTasks.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                APPROVAL RATE
              </Typography>
              <Typography variant="h3" fontWeight={700} sx={{ mt: 1 }}>
                {approvalRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                REVIEW PENDING
              </Typography>
              <Typography variant="h3" fontWeight={700} sx={{ mt: 1 }}>
                {pendingTasks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 18px 45px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                Task Distribution
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Phân bổ tasks theo trạng thái hiện tại
              </Typography>

              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="body2" color="text.secondary">
                    Đang thực hiện
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {inProgressTasks}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="body2" color="text.secondary">
                    Chờ review
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {pendingTasks}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="body2" color="text.secondary">
                    Đã approve
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {approvedTasks}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="body2" color="text.secondary">
                    Bị reject
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {rejectedTasks}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#0369A1' }}>
                Review Intelligence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Daily performance analysis summary.
              </Typography>

              <Typography variant="h3" fontWeight={700} sx={{ mt: 2, color: '#1F2937' }}>
                {totalReviewed}{' '}
                <Typography component="span" variant="h5" sx={{ fontWeight: 400, color: '#6B7280' }}>
                  Tasks Reviewed
                </Typography>
              </Typography>

              <Button
                variant="contained"
                fullWidth
                sx={{
                  mt: 3,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: 12,
                  py: 1.5,
                  bgcolor: '#DBEAFE',
                  color: '#0369A1',
                  '&:hover': {
                    bgcolor: '#BFDBFE',
                  },
                }}
                onClick={() => navigate('/manager/projects')}
              >
                VIEW FULL ANALYSIS
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ManagerDashboard;
