import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0f172a]"
      sx={{
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>

      <Box className="relative z-10 w-full max-w-[450px] px-6 animate-fadeIn">
        <Box className="glass p-8 md:p-10 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl bg-white/5">
          <Box className="text-center mb-10">
            <Typography
              variant="h3"
              component="h1"
              className="font-black tracking-tight mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
              sx={{ fontWeight: 800 }}
            >
              Welcome Back
            </Typography>
            <Typography className="text-slate-400 font-medium">
              Enterprise Data Labeling Platform
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              variant="filled"
              className="mb-6 rounded-xl animate-shake"
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
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
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: 'rgba(148, 163, 184, 0.5)' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
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
              }}
            />

            <Box className="flex justify-end">
              <Typography
                variant="body2"
                className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium transition-colors"
                onClick={() => navigate('/forgot-password')}
              >
                Forgot password?
              </Typography>
            </Box>

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.8,
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
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <Box className="flex items-center gap-2">
                  <LoginIcon fontSize="small" />
                  Sign In
                </Box>
              )}
            </Button>

            <Box className="text-center pt-4">
              <Typography variant="body2" className="text-slate-400">
                New on our platform?{' '}
                <span
                  className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-bold transition-colors"
                  onClick={() => navigate('/register')}
                >
                  Create an account
                </span>
              </Typography>
            </Box>
          </form>
        </Box>

        {/* Footer text */}
        <Typography
          className="text-center mt-10 text-slate-500 text-xs font-medium tracking-widest uppercase"
          variant="caption"
          display="block"
        >
          © 2026 Data Labeling Platform. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
