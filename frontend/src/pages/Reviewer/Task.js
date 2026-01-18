import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [errorCategory, setErrorCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (window.confirm('Bạn có chắc muốn phê duyệt task này? Task sẽ được đánh dấu là approved và không thể chỉnh sửa nữa.')) {
      setProcessing(true);
      try {
        await axios.post(`${API_URL}/api/reviews/${id}/approve`, {
          reviewComments: reviewComments.trim() || undefined,
        });
        alert('Đã phê duyệt task thành công!');
        navigate('/reviewer/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Lỗi khi phê duyệt task';
        alert(errorMessage);
        console.error('Error approving task:', error);
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleReject = async () => {
    if (!reviewComments.trim()) {
      alert('Vui lòng nhập nhận xét khi từ chối task');
      return;
    }

    if (window.confirm('Bạn có chắc muốn từ chối task này? Annotator sẽ nhận được phản hồi và cần chỉnh sửa lại.')) {
      setProcessing(true);
      try {
        await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: errorCategory || 'other',
        });
        alert('Đã từ chối task thành công!');
        navigate('/reviewer/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        alert(errorMessage);
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Review Task
      </Typography>
      {isReviewed && (
        <Alert 
          severity={task?.status === 'approved' ? 'success' : 'warning'} 
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {task?.status === 'approved' ? '✅ Task đã được phê duyệt' : '⚠️ Task đã bị từ chối'}
          </Typography>
          {task?.reviewComments && (
            <Typography variant="body2" gutterBottom>
              <strong>Nhận xét của bạn:</strong> {task.reviewComments}
            </Typography>
          )}
          {task?.reviewedAt && (
            <Typography variant="body2" color="textSecondary">
              Đã review vào: {new Date(task.reviewedAt).toLocaleString()}
            </Typography>
          )}
        </Alert>
      )}
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Project: {task?.projectId?.name}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Guidelines: {task?.projectId?.guidelines}
        </Typography>
        <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
          Annotator: {task?.annotatorId?.fullName || task?.annotatorId?.username}
        </Typography>
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            File: {task?.dataItem?.filename}
          </Typography>
          {task?.dataItem?.mimeType?.startsWith('image/') && (
            <Box sx={{ mt: 2 }}>
              <img
                src={`${API_URL}/${task.dataItem.path}`}
                alt="Data item"
                style={{ maxWidth: '100%', maxHeight: '500px' }}
              />
            </Box>
          )}
        </Box>
        <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Labels:
          </Typography>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(task?.labels, null, 2)}
          </pre>
        </Paper>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Review Comments (Required for rejection)"
          value={reviewComments}
          onChange={(e) => setReviewComments(e.target.value)}
          margin="normal"
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Error Category (Optional)</InputLabel>
          <Select
            value={errorCategory}
            onChange={(e) => setErrorCategory(e.target.value)}
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="incorrect_label">Incorrect Label</MenuItem>
            <MenuItem value="missing_label">Missing Label</MenuItem>
            <MenuItem value="poor_quality">Poor Quality</MenuItem>
            <MenuItem value="does_not_follow_guidelines">Does Not Follow Guidelines</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </FormControl>
        {!isReviewed && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={handleApprove}
              disabled={processing}
            >
              Approve
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CloseIcon />}
              onClick={handleReject}
              disabled={processing || !reviewComments.trim()}
            >
              Reject
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ReviewerTask;
