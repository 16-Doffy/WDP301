import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  MenuItem,
} from '@mui/material';
import {
  EmailOutlined,
  LockOutlined,
  Visibility,
  VisibilityOff,
  PersonOutline,
  BadgeOutlined,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: 'rgba(15, 23, 42, 0.75)',
    color: '#e2e8f0',
    '& fieldset': { borderColor: '#334155' },
    '&:hover fieldset': { borderColor: '#475569' },
    '&.Mui-focused fieldset': { borderColor: '#22d3ee' },
    '& input:-webkit-autofill': {
      WebkitBoxShadow: '0 0 0 100px rgba(15, 23, 42, 0.75) inset',
      WebkitTextFillColor: '#e2e8f0',
      caretColor: '#e2e8f0',
      borderRadius: 'inherit',
      transition: 'background-color 9999s ease-out 0s',
    },
    '& input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
      WebkitBoxShadow: '0 0 0 100px rgba(15, 23, 42, 0.75) inset',
      WebkitTextFillColor: '#e2e8f0',
    },
  },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#67e8f9' },
};

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'annotator',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.55fr 1fr' },
        background: 'radial-gradient(1200px 600px at 30% 30%, #0f3b46 0%, #07131f 55%, #050b14 100%)',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'flex-start',
          p: 6,
          borderRight: '1px solid rgba(51,65,85,0.6)',
          background:
            'radial-gradient(circle at 52% 56%, rgba(34,211,238,0.14) 0%, rgba(15,23,42,0) 52%), linear-gradient(180deg, rgba(8,47,73,0.45), rgba(2,6,23,0.7))',
        }}
      >
        <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: 30 }}>Labelyze AI</Typography>

        <Box sx={{ maxWidth: 620 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: 56, lineHeight: 1.05 }}>
            The future of <span style={{ color: '#22d3ee' }}>Data Labeling</span> is here
          </Typography>
          <Typography sx={{ color: '#cbd5e1', mt: 2, fontSize: 22, maxWidth: 560 }}>
            Empower your AI models with high-precision annotations fueled by our distributed labeling ecosystem.
          </Typography>
          <Box sx={{ display: 'flex', gap: 8, mt: 5 }}>
            <Box>
              <Typography sx={{ color: '#22d3ee', fontSize: 42, fontWeight: 800 }}>TEAM 8</Typography>
              <Typography sx={{ color: '#94a3b8' }}>Data Labeling</Typography>
            </Box> 
            <Box>
              <Typography sx={{ color: '#22d3ee', fontSize: 42, fontWeight: 800 }}>WDP301</Typography>
              <Typography sx={{ color: '#94a3b8' }}>Support System</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', p: { xs: 2, sm: 5 }, pt: { xs: 3, sm: 5 } }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 500,
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            border: '1px solid rgba(71,85,105,0.45)',
            bgcolor: 'rgba(15,23,42,0.62)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
          }}
        >
          <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 800, mb: 1 }}>
            Create Account
          </Typography>
          <Typography sx={{ color: '#94a3b8', mb: 3 }}>
            Join the future of data labeling
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} autoComplete="off" noValidate>
            <TextField
              fullWidth
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="off"
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Username"
              name="auth_username_custom"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="off"
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeOutlined sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Email Address"
              name="auth_register_email_custom"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="off"
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              select
              label="Role Selection"
              name="role"
              value={formData.role}
              onChange={handleChange}
              margin="normal"
              required
              sx={fieldSx}
            >
              <MenuItem value="annotator">Annotator</MenuItem>
              <MenuItem value="reviewer">Reviewer</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </TextField>

            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" sx={{ color: '#94a3b8' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              required
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword((s) => !s)} edge="end" sx={{ color: '#94a3b8' }}>
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 2,
                py: 1.5,
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 2,
                textTransform: 'none',
                bgcolor: '#22d3ee',
                color: '#082f49',
                '&:hover': { bgcolor: '#67e8f9' },
              }}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </Button>

            <Typography sx={{ mt: 2.5, textAlign: 'center', color: '#94a3b8' }}>
              Already have an account?{' '}
              <Button onClick={() => navigate('/login')} sx={{ textTransform: 'none', color: '#22d3ee', fontWeight: 700, p: 0, minWidth: 'unset' }}>
                Sign In
              </Button>
            </Typography>

          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Register;
