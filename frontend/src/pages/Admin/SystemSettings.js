import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  CircularProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon, Settings as SettingsIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const SystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    email: {
      enabled: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      fromEmail: '',
      fromName: 'Data Labeling System'
    },
    storage: {
      maxFileSize: 10485760,
      maxFilesPerDataset: 100,
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'],
      storageLimitPerProject: 1073741824
    },
    tasks: {
      maxTasksPerAnnotator: 100,
      autoAssignEnabled: false,
      defaultTaskStatus: 'assigned'
    },
    review: {
      requireReviewComments: true,
      autoApproveAfterDays: 0,
      maxRejectionsBeforeEscalation: 3
    },
    general: {
      siteName: 'Team8-WDP',
      maintenanceMode: false,
      maintenanceMessage: 'System is under maintenance. Please check back later.',
      allowRegistration: true,
      defaultUserRole: 'annotator'
    },
    notifications: {
      emailOnTaskAssigned: false,
      emailOnTaskSubmitted: false,
      emailOnTaskReviewed: false,
      emailOnTaskRejected: true
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage('Lỗi khi tải cấu hình: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await axios.put(`${API_URL}/api/settings`, settings);
      setMessage('Đã lưu cấu hình thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Lỗi khi lưu cấu hình: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Bạn có chắc muốn reset tất cả cấu hình về mặc định?')) {
      try {
        await axios.post(`${API_URL}/api/settings/reset`);
        await fetchSettings();
        setMessage('Đã reset cấu hình về mặc định!');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        setMessage('Lỗi khi reset: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon />
          <Typography variant="h4">System Settings</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            Reset về mặc định
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Lưu cấu hình
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.includes('Lỗi') ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="Cấu hình chung" />
        <Tab label="Email" />
        <Tab label="Storage & Files" />
        <Tab label="Tasks" />
        <Tab label="Review" />
        <Tab label="Notifications" />
      </Tabs>

      {/* General Settings */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình chung hệ thống
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tên hệ thống"
                value={settings.general?.siteName || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, siteName: e.target.value }
                })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Role mặc định cho user mới</InputLabel>
                <Select
                  value={settings.general?.defaultUserRole || 'annotator'}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, defaultUserRole: e.target.value }
                  })}
                  label="Role mặc định cho user mới"
                >
                  <MenuItem value="annotator">Annotator</MenuItem>
                  <MenuItem value="reviewer">Reviewer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.general?.allowRegistration || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, allowRegistration: e.target.checked }
                    })}
                  />
                }
                label="Cho phép đăng ký tài khoản mới"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.general?.maintenanceMode || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, maintenanceMode: e.target.checked }
                    })}
                  />
                }
                label="Chế độ bảo trì (Maintenance Mode)"
              />
            </Grid>
            {settings.general?.maintenanceMode && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Thông báo bảo trì"
                  value={settings.general?.maintenanceMessage || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, maintenanceMessage: e.target.value }
                  })}
                  margin="normal"
                />
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Email Settings */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình Email (SMTP)
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.email?.enabled || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, enabled: e.target.checked }
                    })}
                  />
                }
                label="Bật gửi email"
              />
            </Grid>
            {settings.email?.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Host"
                    value={settings.email?.smtpHost || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpHost: e.target.value }
                    })}
                    margin="normal"
                    placeholder="smtp.gmail.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="SMTP Port"
                    value={settings.email?.smtpPort || 587}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpPort: parseInt(e.target.value) }
                    })}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Username"
                    value={settings.email?.smtpUser || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpUser: e.target.value }
                    })}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="password"
                    label="SMTP Password"
                    value={settings.email?.smtpPassword || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, smtpPassword: e.target.value }
                    })}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="email"
                    label="From Email"
                    value={settings.email?.fromEmail || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, fromEmail: e.target.value }
                    })}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Name"
                    value={settings.email?.fromName || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, fromName: e.target.value }
                    })}
                    margin="normal"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      )}

      {/* Storage Settings */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình Storage & Files
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max File Size (bytes)"
                value={settings.storage?.maxFileSize || 10485760}
                onChange={(e) => setSettings({
                  ...settings,
                  storage: { ...settings.storage, maxFileSize: parseInt(e.target.value) }
                })}
                margin="normal"
                helperText={`Hiện tại: ${formatBytes(settings.storage?.maxFileSize || 0)}`}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Files Per Dataset"
                value={settings.storage?.maxFilesPerDataset || 100}
                onChange={(e) => setSettings({
                  ...settings,
                  storage: { ...settings.storage, maxFilesPerDataset: parseInt(e.target.value) }
                })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Storage Limit Per Project (bytes)"
                value={settings.storage?.storageLimitPerProject || 1073741824}
                onChange={(e) => setSettings({
                  ...settings,
                  storage: { ...settings.storage, storageLimitPerProject: parseInt(e.target.value) }
                })}
                margin="normal"
                helperText={`Hiện tại: ${formatBytes(settings.storage?.storageLimitPerProject || 0)}`}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Allowed File Types:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {(settings.storage?.allowedFileTypes || []).map((type, idx) => (
                  <Chip key={idx} label={type} />
                ))}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Tasks Settings */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình Tasks
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Tasks Per Annotator"
                value={settings.tasks?.maxTasksPerAnnotator || 100}
                onChange={(e) => setSettings({
                  ...settings,
                  tasks: { ...settings.tasks, maxTasksPerAnnotator: parseInt(e.target.value) }
                })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Default Task Status</InputLabel>
                <Select
                  value={settings.tasks?.defaultTaskStatus || 'assigned'}
                  onChange={(e) => setSettings({
                    ...settings,
                    tasks: { ...settings.tasks, defaultTaskStatus: e.target.value }
                  })}
                  label="Default Task Status"
                >
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.tasks?.autoAssignEnabled || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      tasks: { ...settings.tasks, autoAssignEnabled: e.target.checked }
                    })}
                  />
                }
                label="Tự động phân công tasks (Auto Assign)"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Review Settings */}
      {tabValue === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình Review
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.review?.requireReviewComments || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      review: { ...settings.review, requireReviewComments: e.target.checked }
                    })}
                  />
                }
                label="Bắt buộc nhập comments khi reject"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Auto Approve After Days (0 = disabled)"
                value={settings.review?.autoApproveAfterDays || 0}
                onChange={(e) => setSettings({
                  ...settings,
                  review: { ...settings.review, autoApproveAfterDays: parseInt(e.target.value) }
                })}
                margin="normal"
                helperText="Tự động approve nếu không review sau X ngày"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Rejections Before Escalation"
                value={settings.review?.maxRejectionsBeforeEscalation || 3}
                onChange={(e) => setSettings({
                  ...settings,
                  review: { ...settings.review, maxRejectionsBeforeEscalation: parseInt(e.target.value) }
                })}
                margin="normal"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Notifications Settings */}
      {tabValue === 5 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cấu hình Notifications
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications?.emailOnTaskAssigned || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnTaskAssigned: e.target.checked }
                    })}
                  />
                }
                label="Gửi email khi task được phân công"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications?.emailOnTaskSubmitted || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnTaskSubmitted: e.target.checked }
                    })}
                  />
                }
                label="Gửi email khi task được nộp để review"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications?.emailOnTaskReviewed || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnTaskReviewed: e.target.checked }
                    })}
                  />
                }
                label="Gửi email khi task được review"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications?.emailOnTaskRejected || false}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnTaskRejected: e.target.checked }
                    })}
                  />
                }
                label="Gửi email khi task bị reject"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}
        </Button>
      </Box>
    </Box>
  );
};

export default SystemSettings;
