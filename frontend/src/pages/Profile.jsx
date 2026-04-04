import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Snackbar,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_URL}/api/users/me`);
        const me = res.data?.user;
        if (!mounted) return;
        setForm((prev) => ({
          ...prev,
          fullName: me?.fullName || '',
          email: me?.email || '',
        }));
      } catch (e) {
        if (!mounted) return;
        setError(e.response?.data?.message || 'Không thể tải thông tin profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMe();
    return () => {
      mounted = false;
    };
  }, []);

  const show = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleSave = async () => {
    setError('');

    if (!form.fullName.trim()) {
      setError('Vui lòng nhập họ tên.');
      return;
    }

    if (form.newPassword || form.currentPassword) {
      if (!form.currentPassword) {
        setError('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.');
        return;
      }
      if (!form.newPassword || form.newPassword.length < 6) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
      }
      if (form.newPassword !== form.confirmNewPassword) {
        setError('Xác nhận mật khẩu mới không khớp.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
      };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const res = await axios.put(`${API_URL}/api/users/me`, payload);
      const updated = res.data?.user;

      if (updated) {
        setUser(updated);
      }

      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));

      show('Đã cập nhật profile thành công!');
    } catch (e) {
      setError(e.response?.data?.message || 'Cập nhật profile thất bại.');
      show('Cập nhật profile thất bại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Profile
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Cập nhật thông tin cá nhân của bạn
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Họ và tên"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              disabled={loading || saving}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Email" value={form.email} disabled />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Đổi mật khẩu (tuỳ chọn)
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Mật khẩu hiện tại"
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              disabled={loading || saving}
              autoComplete="current-password"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Mật khẩu mới"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              disabled={loading || saving}
              autoComplete="new-password"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Xác nhận mật khẩu mới"
              type="password"
              value={form.confirmNewPassword}
              onChange={(e) => setForm({ ...form, confirmNewPassword: e.target.value })}
              disabled={loading || saving}
              autoComplete="new-password"
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                disabled={saving}
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Đăng xuất
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={loading || saving}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={notification.open}
        autoHideDuration={2500}
        onClose={() => setNotification((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={notification.severity}
          variant="filled"
          onClose={() => setNotification((p) => ({ ...p, open: false }))}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;
