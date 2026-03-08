import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  AccountCircle as AccountCircleIcon,
  Work as WorkIcon,
  Visibility,
  VisibilityOff,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'annotator',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0f172a]"
      sx={{
        fontFamily: "'Inter', sans-serif",
        py: 8,
      }}
    >
      {/* Background Blobs (same as login) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <Box className="relative z-10 w-full max-w-[500px] px-6 animate-fadeIn">
        <Box className="glass p-8 md:p-10 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl bg-white/5">
          <Box className="text-center mb-8">
            <Typography
              variant="h4"
              component="h1"
              className="font-black tracking-tight mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
              sx={{ fontWeight: 800 }}
            >
              Create Account
            </Typography>
            <Typography className="text-slate-400 font-medium">
              Join our enterprise data labeling platform
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              className="mb-6 rounded-xl animate-shake"
              variant="filled"
              sx={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                '& .MuiAlert-icon': { color: '#fca5a5' }
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldStyles}
            />

            <TextField
              fullWidth
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircleIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldStyles}
            />

            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldStyles}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={fieldStyles}
            />

            <TextField
              fullWidth
              select
              label="Role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WorkIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                ...fieldStyles,
                '& .MuiSelect-select': {
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center'
                },
                '& .MuiSvgIcon-root': { color: 'rgba(148, 163, 184, 0.7)' }
              }}
            >
              <MenuItem value="annotator">Annotator</MenuItem>
              <MenuItem value="reviewer">Reviewer</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={submitButtonStyles}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <Box className="flex items-center gap-2">
                  <PersonAddIcon fontSize="small" />
                  Sign Up
                </Box>
              )}
            </Button>

            <Box className="text-center pt-4">
              <Typography variant="body2" className="text-slate-400">
                Already have an account?{' '}
                <span
                  className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-bold transition-colors"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </span>
              </Typography>
            </Box>
          </form>
        </Box>
        <Typography className="text-center mt-8 text-slate-500 text-xs font-medium tracking-widest uppercase" variant="caption" display="block">
          © 2026 Data Labeling Platform. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

const fieldStyles = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(148, 163, 184, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
};

const submitButtonStyles = {
  py: 1.8,
  mt: 2,
  borderRadius: '12px',
  background: 'linear-gradient(45deg, #4f46e5 30%, #6366f1 90%)',
  color: 'white',
  fontSize: '1rem',
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
  '&:hover': {
    background: 'linear-gradient(45deg, #4338ca 30%, #4f46e5 90%)',
    boxShadow: '0 12px 20px -4px rgba(79, 70, 229, 0.5)',
  },
  '&.Mui-disabled': {
    background: 'rgba(79, 70, 229, 0.1)',
    color: 'rgba(255, 255, 255, 0.3)',
  }
};

export default Register;
