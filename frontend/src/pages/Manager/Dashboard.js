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
} from '@mui/material';
import { Folder as FolderIcon, Assignment as AssignmentIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      const projects = projectsRes.data;
      const tasks = tasksRes.data;

      setStats({
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        totalTasks: tasks.length,
        pendingTasks: tasks.filter(t => t.status === 'submitted').length,
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Manager Dashboard
      </Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Projects
              </Typography>
              <Typography variant="h4">{stats?.totalProjects || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Projects
              </Typography>
              <Typography variant="h4">{stats?.activeProjects || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Tasks
              </Typography>
              <Typography variant="h4">{stats?.totalTasks || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending Reviews
              </Typography>
              <Typography variant="h4">{stats?.pendingTasks || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<FolderIcon />}
          onClick={() => navigate('/manager/projects')}
        >
          Manage Projects
        </Button>
      </Box>
    </Box>
  );
};

export default ManagerDashboard;
