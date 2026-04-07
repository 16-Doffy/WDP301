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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  EmailOutlined,
  LockOutlined,
  Visibility,
  VisibilityOff,
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

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      await login(email, password);
      const token = sessionStorage.getItem('token');
      const payload = token ? JSON.parse(atob(token.split('.')[1])) : {};
      const role = payload?.role;
      if (role === 'annotator') window.location.href = '/annotator';
      else if (role === 'reviewer') window.location.href = '/reviewer';
      else if (role === 'admin') window.location.href = '/admin';
      else window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' },
        background: 'radial-gradient(1200px 600px at 30% 30%, #0f3b46 0%, #07131f 55%, #050b14 100%)',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          borderRight: '1px solid rgba(51,65,85,0.6)',
          background:
            'radial-gradient(circle at 55% 52%, rgba(56,189,248,0.12) 0%, rgba(15,23,42,0) 50%), linear-gradient(180deg, rgba(8,47,73,0.45), rgba(2,6,23,0.7))',
        }}
      >
        <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: 30 }}>Labelyze AI</Typography>

        <Box sx={{ maxWidth: 620 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: 56, lineHeight: 1.05 }}>
            The future of <span style={{ color: '#22d3ee' }}>Data Labeling</span> is here.
          </Typography>
          <Typography sx={{ color: '#cbd5e1', mt: 2, fontSize: 22, maxWidth: 560 }}>
            Scale your AI training workflows with precision and real-time quality assurance.
          </Typography>
          <Box sx={{ display: 'flex', gap: 8, mt: 5 }}>
            <Box>
              <Typography sx={{ color: '#22d3ee', fontSize: 42, fontWeight: 800 }}>TEAM8</Typography>
              <Typography sx={{ color: '#94a3b8', letterSpacing: 2 }}>Data Labeling</Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#22d3ee', fontSize: 42, fontWeight: 800 }}>WDP301</Typography>
              <Typography sx={{ color: '#94a3b8', letterSpacing: 2 }}>Support System</Typography>
            </Box>
          </Box>
        </Box>

        <Typography sx={{ color: '#64748b' }}>© 2026 Labelyze AI Systems. All rights reserved.</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 5 } }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 460,
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            border: '1px solid rgba(71,85,105,0.45)',
            bgcolor: 'rgba(15,23,42,0.62)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
          }}
        >
          <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 800, mb: 1 }}>
            Welcome back
          </Typography>
          <Typography sx={{ color: '#94a3b8', mb: 3 }}>
            Please enter your credentials to access the labeling dashboard
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} autoComplete="off" noValidate>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoComplete="off"
              name="auth_email_custom"
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
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="new-password"
              name="loginPassword"
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1 }}>
              <Button variant="text" sx={{ color: '#22d3ee', textTransform: 'none', fontWeight: 700, minWidth: 'unset' }}>
                FORGOT PASSWORD?
              </Button>
            </Box>

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
              {loading ? 'Signing in...' : 'Sign In to Dashboard'}
            </Button>

            <Typography sx={{ mt: 3, textAlign: 'center', color: '#94a3b8' }}>
              Don&apos;t have an account?{' '}
              <Button onClick={() => navigate('/register')} sx={{ textTransform: 'none', color: '#22d3ee', fontWeight: 700, p: 0, minWidth: 'unset' }}>
                Request access
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
