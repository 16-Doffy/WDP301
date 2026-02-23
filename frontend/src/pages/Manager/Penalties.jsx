import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Warning as WarningIcon,
  Gavel as GavelIcon,
  Visibility as VisibilityIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const glassCardSx = {
  borderRadius: 3,
  boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(10px)',
  color: 'rgba(255,255,255,0.92)',
};

const Penalties = () => {
  const [users, setUsers] = useState([]);
  const [userScores, setUserScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({
    level: 'warning',
    reason: '',
    errorType: '',
    action: 'notification',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewPenaltiesDialogOpen, setViewPenaltiesDialogOpen] = useState(false);
  const [userPenalties, setUserPenalties] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState({
    type: 'improvement',
    reason: '',
    scoreBonus: 5,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const allUsers = response.data || [];
      const filteredUsers = allUsers.filter(u => 
        (u.role === 'annotator' || u.role === 'reviewer') && u.isActive
      );
      setUsers(filteredUsers);

      const scorePromises = filteredUsers.map(user => 
        axios.get(`${API_URL}/api/penalties/score/${user._id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).catch(() => null)
      );

      const scoreResults = await Promise.all(scorePromises);
      const scoresMap = {};
      scoreResults.forEach((result, index) => {
        if (result && result.data) {
          scoresMap[filteredUsers[index]._id] = result.data;
        }
      });
      setUserScores(scoresMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Không thể tải danh sách users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePenalty = async () => {
    if (!selectedUser) {
      setError('Vui lòng chọn user');
      return;
    }
    if (!penaltyForm.reason.trim()) {
      setError('Vui lòng nhập lý do phạt');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/api/penalties`, {
        userId: selectedUser._id,
        level: penaltyForm.level,
        reason: penaltyForm.reason.trim(),
        errorType: penaltyForm.errorType || undefined,
        action: penaltyForm.action,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setSuccess(`Đã tạo penalty ${penaltyForm.level} cho ${selectedUser.fullName || selectedUser.username}`);
      setCreateDialogOpen(false);
      setPenaltyForm({
        level: 'warning',
        reason: '',
        errorType: '',
        action: 'notification',
      });
      setSelectedUser(null);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Lỗi khi tạo penalty: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPenalties = async (userId) => {
    setSelectedUserId(userId);
    try {
      const response = await axios.get(`${API_URL}/api/penalties/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setUserPenalties(response.data || []);
      setViewPenaltiesDialogOpen(true);
    } catch (error) {
      setError('Không thể tải lịch sử penalties');
    }
  };

  const getPenaltyLevelLabel = (level) => {
    const labels = {
      warning: 'Cảnh báo',
      light: 'Phạt nhẹ',
      heavy: 'Phạt nặng'
    };
    return labels[level] || level;
  };

  const getErrorTypeLabel = (errorType) => {
    const labels = {
      wrong_label: 'Nhãn sai',
      missed_guideline: 'Không tuân guideline',
      sloppy_work: 'Làm ẩu',
      deadline_missed: 'Trễ deadline',
      repeat_error: 'Lặp lỗi cũ',
      fraud: 'Gian lận',
      wrong_approval: 'Duyệt sai',
      wrong_rejection: 'Từ chối sai',
    };
    return labels[errorType] || errorType;
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh' }}>
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
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(900px circle at 20% 10%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(700px circle at 85% 30%, rgba(255,255,255,0.18), transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            mb: 3,
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ color: 'white', mb: 0.5 }}>
              Quản lý Penalties & Scores
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Xem quality scores và tạo penalties cho annotators/reviewers
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
            <Button
              variant="outlined"
              startIcon={<StarIcon />}
              onClick={() => {
                setSelectedUser(null);
                setRewardForm({ type: 'improvement', reason: '', scoreBonus: 5 });
                setRewardDialogOpen(true);
              }}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 800,
                borderColor: 'rgba(255,255,255,0.6)',
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', borderColor: 'white' },
              }}
            >
              Tạo Reward
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedUser(null);
                setPenaltyForm({ level: 'warning', reason: '', errorType: '', action: 'notification' });
                setCreateDialogOpen(true);
              }}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 900,
                bgcolor: 'rgba(15,23,42,0.3)',
                color: 'white',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                '&:hover': { bgcolor: 'rgba(15,23,42,0.4)' },
              }}
            >
              Tạo Penalty
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        <Grid container spacing={3} sx={{ mb: 3, position: 'relative' }}>
          <Grid item xs={12} md={4}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }} variant="overline" fontWeight={700}>Tổng số Users</Typography>
                <Typography variant="h4" fontWeight={800}>{users.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }} variant="overline" fontWeight={700}>Users có Score &lt; 60</Typography>
                <Typography variant="h4" fontWeight={800} color="#FB7185">{Object.values(userScores).filter(s => s.qualityScore < 60).length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={glassCardSx}>
              <CardContent>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }} variant="overline" fontWeight={700}>Users bị Restrict</Typography>
                <Typography variant="h4" fontWeight={800} color="#F59E0B">{Object.values(userScores).filter(s => s.isRestricted).length}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <TableContainer component={Paper} sx={{ ...glassCardSx, mb: 2, position: 'relative' }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>User</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Quality Score</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Tasks</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Error Rate</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Penalty Level</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const s = userScores[u._id] || { qualityScore: 100, completedTasks: 0, approvedTasks: 0, rejectedTasks: 0, errorRate: 0, currentPenaltyLevel: 'none', isRestricted: false };
                return (
                  <TableRow key={u._id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={700} color="white">{u.fullName || u.username}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={u.role === 'annotator' ? 'Annotator' : 'Reviewer'} size="small" sx={{ bgcolor: u.role === 'annotator' ? 'rgba(56,189,248,0.2)' : 'rgba(167,139,250,0.2)', color: u.role === 'annotator' ? '#38BDF8' : '#A78BFA', fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={s.qualityScore.toFixed(1)} size="small" sx={{ bgcolor: s.qualityScore >= 80 ? 'rgba(52,211,153,0.2)' : s.qualityScore >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(251,113,133,0.2)', color: s.qualityScore >= 80 ? '#34D399' : s.qualityScore >= 60 ? '#F59E0B' : '#FB7185', fontWeight: 800 }} />
                        <LinearProgress variant="determinate" value={s.qualityScore} sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: s.qualityScore >= 80 ? '#34D399' : s.qualityScore >= 60 ? '#F59E0B' : '#FB7185' } }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'white' }}>✓ {s.approvedTasks} / ✗ {s.rejectedTasks}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Total: {s.completedTasks}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={`${s.errorRate.toFixed(1)}%`} size="small" sx={{ bgcolor: s.errorRate > 15 ? 'rgba(251,113,133,0.2)' : 'rgba(255,255,255,0.1)', color: s.errorRate > 15 ? '#FB7185' : 'white' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={getPenaltyLevelLabel(s.currentPenaltyLevel)} size="small" sx={{ bgcolor: s.currentPenaltyLevel !== 'none' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)', color: s.currentPenaltyLevel !== 'none' ? '#F59E0B' : 'rgba(255,255,255,0.6)' }} icon={s.currentPenaltyLevel !== 'none' ? <WarningIcon sx={{ color: '#F59E0B !important', fontSize: '16px' }} /> : null} />
                    </TableCell>
                    <TableCell>
                      <Chip label={s.isRestricted ? 'Restricted' : 'Active'} size="small" sx={{ bgcolor: s.isRestricted ? 'rgba(251,113,133,0.2)' : 'rgba(52,211,153,0.2)', color: s.isRestricted ? '#FB7185' : '#34D399' }} icon={s.isRestricted ? <CancelIcon sx={{ color: '#FB7185 !important', fontSize: '16px' }} /> : <CheckCircleIcon sx={{ color: '#34D399 !important', fontSize: '16px' }} />} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleViewPenalties(u._id)} sx={{ color: 'rgba(255,255,255,0.7)' }}><VisibilityIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => { setSelectedUser(u); setCreateDialogOpen(true); }} sx={{ color: '#FB7185' }}><GavelIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo Penalty {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel>Chọn User *</InputLabel>
                <Select value={selectedUser?._id || ''} onChange={(e) => setSelectedUser(users.find(u => u._id === e.target.value))} label="Chọn User *">
                  {users.map(u => <MenuItem key={u._id} value={u._id}>{u.fullName || u.username} ({u.role})</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>Mức phạt *</InputLabel>
              <Select value={penaltyForm.level} onChange={(e) => setPenaltyForm({ ...penaltyForm, level: e.target.value })} label="Mức phạt *">
                <MenuItem value="warning">Cảnh báo (-2 điểm)</MenuItem>
                <MenuItem value="light">Phạt nhẹ (-5 điểm)</MenuItem>
                <MenuItem value="heavy">Phạt nặng (-10 điểm)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Loại lỗi</InputLabel>
              <Select value={penaltyForm.errorType} onChange={(e) => setPenaltyForm({ ...penaltyForm, errorType: e.target.value })} label="Loại lỗi">
                <MenuItem value="wrong_label">Nhãn sai</MenuItem>
                <MenuItem value="missed_guideline">Không tuân guideline</MenuItem>
                <MenuItem value="sloppy_work">Làm ẩu</MenuItem>
                <MenuItem value="repeat_error">Lặp lỗi cũ</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Hành động</InputLabel>
              <Select value={penaltyForm.action} onChange={(e) => setPenaltyForm({ ...penaltyForm, action: e.target.value })} label="Hành động">
                <MenuItem value="notification">Thông báo</MenuItem>
                <MenuItem value="read_guideline">Bắt đọc guideline</MenuItem>
                <MenuItem value="reduce_tasks">Giảm số task</MenuItem>
                <MenuItem value="temporary_ban">Ban tạm thời</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth multiline rows={3} label="Lý do phạt *" value={penaltyForm.reason} onChange={(e) => setPenaltyForm({ ...penaltyForm, reason: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleCreatePenalty} variant="contained" disabled={submitting || !penaltyForm.reason.trim() || !selectedUser}>{submitting ? <CircularProgress size={20} /> : 'Tạo Penalty'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewPenaltiesDialogOpen} onClose={() => setViewPenaltiesDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Lịch sử Penalties {selectedUserId && users.find(u => u._id === selectedUserId)?.username}</DialogTitle>
        <DialogContent>
          {userPenalties.length === 0 ? <Alert severity="info">Chưa có penalty nào</Alert> : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {userPenalties.map(p => (
                <Paper key={p._id} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={getPenaltyLevelLabel(p.level)} size="small" color={p.level === 'heavy' ? 'error' : 'warning'} />
                    <Typography variant="caption">{new Date(p.createdAt).toLocaleString('vi-VN')}</Typography>
                  </Box>
                  <Typography variant="body2"><strong>Lý do:</strong> {p.reason}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Hành động: {p.action} | Trừ điểm: -{p.scoreDeduction}</Typography>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewPenaltiesDialogOpen(false)}>Đóng</Button></DialogActions>
      </Dialog>

      <Dialog open={rewardDialogOpen} onClose={() => setRewardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo Reward {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel>Chọn User *</InputLabel>
                <Select value={selectedUser?._id || ''} onChange={(e) => setSelectedUser(users.find(u => u._id === e.target.value))} label="Chọn User *">
                  {users.map(u => <MenuItem key={u._id} value={u._id}>{u.fullName || u.username}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>Loại thưởng *</InputLabel>
              <Select value={rewardForm.type} onChange={(e) => setRewardForm({ ...rewardForm, type: e.target.value })} label="Loại thưởng *">
                <MenuItem value="approval_streak">Chuỗi approval tốt</MenuItem>
                <MenuItem value="high_quality">Chất lượng cao</MenuItem>
                <MenuItem value="improvement">Cải thiện tốt</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth type="number" label="Điểm thưởng *" value={rewardForm.scoreBonus} onChange={(e) => setRewardForm({ ...rewardForm, scoreBonus: parseInt(e.target.value) || 0 })} />
            <TextField fullWidth multiline rows={3} label="Lý do thưởng *" value={rewardForm.reason} onChange={(e) => setRewardForm({ ...rewardForm, reason: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRewardDialogOpen(false)}>Hủy</Button>
          <Button onClick={async () => {
            if (!selectedUser || !rewardForm.reason.trim()) return;
            setSubmitting(true);
            try {
              await axios.post(`${API_URL}/api/penalties/reward`, { userId: selectedUser._id, ...rewardForm }, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
              setSuccess('Đã tạo reward thành công!');
              setRewardDialogOpen(false);
              await fetchUsers();
              setTimeout(() => setSuccess(null), 3000);
            } catch (err) { setError('Lỗi khi tạo reward'); } finally { setSubmitting(false); }
          }} variant="contained" color="success">Tạo Reward</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Penalties;
