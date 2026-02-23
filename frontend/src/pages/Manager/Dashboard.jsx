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

const glassCardSx = {
  borderRadius: 3,
  boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(10px)',
  color: 'rgba(255,255,255,0.92)',
};

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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh' }}>
      {/* Mantle panel */}
      <Box
        sx={{
          borderRadius: 5,
          p: { xs: 2, sm: 3, md: 4 },
          background: 'linear-gradient(135deg, #24C6DC 0%, #514A9D 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.18)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* subtle glow */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(900px circle at 20% 10%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(700px circle at 85% 30%, rgba(255,255,255,0.18), transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top header */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            mb: 3,
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ mb: 0.5, color: 'rgba(255,255,255,0.96)', letterSpacing: -0.5 }}
            >
              Hello, {managerName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)' }}>
              Chào mừng trở lại với nền tảng quản lý nhân dữ liệu chuyên nghiệp.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/manager/projects')}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
                py: 1.2,
                borderColor: 'rgba(255,255,255,0.65)',
                color: 'rgba(255,255,255,0.92)',
                bgcolor: 'rgba(255,255,255,0.08)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.16)',
                  borderColor: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              QUẢN LÝ PROJECTS
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/manager/datasets')}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 800,
                px: 3,
                py: 1.2,
                bgcolor: 'rgba(15,23,42,0.22)',
                color: 'rgba(255,255,255,0.95)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                '&:hover': {
                  bgcolor: 'rgba(15,23,42,0.30)',
                },
              }}
            >
              QUẢN LÝ DATASETS
            </Button>
          </Stack>
        </Box>

        {/* Stats row */}
        <Grid container spacing={2.5} sx={{ position: 'relative' }}>
          {[
            {
              label: 'PROJECTS ACTIVE',
              value: activeProjects,
              accent: '#A78BFA',
              spark: '0,30 10,25 20,28 30,22 40,20 50,18 60,15',
            },
            {
              label: 'TASKS TOTAL',
              value: totalTasks.toLocaleString(),
              accent: '#38BDF8',
              spark: '0,28 10,24 20,26 30,20 40,18 50,16 60,12',
            },
            {
              label: 'APPROVAL RATE',
              value: `${approvalRate}%`,
              accent: '#34D399',
              gauge: true,
            },
            {
              label: 'REVIEW PENDING',
              value: pendingTasks,
              accent: '#F59E0B',
              bars: true,
            },
          ].map((it) => (
            <Grid key={it.label} item xs={12} sm={6} md={3}>
              <Card sx={glassCardSx}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography
                      variant="overline"
                      sx={{ fontWeight: 800, letterSpacing: 1.2, color: 'rgba(255,255,255,0.80)' }}
                    >
                      {it.label}
                    </Typography>
                    <Box sx={{ fontSize: 18, opacity: 0.5 }}>⋯</Box>
                  </Box>
                  <Typography variant="h3" fontWeight={800} sx={{ mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                    {it.value}
                  </Typography>

                  {it.gauge ? (
                    <Box sx={{ height: 40, position: 'relative', mt: 2 }}>
                      <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0 }}>
                        <path d="M 0 20 Q 30 0, 60 20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                        <path
                          d={`M 0 20 Q 30 ${20 - (Number(approvalRate) / 100) * 20}, 60 20`}
                          fill="none"
                          stroke={it.accent}
                          strokeWidth="3"
                        />
                      </svg>
                    </Box>
                  ) : it.bars ? (
                    <Box sx={{ height: 40, mt: 2, display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                      {[10, 14, 12, 16, 11, 15, 10].map((h, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            flex: 1,
                            height: `${h}px`,
                            bgcolor: it.accent,
                            borderRadius: '3px 3px 0 0',
                            opacity: 0.9,
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Box sx={{ height: 40, position: 'relative', mt: 2 }}>
                      <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0 }}>
                        <polyline points={it.spark} fill="none" stroke={it.accent} strokeWidth="2" />
                      </svg>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Distribution + Intelligence */}
        <Grid container spacing={2.5} sx={{ mt: 3, position: 'relative' }}>
          <Grid item xs={12} md={8}>
            <Card sx={{ ...glassCardSx, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, color: 'rgba(255,255,255,0.95)' }}>
                  Task Distribution
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  Phân bổ tasks theo trạng thái hiện tại
                </Typography>

                {totalActionTasks === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
                    Chưa có dữ liệu task để hiển thị biểu đồ.
                  </Box>
                ) : (
                  <Box sx={{ mt: 3, position: 'relative', height: 280 }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 40,
                        width: 30,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        pr: 1,
                        opacity: 0.85,
                      }}
                    >
                      {[250, 200, 150, 100, 50, 0].map((val) => (
                        <Typography key={val} variant="caption" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                          {val}
                        </Typography>
                      ))}
                    </Box>

                    <Box
                      sx={{
                        ml: 4,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        height: 240,
                      }}
                    >
                      {[
                        { label: 'Đang thực hiện', value: inProgressTasks, color: '#38BDF8' },
                        { label: 'Chờ review', value: pendingTasks, color: 'rgba(255,255,255,0.35)' },
                        { label: 'Đã approve', value: approvedTasks, color: '#34D399' },
                        { label: 'Bị reject', value: rejectedTasks, color: '#FB7185' },
                      ].map((item) => {
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
                            <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                              {item.value}
                            </Typography>
                            <Box
                              sx={{
                                width: '70%',
                                minWidth: 32,
                                height: `${height}px`,
                                bgcolor: item.color,
                                borderRadius: '6px 6px 0 0',
                                boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                                transition: 'height 0.3s ease-out',
                              }}
                            />
                            <Typography variant="caption" sx={{ mt: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
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
            <Card sx={{ ...glassCardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.20)',
                    }}
                  >
                    <Box sx={{ fontSize: 18, color: 'rgba(255,255,255,0.92)' }}>⚙️</Box>
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={900} sx={{ color: 'rgba(255,255,255,0.95)', mb: 0 }}>
                      Review Intelligence
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                      Daily performance analysis summary.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="h3" fontWeight={900} sx={{ mt: 1, color: 'rgba(255,255,255,0.96)' }}>
                    {totalReviewed}{' '}
                    <Typography component="span" variant="h6" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.72)' }}>
                      Tasks Reviewed
                    </Typography>
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, mb: 2, mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#34D399' }} />
                      <Typography variant="body2" sx={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>
                        Đã review
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight={800} sx={{ color: 'rgba(255,255,255,0.95)' }}>
                      {totalReviewed}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FB7185' }} />
                      <Typography variant="body2" sx={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>
                        Bị reject
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight={800} sx={{ color: 'rgba(255,255,255,0.95)' }}>
                      {rejectedTasks}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ width: '100%', height: 1, bgcolor: 'rgba(255,255,255,0.18)', my: 2 }} />

                <Box sx={{ mb: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ fontSize: 14, color: 'rgba(255,255,255,0.72)' }}>
                      Approval Rate
                    </Typography>
                    <Typography variant="h5" fontWeight={900} sx={{ color: 'rgba(255,255,255,0.96)' }}>
                      {approvalRate}%
                    </Typography>
                  </Stack>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: 'auto',
                    borderRadius: 3,
                    textTransform: 'none',
                    fontWeight: 900,
                    fontSize: 12,
                    py: 1.4,
                    bgcolor: 'rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.92)',
                    border: '1px solid rgba(255,255,255,0.20)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.22)',
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
    </Box>
  );
};

export default ManagerDashboard;
