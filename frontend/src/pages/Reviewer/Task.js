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
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
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
            <Box sx={{ mt: 2, position: 'relative', display: 'inline-block' }}>
              <img
                src={`${API_URL}/${task.dataItem.path}`}
                alt="Data item"
                style={{ maxWidth: '100%', maxHeight: '600px', display: 'block' }}
                id="review-image"
              />
              {/* Render bounding boxes on image */}
              {task?.labels?.objects && Array.isArray(task.labels.objects) && task.labels.objects.map((obj, idx) => {
                if (!obj.bbox || !Array.isArray(obj.bbox) || obj.bbox.length < 4) return null;
                const [x1, y1, x2, y2] = obj.bbox;
                const left = Math.min(x1, x2);
                const top = Math.min(y1, y2);
                const width = Math.abs(x2 - x1);
                const height = Math.abs(y2 - y1);
                
                const labelInfo = task?.projectId?.labelSet?.find(l => (l.name || l) === obj.label);
                const borderColor = labelInfo?.color || '#1976d2';
                
                return (
                  <Box
                    key={idx}
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      border: `2px solid ${borderColor}`,
                      backgroundColor: `${borderColor}20`,
                      pointerEvents: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Chip
                      label={obj.label || `Object ${idx + 1}`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: '-20px',
                        left: 0,
                        bgcolor: borderColor,
                        color: 'white',
                        fontSize: '10px',
                        height: '18px',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
        
        {/* Display Labels and Answers in a structured way */}
        {task?.labels?.objects && Array.isArray(task.labels.objects) && task.labels.objects.length > 0 ? (
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Các đối tượng đã được khoanh vùng ({task.labels.objects.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {task.labels.objects.map((obj, idx) => {
                const labelInfo = task?.projectId?.labelSet?.find(l => (l.name || l) === obj.label);
                const borderColor = labelInfo?.color || '#1976d2';
                
                return (
                  <Grid item xs={12} md={6} key={idx}>
                    <Card variant="outlined" sx={{ borderLeft: `4px solid ${borderColor}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Chip
                            label={`Đối tượng ${idx + 1}`}
                            size="small"
                            sx={{ bgcolor: borderColor, color: 'white' }}
                          />
                          <Chip
                            label={obj.label || 'Chưa có label'}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: borderColor, color: borderColor }}
                          />
                        </Box>
                        
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          <strong>Vị trí:</strong> [{Math.round(obj.bbox?.[0] || 0)}%, {Math.round(obj.bbox?.[1] || 0)}%] 
                          đến [{Math.round(obj.bbox?.[2] || 0)}%, {Math.round(obj.bbox?.[3] || 0)}%]
                        </Typography>
                        
                        {/* Display Answers if project has questions */}
                        {task?.projectId?.questions && Array.isArray(task.projectId.questions) && task.projectId.questions.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                              Đáp án của Annotator:
                            </Typography>
                            {task.projectId.questions.map((question, qIdx) => {
                              const answerKey = obj.answer?.[qIdx] || obj.answer?.[qIdx.toString()];
                              const selectedOption = question.options?.find(opt => opt.key === answerKey);
                              
                              return (
                                <Box key={qIdx} sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                    {question.question || `Câu hỏi ${qIdx + 1}`}
                                  </Typography>
                                  {answerKey ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Chip
                                        label={`${answerKey}. ${selectedOption?.value || 'Đáp án ' + answerKey}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                      />
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="error">
                                      ⚠️ Chưa có đáp án
                                    </Typography>
                                  )}
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Task này chưa có labels nào được gán. Annotator cần khoanh vùng và gán nhãn trước khi submit.
          </Alert>
        )}
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
