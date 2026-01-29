
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
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  PendingActions as PendingActionsIcon,
  Search as SearchIcon,
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
      {/* Top header: greeting + action buttons */}
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

      {/* Top stats row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)', position: 'relative', overflow: 'hidden' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                  PROJECTS ACTIVE
                </Typography>
                <Box sx={{ fontSize: 20, opacity: 0.3 }}>⋯</Box>
              </Box>
              <Typography variant="h3" fontWeight={700} sx={{ mb: 2 }}>
                {activeProjects}
              </Typography>
              {/* Mini line graph */}
              <Box sx={{ height: 40, position: 'relative', mt: 2 }}>
                <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0 }}>
                  <polyline
                    points="0,30 8,25 16,28 24,22 32,20 40,18 48,15"
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth="2"
                  />
                </svg>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)', position: 'relative', overflow: 'hidden' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                  TASKS TOTAL
                </Typography>
                <Box sx={{ fontSize: 20, opacity: 0.3 }}>⋯</Box>
              </Box>
              <Typography variant="h3" fontWeight={700} sx={{ mb: 2 }}>
                {totalTasks.toLocaleString()}
              </Typography>
              {/* Mini line graph */}
              <Box sx={{ height: 40, position: 'relative', mt: 2 }}>
                <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0 }}>
                  <polyline
                    points="0,28 8,24 16,26 24,20 32,18 40,16 48,12"
                    fill="none"
                    stroke="#0369A1"
                    strokeWidth="2"
                  />
                </svg>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)', position: 'relative', overflow: 'hidden' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                  APPROVAL RATE
                </Typography>
                <Box sx={{ fontSize: 20, opacity: 0.3 }}>⋯</Box>
              </Box>
              <Typography variant="h3" fontWeight={700} sx={{ mb: 2 }}>
                {approvalRate}%
              </Typography>
              {/* Semi-circular gauge chart */}
              <Box sx={{ height: 40, position: 'relative', mt: 2 }}>
                <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0 }}>
                  <path
                    d="M 0 20 Q 24 0, 48 20"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d={`M 0 20 Q 24 ${20 - (approvalRate / 100) * 20}, 48 20`}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="3"
                  />
                </svg>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.04)', position: 'relative', overflow: 'hidden' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                  REVIEW PENDING
                </Typography>
                <Box sx={{ fontSize: 20, opacity: 0.3 }}>⋯</Box>
              </Box>
              <Typography variant="h3" fontWeight={700} sx={{ mb: 2 }}>
                {pendingTasks}
              </Typography>
              {/* Mini bar chart */}
              <Box sx={{ height: 40, position: 'relative', mt: 2, display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                {[12, 18, 15, 22, 16, 20, 14].map((height, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flex: 1,
                      height: `${height}px`,
                      bgcolor: '#F59E0B',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Task distribution + review intelligence */}
      <Grid container spacing={2.5} sx={{ mt: 3 }}>
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 18px 45px rgba(15,23,42,0.04)',
              bgcolor: 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                Task Distribution
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Phân bổ tasks theo trạng thái hiện tại
              </Typography>

              {/* Bar chart with Y-axis */}
              {totalActionTasks === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  Chưa có dữ liệu task để hiển thị biểu đồ.
                </Box>
              ) : (
                <Box sx={{ mt: 3, position: 'relative', height: 280 }}>
                  {/* Y-axis labels */}
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 40, width: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', pr: 1 }}>
                    {[250, 200, 150, 100, 50, 0].map((val) => (
                      <Typography key={val} variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {val}
                      </Typography>
                    ))}
                  </Box>
                  
                  {/* Chart area */}
                  <Box
                    sx={{
                      ml: 4,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-around',
                      height: 240,
                      position: 'relative',
                    }}
                  >
                    {[
                      { label: 'Đang thực hiện', value: inProgressTasks, color: '#3B82F6' },
                      { label: 'Chờ review', value: pendingTasks, color: '#9CA3AF' },
                      { label: 'Đã approve', value: approvedTasks, color: '#22C55E' },
                      { label: 'Bị reject', value: rejectedTasks, color: '#DC2626' },
                    ].map((item) => {
                      const maxValue = Math.max(inProgressTasks, pendingTasks, approvedTasks, rejectedTasks, 1);
                      const normalizedValue = Math.min(item.value, 250);
                      const height = (normalizedValue / 250) * 200;
                      return (
                        <Box
                          key={item.label}
                          sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            mx: 0.5,
                            height: '100%',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, fontSize: 12 }}>
                            {item.value}
                          </Typography>
                          <Box
                            sx={{
                              width: '70%',
                              minWidth: 32,
                              height: `${height}px`,
                              bgcolor: item.color,
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease-out',
                            }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1, textAlign: 'center', fontSize: 11 }}
                          >
                            {item.label}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderRadius: 3,
              height: '100%',
              bgcolor: 'white',
              boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
              {/* Header with icon */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: '#E0F2FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      width: '120%',
                      height: '120%',
                      borderRadius: '50%',
                      border: '2px solid #BFDBFE',
                      opacity: 0.3,
                    },
                  }}
                >
                  <Box
                    sx={{
                      fontSize: 20,
                      color: '#0369A1',
                    }}
                  >
                    ⚙️
                  </Box>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#0369A1', mb: 0 }}>
                    Review Intelligence
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    Daily performance analysis summary.
                  </Typography>
                </Box>
              </Box>

              {/* INSIGHTS THIS MONTH section */}
              <Box sx={{ mt: 1, mb: 1 }}>
             
                <Typography variant="h3" fontWeight={700} sx={{ mt: 1, color: '#1F2937' }}>
                  {totalReviewed} <Typography component="span" variant="h5" sx={{ fontWeight: 400, color: '#6B7280' }}>Tasks Reviewed</Typography>
                </Typography>
              </Box>

              {/* Breakdown metrics */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#22C55E',
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#374151', fontSize: 14 }}>
                      Đã review
                    </Typography>
                  </Box>
                  <Typography variant="body1" fontWeight={600} sx={{ color: '#1F2937' }}>
                    {totalReviewed}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#EF4444',
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#374151', fontSize: 14 }}>
                      Bị reject
                    </Typography>
                  </Box>
                  <Typography variant="body1" fontWeight={600} sx={{ color: '#1F2937' }}>
                    {rejectedTasks}
                  </Typography>
                </Stack>
              </Box>

              {/* Divider */}
              <Box sx={{ width: '100%', height: 1, bgcolor: '#E5E7EB', my: 2 }} />

              {/* Approval Rate */}
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: '#6B7280', fontSize: 14 }}>
                    Approval Rate
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#0369A1' }}>
                    {approvalRate}%
                  </Typography>
                </Stack>
              </Box>

              {/* Button */}
              <Button
                variant="contained"
                fullWidth
                sx={{
                  mt: 'auto',
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

