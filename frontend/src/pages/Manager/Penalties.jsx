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

const panelSx = {
  borderRadius: 3,
  boxShadow: '0 16px 32px rgba(0,0,0,0.35)',
  background: '#111827',
  border: '1px solid #374151',
  color: '#e5e7eb',
};

const cardSx = {
  borderRadius: 3,
  boxShadow: '0 12px 24px rgba(0,0,0,0.28)',
  background: '#1f2937',
  border: '1px solid #374151',
  color: '#e5e7eb',
};

const Penalties = () => {
  const [users, setUsers] = useState([]);
  const [userScores, setUserScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({ level: 'warning', reason: '', errorType: '', action: 'notification' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewPenaltiesDialogOpen, setViewPenaltiesDialogOpen] = useState(false);
  const [userPenalties, setUserPenalties] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState({ type: 'improvement', reason: '', scoreBonus: 5 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const allUsers = response.data || [];
      const filteredUsers = allUsers.filter((u) => (u.role === 'annotator' || u.role === 'reviewer') && u.isActive);
      setUsers(filteredUsers);

      const scorePromises = filteredUsers.map((u) =>
        axios
          .get(`${API_URL}/api/penalties/score/${u._id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
          .catch(() => null)
      );

      const scoreResults = await Promise.all(scorePromises);
      const scoresMap = {};
      scoreResults.forEach((result, index) => {
        if (result?.data) scoresMap[filteredUsers[index]._id] = result.data;
      });
      setUserScores(scoresMap);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Không thể tải danh sách users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePenalty = async () => {
    if (!selectedUser) return setError('Vui lòng chọn user');
    if (!penaltyForm.reason.trim()) return setError('Vui lòng nhập lý do phạt');

    setSubmitting(true);
    setError(null);
    try {
      await axios.post(
        `${API_URL}/api/penalties`,
        {
          userId: selectedUser._id,
          level: penaltyForm.level,
          reason: penaltyForm.reason.trim(),
          errorType: penaltyForm.errorType || undefined,
          action: penaltyForm.action,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setSuccess(`Đã tạo penalty ${penaltyForm.level} cho ${selectedUser.fullName || selectedUser.username}`);
      setCreateDialogOpen(false);
      setPenaltyForm({ level: 'warning', reason: '', errorType: '', action: 'notification' });
      setSelectedUser(null);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Lỗi khi tạo penalty: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPenalties = async (userId) => {
    setSelectedUserId(userId);
    try {
      const response = await axios.get(`${API_URL}/api/penalties/user/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUserPenalties(response.data || []);
      setViewPenaltiesDialogOpen(true);
    } catch {
      setError('Không thể tải lịch sử penalties');
    }
  };

  const getPenaltyLevelLabel = (level) => ({ warning: 'Cảnh báo', light: 'Phạt nhẹ', heavy: 'Phạt nặng' }[level] || level);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, minHeight: '100vh', background: '#0f172a' }}>
      <Box sx={panelSx}>
        <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #374151' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#e5e7eb', mb: 0.5 }}>
                Quản lý Penalties & Scores
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                Xem quality scores và tạo penalties cho annotators/reviewers.
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
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 800,
                  borderColor: '#4b5563',
                  color: '#d1d5db',
                  bgcolor: '#1f2937',
                  '&:hover': { bgcolor: '#374151', borderColor: '#6b7280' },
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
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                Tạo Penalty
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}><CardContent><Typography sx={{ color: '#9ca3af', mb: 1 }} variant="overline" fontWeight={700}>Tổng số Users</Typography><Typography variant="h4" fontWeight={800}>{users.length}</Typography></CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}><CardContent><Typography sx={{ color: '#9ca3af', mb: 1 }} variant="overline" fontWeight={700}>Users có Score {'<'} 60</Typography><Typography variant="h4" fontWeight={800} color="#fb7185">{Object.values(userScores).filter((s) => s.qualityScore < 60).length}</Typography></CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}><CardContent><Typography sx={{ color: '#9ca3af', mb: 1 }} variant="overline" fontWeight={700}>Users bị Restrict</Typography><Typography variant="h4" fontWeight={800} color="#f59e0b">{Object.values(userScores).filter((s) => s.isRestricted).length}</Typography></CardContent></Card>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ ...cardSx, mb: 2, '& .MuiTableCell-root': { borderColor: '#374151' } }}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#111827' }}>
                  {['User', 'Role', 'Quality Score', 'Tasks', 'Error Rate', 'Penalty Level', 'Status', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ color: '#9ca3af', fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const s = userScores[u._id] || { qualityScore: 100, completedTasks: 0, approvedTasks: 0, rejectedTasks: 0, errorRate: 0, currentPenaltyLevel: 'none', isRestricted: false };
                  return (
                    <TableRow key={u._id} hover sx={{ '&:hover': { bgcolor: '#1f2937' } }}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={700} color="#e5e7eb">{u.fullName || u.username}</Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>{u.email}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={u.role === 'annotator' ? 'Annotator' : 'Reviewer'} size="small" sx={{ bgcolor: u.role === 'annotator' ? 'rgba(59,130,246,0.15)' : 'rgba(167,139,250,0.15)', color: u.role === 'annotator' ? '#60a5fa' : '#a78bfa', fontWeight: 700, border: '1px solid #374151' }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={s.qualityScore.toFixed(1)} size="small" sx={{ bgcolor: s.qualityScore >= 80 ? 'rgba(34,197,94,0.15)' : s.qualityScore >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(251,113,133,0.15)', color: s.qualityScore >= 80 ? '#4ade80' : s.qualityScore >= 60 ? '#f59e0b' : '#fb7185', fontWeight: 800, border: '1px solid #374151' }} />
                          <LinearProgress variant="determinate" value={s.qualityScore} sx={{ width: 70, height: 6, borderRadius: 3, bgcolor: '#374151', '& .MuiLinearProgress-bar': { bgcolor: s.qualityScore >= 80 ? '#4ade80' : s.qualityScore >= 60 ? '#f59e0b' : '#fb7185' } }} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#e5e7eb' }}>✓ {s.approvedTasks} / ✗ {s.rejectedTasks}</Typography>
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>Total: {s.completedTasks}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={`${s.errorRate.toFixed(1)}%`} size="small" sx={{ bgcolor: s.errorRate > 15 ? 'rgba(251,113,133,0.15)' : 'rgba(107,114,128,0.15)', color: s.errorRate > 15 ? '#fb7185' : '#d1d5db', border: '1px solid #374151' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={getPenaltyLevelLabel(s.currentPenaltyLevel)} size="small" sx={{ bgcolor: s.currentPenaltyLevel !== 'none' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)', color: s.currentPenaltyLevel !== 'none' ? '#f59e0b' : '#9ca3af', border: '1px solid #374151' }} icon={s.currentPenaltyLevel !== 'none' ? <WarningIcon sx={{ color: '#f59e0b !important', fontSize: '16px' }} /> : null} />
                      </TableCell>
                      <TableCell>
                        <Chip label={s.isRestricted ? 'Restricted' : 'Active'} size="small" sx={{ bgcolor: s.isRestricted ? 'rgba(251,113,133,0.15)' : 'rgba(34,197,94,0.15)', color: s.isRestricted ? '#fb7185' : '#4ade80', border: '1px solid #374151' }} icon={s.isRestricted ? <CancelIcon sx={{ color: '#fb7185 !important', fontSize: '16px' }} /> : <CheckCircleIcon sx={{ color: '#4ade80 !important', fontSize: '16px' }} />} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleViewPenalties(u._id)} sx={{ color: '#9ca3af' }}><VisibilityIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => { setSelectedUser(u); setCreateDialogOpen(true); }} sx={{ color: '#fb7185' }}><GavelIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#111827', color: '#e5e7eb', border: '1px solid #374151' } }}>
        <DialogTitle>Tạo Penalty {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Chọn User *</InputLabel>
                <Select value={selectedUser?._id || ''} onChange={(e) => setSelectedUser(users.find((u) => u._id === e.target.value))} label="Chọn User *">
                  {users.map((u) => <MenuItem key={u._id} value={u._id}>{u.fullName || u.username} ({u.role})</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#9ca3af' }}>Mức phạt *</InputLabel>
              <Select value={penaltyForm.level} onChange={(e) => setPenaltyForm({ ...penaltyForm, level: e.target.value })} label="Mức phạt *">
                <MenuItem value="warning">Cảnh báo (-2 điểm)</MenuItem>
                <MenuItem value="light">Phạt nhẹ (-5 điểm)</MenuItem>
                <MenuItem value="heavy">Phạt nặng (-10 điểm)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#9ca3af' }}>Loại lỗi</InputLabel>
              <Select value={penaltyForm.errorType} onChange={(e) => setPenaltyForm({ ...penaltyForm, errorType: e.target.value })} label="Loại lỗi">
                <MenuItem value="wrong_label">Nhãn sai</MenuItem>
                <MenuItem value="missed_guideline">Không tuân guideline</MenuItem>
                <MenuItem value="sloppy_work">Làm ẩu</MenuItem>
                <MenuItem value="repeat_error">Lặp lỗi cũ</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#9ca3af' }}>Hành động</InputLabel>
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
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: '#d1d5db' }}>Hủy</Button>
          <Button onClick={handleCreatePenalty} variant="contained" disabled={submitting || !penaltyForm.reason.trim() || !selectedUser} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
            {submitting ? <CircularProgress size={20} /> : 'Tạo Penalty'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewPenaltiesDialogOpen} onClose={() => setViewPenaltiesDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#111827', color: '#e5e7eb', border: '1px solid #374151' } }}>
        <DialogTitle>Lịch sử Penalties {selectedUserId && users.find((u) => u._id === selectedUserId)?.username}</DialogTitle>
        <DialogContent>
          {userPenalties.length === 0 ? (
            <Alert severity="info">Chưa có penalty nào</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {userPenalties.map((p) => (
                <Paper key={p._id} sx={{ p: 2, bgcolor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={getPenaltyLevelLabel(p.level)} size="small" color={p.level === 'heavy' ? 'error' : 'warning'} />
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>{new Date(p.createdAt).toLocaleString('vi-VN')}</Typography>
                  </Box>
                  <Typography variant="body2"><strong>Lý do:</strong> {p.reason}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#9ca3af' }}>
                    Hành động: {p.action} | Trừ điểm: -{p.scoreDeduction}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewPenaltiesDialogOpen(false)} sx={{ color: '#d1d5db' }}>Đóng</Button></DialogActions>
      </Dialog>

      <Dialog open={rewardDialogOpen} onClose={() => setRewardDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#111827', color: '#e5e7eb', border: '1px solid #374151' } }}>
        <DialogTitle>Tạo Reward {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Chọn User *</InputLabel>
                <Select value={selectedUser?._id || ''} onChange={(e) => setSelectedUser(users.find((u) => u._id === e.target.value))} label="Chọn User *">
                  {users.map((u) => <MenuItem key={u._id} value={u._id}>{u.fullName || u.username}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#9ca3af' }}>Loại thưởng *</InputLabel>
              <Select value={rewardForm.type} onChange={(e) => setRewardForm({ ...rewardForm, type: e.target.value })} label="Loại thưởng *">
                <MenuItem value="approval_streak">Chuỗi approval tốt</MenuItem>
                <MenuItem value="high_quality">Chất lượng cao</MenuItem>
                <MenuItem value="improvement">Cải thiện tốt</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth type="number" label="Điểm thưởng *" value={rewardForm.scoreBonus} onChange={(e) => setRewardForm({ ...rewardForm, scoreBonus: parseInt(e.target.value, 10) || 0 })} />
            <TextField fullWidth multiline rows={3} label="Lý do thưởng *" value={rewardForm.reason} onChange={(e) => setRewardForm({ ...rewardForm, reason: e.target.value })} required />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRewardDialogOpen(false)} sx={{ color: '#d1d5db' }}>Hủy</Button>
          <Button
            onClick={async () => {
              if (!selectedUser || !rewardForm.reason.trim()) return;
              setSubmitting(true);
              try {
                await axios.post(
                  `${API_URL}/api/penalties/reward`,
                  { userId: selectedUser._id, ...rewardForm },
                  { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                setSuccess('Đã tạo reward thành công!');
                setRewardDialogOpen(false);
                await fetchUsers();
                setTimeout(() => setSuccess(null), 3000);
              } catch {
                setError('Lỗi khi tạo reward');
              } finally {
                setSubmitting(false);
              }
            }}
            variant="contained"
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
          >
            Tạo Reward
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Penalties;
