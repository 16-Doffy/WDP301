import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { Save as SaveIcon, Send as SendIcon, ExpandMore as ExpandMoreIcon, Info as InfoIcon, Image as ImageIcon, Code as CodeIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageAnnotator from '../../components/ImageAnnotator';

const AnnotatorTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [labels, setLabels] = useState({});
  const [labelText, setLabelText] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [annotations, setAnnotations] = useState([]);

  useEffect(() => {
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      const initialLabels = response.data.labels || {};
      setLabels(initialLabels);
      setLabelText(JSON.stringify(initialLabels, null, 2));
      
      // Load annotations from labels if exists
      if (initialLabels.objects && Array.isArray(initialLabels.objects)) {
        const loadedAnnotations = initialLabels.objects.map((obj, idx) => ({
          id: Date.now() + idx,
          label: obj.label,
          bbox: obj.bbox || [0, 0, 10, 10],
          confidence: obj.confidence || 1.0,
          type: 'bbox',
          answer: obj.answer || null,
        }));
        setAnnotations(loadedAnnotations);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage('Không thể tải task. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationsChange = (newAnnotations) => {
    setAnnotations(newAnnotations);
    // Convert annotations to labels format
    const labelsObj = {
      objects: newAnnotations.map(ann => ({
        label: ann.label,
        bbox: ann.bbox,
        confidence: ann.confidence,
        answer: ann.answer || null,
      })),
    };
    setLabels(labelsObj);
    setLabelText(JSON.stringify(labelsObj, null, 2));
    setJsonError('');
  };

  const handleLabelChange = (value) => {
    setLabelText(value);
    try {
      const parsed = JSON.parse(value);
      setLabels(parsed);
      setJsonError('');
    } catch (err) {
      setJsonError('JSON không hợp lệ: ' + err.message);
    }
  };

  const insertExample = (exampleType) => {
    let example = {};
    switch (exampleType) {
      case 'classification':
        example = {
          category: "Car",
          confidence: 0.95
        };
        break;
      case 'detection':
        example = {
          objects: [
            {
              label: "Person",
              bbox: [100, 150, 200, 300],
              confidence: 0.95
            },
            {
              label: "Car",
              bbox: [300, 200, 500, 400],
              confidence: 0.88
            }
          ]
        };
        break;
      case 'segmentation':
        example = {
          regions: [
            {
              label: "Person",
              points: [[100, 150], [200, 150], [200, 300], [100, 300]],
              type: "polygon"
            }
          ]
        };
        break;
      default:
        example = {
          answer: "your_answer_here"
        };
    }
    const exampleText = JSON.stringify(example, null, 2);
    setLabelText(exampleText);
    setLabels(example);
    setJsonError('');
  };

  const handleSave = async () => {
    if (jsonError) {
      setMessage('Vui lòng sửa lỗi JSON trước khi lưu');
      return;
    }
    
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels,
        status: 'in_progress',
      });
      setMessage('Đã lưu thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Lỗi khi lưu: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (jsonError) {
      setMessage('Vui lòng sửa lỗi JSON trước khi nộp bài');
      return;
    }

    // Validate labels
    if (Object.keys(labels).length === 0 || JSON.stringify(labels) === '{}') {
      alert('Bạn chưa nhập labels. Vui lòng thêm labels trước khi nộp bài.');
      return;
    }

    // Validate that labels have objects if it's object detection
    if (labels.objects && Array.isArray(labels.objects) && labels.objects.length === 0) {
      if (!window.confirm('Bạn chưa khoanh vùng đối tượng nào. Bạn có chắc muốn nộp bài không?')) {
        return;
      }
    }

    // Check if project has questions and validate answers
    if (task?.projectId?.questions && Array.isArray(task.projectId.questions) && task.projectId.questions.length > 0) {
      if (labels.objects && Array.isArray(labels.objects)) {
        const missingAnswers = [];
        labels.objects.forEach((obj, idx) => {
          if (!obj.answer || Object.keys(obj.answer).length === 0) {
            missingAnswers.push(`Đối tượng ${idx + 1} (${obj.label || 'chưa có label'})`);
          }
        });
        
        if (missingAnswers.length > 0) {
          alert(`Vui lòng trả lời câu hỏi cho các đối tượng sau:\n${missingAnswers.join('\n')}`);
          return;
        }
      }
    }

    if (window.confirm('Bạn có chắc chắn muốn nộp bài để review? Sau khi nộp, bạn sẽ không thể chỉnh sửa nữa cho đến khi được review.')) {
      setSaving(true);
      try {
        // Save labels first to ensure latest version is saved
        await axios.put(`${API_URL}/api/tasks/${id}/label`, {
          labels,
          status: 'in_progress',
        });
        // Then submit
        await axios.post(`${API_URL}/api/tasks/${id}/submit`);
        alert('Nộp bài thành công! Reviewer sẽ kiểm tra và phản hồi.');
        navigate('/annotator/tasks');
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        setMessage('Lỗi khi nộp bài: ' + errorMessage);
        alert('Lỗi khi nộp bài: ' + errorMessage);
      } finally {
        setSaving(false);
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Labeling Task
      </Typography>
      {task?.status === 'rejected' && task?.reviewComments && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ⚠️ Task đã bị từ chối - Cần chỉnh sửa lại
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Nhận xét từ Reviewer:</strong> {task.reviewComments}
          </Typography>
          {task?.errorCategory && (
            <Chip 
              label={`Loại lỗi: ${task.errorCategory}`} 
              size="small" 
              color="error" 
              sx={{ mt: 1 }}
            />
          )}
          {task?.reviewerId && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Reviewer: {task.reviewerId?.fullName || task.reviewerId?.username}
              {task?.reviewedAt && ` - ${new Date(task.reviewedAt).toLocaleString()}`}
            </Typography>
          )}
        </Alert>
      )}
      
      {task?.status === 'approved' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ✅ Task đã được phê duyệt!
          </Typography>
          {task?.reviewComments && (
            <Typography variant="body2" gutterBottom>
              <strong>Nhận xét từ Reviewer:</strong> {task.reviewComments}
            </Typography>
          )}
          {task?.reviewerId && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Reviewer: {task.reviewerId?.fullName || task.reviewerId?.username}
              {task?.reviewedAt && ` - ${new Date(task.reviewedAt).toLocaleString()}`}
            </Typography>
          )}
        </Alert>
      )}
      <Paper sx={{ p: 3, mt: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Project: {task?.projectId?.name}
          </Typography>
          <Chip 
            label={task?.status === 'assigned' ? 'Đã phân công' : 
                   task?.status === 'in_progress' ? 'Đang làm' :
                   task?.status === 'submitted' ? 'Đã nộp' :
                   task?.status === 'approved' ? 'Đã duyệt' :
                   task?.status === 'rejected' ? 'Bị từ chối' : task?.status}
            color={task?.status === 'approved' ? 'success' :
                   task?.status === 'rejected' ? 'error' :
                   task?.status === 'submitted' ? 'warning' : 'default'}
            sx={{ mb: 2 }}
          />
          <Divider sx={{ my: 2 }} />
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon color="primary" />
                <Typography variant="subtitle1">Hướng dẫn gán nhãn</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {task?.projectId?.guidelines || 'Không có hướng dẫn'}
              </Typography>
              {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Bộ nhãn có sẵn:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {task.projectId.labelSet.map((label, idx) => (
                      <Chip 
                        key={idx}
                        label={label.name}
                        size="small"
                        sx={{ bgcolor: label.color || '#1976d2', color: 'white' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            File: {task?.dataItem?.filename}
          </Typography>
          
          {task?.dataItem?.mimeType?.startsWith('image/') ? (
            <Box sx={{ mt: 2 }}>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                <Tab icon={<ImageIcon />} label="Annotation Tool (Kéo chuột để khoanh vùng)" />
                <Tab icon={<CodeIcon />} label="JSON Editor" />
              </Tabs>
              
              {tabValue === 0 ? (
                <ImageAnnotator
                  imageUrl={`${API_URL}/${task.dataItem.path}`}
                  labelSet={task?.projectId?.labelSet || []}
                  questions={task?.projectId?.questions || []}
                  onAnnotationsChange={handleAnnotationsChange}
                  initialAnnotations={annotations}
                />
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button size="small" onClick={() => insertExample('classification')}>
                      Ví dụ: Classification
                    </Button>
                    <Button size="small" onClick={() => insertExample('detection')}>
                      Ví dụ: Detection
                    </Button>
                    <Button size="small" onClick={() => insertExample('segmentation')}>
                      Ví dụ: Segmentation
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={15}
                    label="Labels (JSON format)"
                    value={labelText}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    margin="normal"
                    error={!!jsonError}
                    helperText={jsonError || 'Chỉnh sửa JSON trực tiếp hoặc quay lại tab Annotation Tool để click vào ảnh'}
                    sx={{ fontFamily: 'monospace' }}
                  />
                  {jsonError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {jsonError}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button size="small" onClick={() => insertExample('classification')}>
                  Ví dụ: Classification
                </Button>
                <Button size="small" onClick={() => insertExample('detection')}>
                  Ví dụ: Detection
                </Button>
                <Button size="small" onClick={() => insertExample('segmentation')}>
                  Ví dụ: Segmentation
                </Button>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={12}
                label="Nhập labels theo định dạng JSON"
                value={labelText}
                onChange={(e) => handleLabelChange(e.target.value)}
                margin="normal"
                error={!!jsonError}
                helperText={jsonError || 'Nhập labels theo định dạng JSON. Click vào các nút ví dụ để xem mẫu.'}
                sx={{ fontFamily: 'monospace' }}
              />
              {jsonError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {jsonError}
                </Alert>
              )}
            </Box>
          )}
        </Box>
        {!task?.dataItem?.mimeType?.startsWith('image/') && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">
                Labels (JSON format) *
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => insertExample('classification')}>
                  Ví dụ: Classification
                </Button>
                <Button size="small" onClick={() => insertExample('detection')}>
                  Ví dụ: Detection
                </Button>
                <Button size="small" onClick={() => insertExample('segmentation')}>
                  Ví dụ: Segmentation
                </Button>
              </Box>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={12}
              label="Nhập labels theo định dạng JSON"
              value={labelText}
              onChange={(e) => handleLabelChange(e.target.value)}
              margin="normal"
              error={!!jsonError}
              helperText={jsonError || 'Nhập labels theo định dạng JSON. Click vào các nút ví dụ để xem mẫu.'}
              sx={{ fontFamily: 'monospace' }}
            />
            {jsonError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {jsonError}
              </Alert>
            )}
          </Box>
        )}
        {message && (
          <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || jsonError || task?.status === 'submitted' || task?.status === 'approved'}
            >
              Lưu tạm
            </Button>
            <Button
              variant="contained"
              color={task?.status === 'rejected' ? 'warning' : 'success'}
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={saving || jsonError || task?.status === 'submitted' || task?.status === 'approved'}
            >
              {task?.status === 'rejected' ? 'Nộp lại để Review' : 'Nộp bài để Review'}
            </Button>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
            * Lưu tạm để tiếp tục chỉnh sửa sau. Nộp bài khi đã hoàn thành.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default AnnotatorTask;
