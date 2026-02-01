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
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const Penalties = () => {
  const { user } = useAuth();
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
  const [checkingImprovement, setCheckingImprovement] = useState(false);

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
      // Filter only annotators and reviewers
      const filteredUsers = allUsers.filter(u => 
        (u.role === 'annotator' || u.role === 'reviewer') && u.isActive
      );
      setUsers(filteredUsers);

      // Fetch scores for all users
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
      
      // Refresh data
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

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getPenaltyLevelColor = (level) => {
    if (level === 'warning') return 'warning';
    if (level === 'light') return 'info';
    return 'error';
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Quản lý Penalties & Scores
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Xem quality scores và tạo penalties cho annotators/reviewers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<StarIcon />}
            onClick={() => {
              setSelectedUser(null);
              setRewardForm({
                type: 'improvement',
                reason: '',
                scoreBonus: 5,
              });
              setRewardDialogOpen(true);
            }}
          >
            Tạo Reward
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedUser(null);
              setPenaltyForm({
                level: 'warning',
                reason: '',
                errorType: '',
                action: 'notification',
              });
              setCreateDialogOpen(true);
            }}
          >
            Tạo Penalty
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Tổng số Users
              </Typography>
              <Typography variant="h4">
                {users.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Users có Score &lt; 60
              </Typography>
              <Typography variant="h4" color="error">
                {Object.values(userScores).filter(s => s.qualityScore < 60).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Users bị Restrict
              </Typography>
              <Typography variant="h4" color="warning.main">
                {Object.values(userScores).filter(s => s.isRestricted).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Quality Score</TableCell>
              <TableCell>Tasks</TableCell>
              <TableCell>Error Rate</TableCell>
              <TableCell>Penalty Level</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const score = userScores[user._id] || {
                qualityScore: 100,
                completedTasks: 0,
                approvedTasks: 0,
                rejectedTasks: 0,
                errorRate: 0,
                currentPenaltyLevel: 'none',
                isRestricted: false,
              };

              return (
                <TableRow key={user._id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {user.fullName || user.username}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role === 'annotator' ? 'Annotator' : 'Reviewer'}
                      size="small"
                      color={user.role === 'annotator' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={`${score.qualityScore.toFixed(1)}`}
                        color={getScoreColor(score.qualityScore)}
                        size="small"
                      />
                      <LinearProgress
                        variant="determinate"
                        value={score.qualityScore}
                        sx={{ width: 60, height: 8, borderRadius: 1 }}
                        color={getScoreColor(score.qualityScore)}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ✓ {score.approvedTasks || 0} / ✗ {score.rejectedTasks || 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Total: {score.completedTasks || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${(score.errorRate || 0).toFixed(1)}%`}
                      color={score.errorRate > 15 ? 'error' : score.errorRate > 10 ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {score.currentPenaltyLevel !== 'none' ? (
                      <Chip
                        label={getPenaltyLevelLabel(score.currentPenaltyLevel)}
                        color={getPenaltyLevelColor(score.currentPenaltyLevel)}
                        size="small"
                        icon={<WarningIcon />}
                      />
                    ) : (
                      <Chip label="Không có" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    {score.isRestricted ? (
                      <Chip
                        label="Restricted"
                        color="error"
                        size="small"
                        icon={<CancelIcon />}
                      />
                    ) : (
                      <Chip
                        label="Active"
                        color="success"
                        size="small"
                        icon={<CheckCircleIcon />}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Xem lịch sử penalties">
                      <IconButton
                        size="small"
                        onClick={() => handleViewPenalties(user._id)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Tạo penalty">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedUser(user);
                          setCreateDialogOpen(true);
                        }}
                      >
                        <GavelIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Penalty Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Tạo Penalty {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel>Chọn User *</InputLabel>
                <Select
                  value={selectedUser?._id || ''}
                  onChange={(e) => {
                    const user = users.find(u => u._id === e.target.value);
                    setSelectedUser(user);
                  }}
                  label="Chọn User *"
                >
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.fullName || user.username} ({user.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth>
              <InputLabel>Mức phạt *</InputLabel>
              <Select
                value={penaltyForm.level}
                onChange={(e) => setPenaltyForm({ ...penaltyForm, level: e.target.value })}
                label="Mức phạt *"
              >
                <MenuItem value="warning">Cảnh báo (-2 điểm)</MenuItem>
                <MenuItem value="light">Phạt nhẹ (-5 điểm)</MenuItem>
                <MenuItem value="heavy">Phạt nặng (-10 điểm)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Loại lỗi</InputLabel>
              <Select
                value={penaltyForm.errorType}
                onChange={(e) => setPenaltyForm({ ...penaltyForm, errorType: e.target.value })}
                label="Loại lỗi"
              >
                <MenuItem value="">-- Chọn loại lỗi --</MenuItem>
                <MenuItem value="wrong_label">Nhãn sai</MenuItem>
                <MenuItem value="missed_guideline">Không tuân guideline</MenuItem>
                <MenuItem value="sloppy_work">Làm ẩu</MenuItem>
                <MenuItem value="deadline_missed">Trễ deadline</MenuItem>
                <MenuItem value="repeat_error">Lặp lỗi cũ</MenuItem>
                <MenuItem value="fraud">Gian lận</MenuItem>
                <MenuItem value="wrong_approval">Duyệt sai (Reviewer)</MenuItem>
                <MenuItem value="wrong_rejection">Từ chối sai (Reviewer)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Hành động</InputLabel>
              <Select
                value={penaltyForm.action}
                onChange={(e) => setPenaltyForm({ ...penaltyForm, action: e.target.value })}
                label="Hành động"
              >
                <MenuItem value="notification">Thông báo</MenuItem>
                <MenuItem value="read_guideline">Bắt đọc guideline</MenuItem>
                <MenuItem value="reduce_score">Giảm điểm</MenuItem>
                <MenuItem value="reduce_tasks">Giảm số task</MenuItem>
                <MenuItem value="redo_free">Làm lại miễn phí</MenuItem>
                <MenuItem value="temporary_ban">Ban tạm thời</MenuItem>
                <MenuItem value="downgrade_level">Hạ level</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Lý do phạt *"
              value={penaltyForm.reason}
              onChange={(e) => setPenaltyForm({ ...penaltyForm, reason: e.target.value })}
              placeholder="Mô tả chi tiết lý do phạt..."
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button
            onClick={handleCreatePenalty}
            variant="contained"
            disabled={submitting || !penaltyForm.reason.trim() || !selectedUser}
          >
            {submitting ? <CircularProgress size={20} /> : 'Tạo Penalty'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Penalties Dialog */}
      <Dialog
        open={viewPenaltiesDialogOpen}
        onClose={() => setViewPenaltiesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Lịch sử Penalties
          {selectedUserId && users.find(u => u._id === selectedUserId) && (
            <Typography variant="body2" color="textSecondary">
              {users.find(u => u._id === selectedUserId).fullName || users.find(u => u._id === selectedUserId).username}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {userPenalties.length === 0 ? (
            <Alert severity="info">Chưa có penalty nào</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {userPenalties.map((penalty) => (
                <Paper key={penalty._id} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Chip
                      label={getPenaltyLevelLabel(penalty.level)}
                      color={getPenaltyLevelColor(penalty.level)}
                      size="small"
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(penalty.createdAt).toLocaleString('vi-VN')}
                      </Typography>
                      {penalty.status === 'active' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={async () => {
                            try {
                              await axios.put(
                                `${API_URL}/api/penalties/${penalty._id}/resolve`,
                                {},
                                {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  }
                                }
                              );
                              setSuccess('Đã resolve penalty và restore 50% điểm!');
                              await handleViewPenalties(selectedUserId);
                              await fetchUsers();
                              setTimeout(() => setSuccess(null), 3000);
                            } catch (error) {
                              setError('Lỗi khi resolve penalty: ' + (error.response?.data?.message || error.message));
                            }
                          }}
                        >
                          Resolve
                        </Button>
                      )}
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Lý do:</strong> {penalty.reason}
                  </Typography>
                  {penalty.errorType && (
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                      Loại lỗi: {getErrorTypeLabel(penalty.errorType)}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    Trừ điểm: -{penalty.scoreDeduction} | Hành động: {penalty.action}
                  </Typography>
                  <Chip
                    label={penalty.status === 'active' ? 'Đang áp dụng' : penalty.status === 'resolved' ? 'Đã giải quyết' : 'Đã khiếu nại'}
                    size="small"
                    color={penalty.status === 'active' ? 'error' : 'success'}
                    sx={{ mt: 1 }}
                  />
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPenaltiesDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Create Reward Dialog */}
      <Dialog open={rewardDialogOpen} onClose={() => setRewardDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Tạo Reward {selectedUser && `cho ${selectedUser.fullName || selectedUser.username}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {!selectedUser && (
              <FormControl fullWidth>
                <InputLabel>Chọn User *</InputLabel>
                <Select
                  value={selectedUser?._id || ''}
                  onChange={(e) => {
                    const user = users.find(u => u._id === e.target.value);
                    setSelectedUser(user);
                  }}
                  label="Chọn User *"
                >
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.fullName || user.username} ({user.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth>
              <InputLabel>Loại thưởng *</InputLabel>
              <Select
                value={rewardForm.type}
                onChange={(e) => setRewardForm({ ...rewardForm, type: e.target.value })}
                label="Loại thưởng *"
              >
                <MenuItem value="approval_streak">Chuỗi approval tốt</MenuItem>
                <MenuItem value="high_quality">Chất lượng cao</MenuItem>
                <MenuItem value="fast_completion">Hoàn thành nhanh</MenuItem>
                <MenuItem value="no_errors">Không có lỗi</MenuItem>
                <MenuItem value="improvement">Cải thiện tốt</MenuItem>
                <MenuItem value="bonus_task">Bonus task</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Điểm thưởng *"
              value={rewardForm.scoreBonus}
              onChange={(e) => setRewardForm({ ...rewardForm, scoreBonus: parseInt(e.target.value) || 0 })}
              inputProps={{ min: 1, max: 20 }}
              helperText="Điểm sẽ được cộng vào quality score (1-20 điểm)"
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Lý do thưởng *"
              value={rewardForm.reason}
              onChange={(e) => setRewardForm({ ...rewardForm, reason: e.target.value })}
              placeholder="Mô tả chi tiết lý do thưởng..."
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRewardDialogOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button
            onClick={async () => {
              if (!selectedUser) {
                setError('Vui lòng chọn user');
                return;
              }
              if (!rewardForm.reason.trim()) {
                setError('Vui lòng nhập lý do thưởng');
                return;
              }

              setSubmitting(true);
              setError(null);
              try {
                await axios.post(`${API_URL}/api/penalties/reward`, {
                  userId: selectedUser._id,
                  type: rewardForm.type,
                  reason: rewardForm.reason.trim(),
                  scoreBonus: rewardForm.scoreBonus || 5,
                }, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
                });

                setSuccess(`Đã tạo reward +${rewardForm.scoreBonus} điểm cho ${selectedUser.fullName || selectedUser.username}`);
                setRewardDialogOpen(false);
                setRewardForm({
                  type: 'improvement',
                  reason: '',
                  scoreBonus: 5,
                });
                setSelectedUser(null);
                
                await fetchUsers();
                setTimeout(() => setSuccess(null), 3000);
              } catch (error) {
                setError('Lỗi khi tạo reward: ' + (error.response?.data?.message || error.message));
              } finally {
                setSubmitting(false);
              }
            }}
            variant="contained"
            color="success"
            disabled={submitting || !rewardForm.reason.trim() || !selectedUser}
          >
            {submitting ? <CircularProgress size={20} /> : 'Tạo Reward'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Penalties;
