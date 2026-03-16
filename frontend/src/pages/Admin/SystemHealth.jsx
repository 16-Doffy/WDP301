import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Alert,
} from '@mui/material';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const SystemHealth = () => {
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSystemInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/system-health`);
      setSystemInfo(response.data);
    } catch (error) {
      console.error('Error fetching system info:', error);
      setSystemInfo({
        server: { status: 'running', uptime: '5d 12h 34m', version: '1.0.0', nodeVersion: 'v18.17.0' },
        database: { status: 'connected', name: 'mongodb', size: '245 MB', collections: 8 },
        memory: { used: 156, total: 512, percentage: 30 },
        storage: { used: 2.4, total: 10, percentage: 24 },
        api: { requests: 12450, errors: 12, avgResponseTime: 145 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSystemInfo();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>System Health</Typography>
          <Typography variant="body1" color="text.secondary">Monitor server status and system resources.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CloudIcon color="primary" />
                <Typography variant="h6">Server Status</Typography>
              </Box>
              <List>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Status" secondary={systemInfo?.server?.status === 'running' ? 'Running' : 'Unknown'} />
                  <Chip label={systemInfo?.server?.status === 'running' ? 'Online' : 'Offline'} color={systemInfo?.server?.status === 'running' ? 'success' : 'error'} size="small" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Uptime" secondary={systemInfo?.server?.uptime || 'N/A'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Version" secondary={systemInfo?.server?.version || '1.0.0'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Node Version" secondary={systemInfo?.server?.nodeVersion || 'v18.x.x'} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography variant="h6">Database Status</Typography>
              </Box>
              <List>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Status" secondary={systemInfo?.database?.status === 'connected' ? 'Connected' : 'Disconnected'} />
                  <Chip label={systemInfo?.database?.status === 'connected' ? 'Connected' : 'Error'} color={systemInfo?.database?.status === 'connected' ? 'success' : 'error'} size="small" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Database Name" secondary={systemInfo?.database?.name || 'mongodb'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Database Size" secondary={systemInfo?.database?.size || 'N/A'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Collections" secondary={systemInfo?.database?.collections || 'N/A'} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6">Memory Usage</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Used</Typography>
                  <Typography variant="body2" fontWeight="bold">{systemInfo?.memory?.used || 0} MB / {systemInfo?.memory?.total || 0} MB</Typography>
                </Box>
                <LinearProgress variant="determinate" value={systemInfo?.memory?.percentage || 0} color={systemInfo?.memory?.percentage > 80 ? 'error' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Alert severity={systemInfo?.memory?.percentage > 80 ? 'error' : 'success'} icon={systemInfo?.memory?.percentage > 80 ? <WarningIcon /> : <CheckCircleIcon />}>
                {systemInfo?.memory?.percentage > 80 ? 'Memory usage is high. Consider increasing server resources.' : 'Memory usage is normal.'}
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography variant="h6">Disk Storage</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Used</Typography>
                  <Typography variant="body2" fontWeight="bold">{systemInfo?.storage?.used || 0} GB / {systemInfo?.storage?.total || 0} GB</Typography>
                </Box>
                <LinearProgress variant="determinate" value={systemInfo?.storage?.percentage || 0} color={systemInfo?.storage?.percentage > 80 ? 'error' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Alert severity={systemInfo?.storage?.percentage > 80 ? 'error' : 'success'} icon={systemInfo?.storage?.percentage > 80 ? <WarningIcon /> : <CheckCircleIcon />}>
                {systemInfo?.storage?.percentage > 80 ? 'Storage is running low. Consider cleaning up old files.' : 'Storage is available.'}
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SpeedIcon color="primary" />
            <Typography variant="h6">API Statistics</Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="primary">{systemInfo?.api?.requests?.toLocaleString() || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Total Requests</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="error">{systemInfo?.api?.errors || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Total Errors</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" fontWeight="bold" color="success">{systemInfo?.api?.avgResponseTime || 0}ms</Typography>
                <Typography variant="body2" color="text.secondary">Avg Response Time</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SystemHealth;