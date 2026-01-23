import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageAnnotator from '../../components/ImageAnnotator';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

const AnnotatorTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [batchTasks, setBatchTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [annotations, setAnnotations] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [rightTab, setRightTab] = useState('labels');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchTask();
  }, [id]);

  // Auto-refresh task every 5 seconds to check for status updates from reviewer
  useEffect(() => {
    if (!task || task.status !== 'submitted') return;
    
    const interval = setInterval(() => {
      fetchTask();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [id, task?.status]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: Math.round(e.clientX - rect.left),
          y: Math.round(e.clientY - rect.top)
        });
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
      return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      const initialLabels = response.data.labels || {};
      setLabels(initialLabels);
      
      // Fetch batch tasks (tasks from same dataset)
      if (response.data.datasetId) {
        const batchResponse = await axios.get(`${API_URL}/api/tasks/my-tasks`, {
          params: { datasetId: response.data.datasetId._id || response.data.datasetId }
        });
        const batchTasksList = batchResponse.data || [];
        setBatchTasks(batchTasksList);
        const currentIdx = batchTasksList.findIndex(t => t._id === id);
        setCurrentTaskIndex(currentIdx >= 0 ? currentIdx : 0);
      }
      
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
        
        // Calculate progress
        const projectData = response.data?.projectId;
        if (projectData?.questions && projectData.questions.length > 0) {
          const totalRequired = projectData.questions.length;
          const completed = loadedAnnotations.filter(a => a.answer).length;
          setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
        } else {
          setProgress(loadedAnnotations.length > 0 ? 50 : 0);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage(`Lỗi: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationsChange = useCallback((newAnnotations) => {
    setAnnotations(newAnnotations);
    const labelsObj = {
      objects: newAnnotations.map(ann => ({
        label: ann.label,
        bbox: ann.bbox,
        confidence: ann.confidence,
        answer: ann.answer || null,
      })),
    };
    setLabels(labelsObj);
    
    // Update progress
    if (task?.projectId?.questions) {
      const totalRequired = task.projectId.questions.length || 0;
      const completed = newAnnotations.filter(a => a.answer).length;
      setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
    } else {
      setProgress(newAnnotations.length > 0 ? 50 : 0);
    }
  }, [task]);

  const handleSave = useCallback(async () => {
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
  }, [id, labels]);

  const handleSubmit = useCallback(() => {
    if (Object.keys(labels).length === 0 || (labels.objects && labels.objects.length === 0)) {
      alert('Bạn chưa khoanh vùng đối tượng nào. Vui lòng thêm annotations trước khi nộp bài.');
      return;
    }

    if (!task?.reviewers || task.reviewers.length === 0) {
      alert('Task chưa được gán Reviewer. Liên hệ Manager để gán Reviewer trước khi nộp.');
      return;
    }

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

    setShowSubmitConfirm(true);
  }, [labels, task]);

  const handleConfirmSubmit = useCallback(async () => {
    setShowSubmitConfirm(false);
    if (task?.status === 'submitted' || task?.status === 'approved') {
      alert('Task đã được nộp. Vui lòng chờ reviewer đánh giá.');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels,
        status: 'in_progress',
      });
      await axios.post(`${API_URL}/api/tasks/${id}/submit`);
      alert('Nộp bài thành công! Reviewer sẽ kiểm tra và phản hồi.');
      setTask((prev) => (prev ? { ...prev, status: 'submitted' } : prev));
      
      // Navigate to next task in batch or back to dashboard
      if (currentTaskIndex < batchTasks.length - 1) {
        navigate(`/annotator/tasks/${batchTasks[currentTaskIndex + 1]._id}`);
      } else {
        navigate('/annotator/tasks');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setMessage('Lỗi khi nộp bài: ' + errorMessage);
      alert('Lỗi khi nộp bài: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  }, [id, labels, currentTaskIndex, batchTasks, navigate, task?.status]);

  const navigateToTask = (taskId) => {
    navigate(`/annotator/tasks/${taskId}`);
  };

  const navigateToPrevious = () => {
    if (currentTaskIndex > 0) {
      navigateToTask(batchTasks[currentTaskIndex - 1]._id);
    }
  };

  const navigateToNext = () => {
    if (currentTaskIndex < batchTasks.length - 1) {
      navigateToTask(batchTasks[currentTaskIndex + 1]._id);
    }
  };

  // Keyboard shortcuts - MUST be before any conditional returns
  useEffect(() => {
    if (loading) return; // Don't set up shortcuts while loading
    
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && task?.status !== 'submitted' && task?.status !== 'approved') {
          handleSave();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!saving && task?.status !== 'submitted' && task?.status !== 'approved') {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, saving, task?.status, handleSave, handleSubmit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const batchProgress = batchTasks.length > 0 
    ? ((currentTaskIndex + 1) / batchTasks.length) * 100 
    : 0;

  const getStatusBadge = () => {
    if (!task) return null;
    const status = task.status;
    if (status === 'approved') {
      return (
        <div className="px-4 py-2 bg-green-100 border-2 border-green-400 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-800 font-bold">✓ APPROVED</span>
            {task.reviewedAt && (
              <span className="text-green-600 text-sm">
                by {task.reviewerId?.fullName || task.reviewerId?.username || 'Reviewer'} on {new Date(task.reviewedAt).toLocaleString()}
              </span>
            )}
          </div>
          {task.reviewComments && (
            <p className="text-green-700 text-sm mt-2 italic">"{task.reviewComments}"</p>
          )}
        </div>
      );
    }
    if (status === 'rejected') {
      return (
        <div className="px-4 py-2 bg-red-100 border-2 border-red-400 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-800 font-bold">✗ REJECTED</span>
            {task.reviewedAt && (
              <span className="text-red-600 text-sm">
                by {task.reviewerId?.fullName || task.reviewerId?.username || 'Reviewer'} on {new Date(task.reviewedAt).toLocaleString()}
              </span>
            )}
          </div>
          {task.reviewComments && (
            <>
              <p className="text-red-700 text-sm mt-2 font-semibold">Reviewer Comments:</p>
              <p className="text-red-700 text-sm mt-1 italic">"{task.reviewComments}"</p>
            </>
          )}
        </div>
      );
    }
    if (status === 'submitted') {
      return (
        <div className="px-4 py-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
          <span className="text-yellow-800 font-bold">⏳ PENDING REVIEW</span>
          <span className="text-yellow-600 text-sm ml-2">Waiting for reviewer...</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">

      {/* Status Banner */}
      {getStatusBadge() && (
        <div className="px-6 pt-4">
          {getStatusBadge()}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div 
          className="flex-1 flex flex-col overflow-hidden bg-gray-100"
          ref={canvasRef}
        >
          {/* Image Annotation Canvas */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6 flex items-center justify-center">
              {task?.dataItem?.mimeType?.startsWith('image/') ? (
              <div className="bg-white rounded-lg shadow-lg p-4 max-w-full">
                <ImageAnnotator
                  imageUrl={`${API_URL}/${task.dataItem.path}`}
                  labelSet={task?.projectId?.labelSet || []}
                  questions={task?.projectId?.questions || []}
                  onAnnotationsChange={handleAnnotationsChange}
                  initialAnnotations={annotations}
                  onSubmit={handleSubmit}
                  readOnly={task?.status === 'submitted' || task?.status === 'approved'}
                />
              </div>
              ) : (
              <div className="text-center py-12 text-gray-500">
                File không phải hình ảnh. Vui lòng sử dụng JSON Editor.
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar (Collapsible) */}
        <div 
          className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'w-0' : 'w-80'
          } overflow-hidden`}
        >
          {!sidebarCollapsed && (
            <>
              {/* Sidebar Header */}
              <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Properties</h3>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  →
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setRightTab('labels')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    rightTab === 'labels'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Labels
                </button>
                <button
                  onClick={() => setRightTab('instructions')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    rightTab === 'instructions'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Guide
                </button>
                <button
                  onClick={() => setRightTab('issues')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                    rightTab === 'issues'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Issues
                  {task?.reviewNotes && task.reviewNotes.length > 0 && (
                    <span className="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {task.reviewNotes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {rightTab === 'labels' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Label Classes</h3>
                    {task?.projectId?.labelSet && task.projectId.labelSet.length > 0 ? (
                      <div className="space-y-2">
                        {task.projectId.labelSet.map((label, idx) => {
                          const count = annotations.filter(a => a.label === label.name).length;
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                const existingAnn = annotations.find(a => a.label === label.name);
                                if (existingAnn) {
                                  setSelectedAnnotation(existingAnn);
                                }
                              }}
                              className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                                selectedAnnotation?.label === label.name
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: label.color || '#3b82f6' }}
                                ></div>
                                <span className="font-medium text-gray-900 text-sm">{label.name}</span>
                              </div>
                              <span className="text-xs text-gray-600">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No labels defined</p>
                    )}

                    {/* Attributes for selected annotation */}
                    {selectedAnnotation && task?.projectId?.questions && (
                      <div className="mt-6">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                          Attributes: {selectedAnnotation.label?.toUpperCase()} #{selectedAnnotation.id}
                        </h4>
                        {task.projectId.questions.map((question, qIdx) => (
                          <div key={qIdx} className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {question.question}
                            </label>
                            {question.options ? (
                              <div className="space-y-2">
                                {question.options.map((opt) => (
                                  <label key={opt.key} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`question-${qIdx}`}
                                      value={opt.key}
                                      checked={selectedAnnotation.answer?.[qIdx] === opt.key}
                                      onChange={() => {
                                        const updated = annotations.map(a =>
                                          a.id === selectedAnnotation.id
                                            ? { ...a, answer: { ...a.answer, [qIdx]: opt.key } }
                                            : a
                                        );
                                        setAnnotations(updated);
                                      }}
                                      className="text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">{opt.value}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <input
                                type="text"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedAnnotation.answer?.[qIdx] || ''}
                                onChange={(e) => {
                                  const updated = annotations.map(a =>
                                    a.id === selectedAnnotation.id
                                      ? { ...a, answer: { ...a.answer, [qIdx]: e.target.value } }
                                      : a
                                  );
                                  setAnnotations(updated);
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review Feedback - Show for both approved and rejected */}
                    {(task?.status === 'approved' || task?.status === 'rejected') && (
                      <div className="mt-6 space-y-4">
                        {task?.reviewComments && (
                          <div className={`p-4 border-2 rounded-lg ${
                            task.status === 'approved' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <p className={`text-sm font-semibold mb-2 ${
                              task.status === 'approved' ? 'text-green-800' : 'text-red-800'
                            }`}>
                              Reviewer Feedback:
                            </p>
                            <p className={`text-sm italic ${
                              task.status === 'approved' ? 'text-green-700' : 'text-red-700'
                            }`}>
                              "{task.reviewComments}"
                            </p>
                            {task.reviewedAt && (
                              <p className={`text-xs mt-2 ${
                                task.status === 'approved' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                Reviewed on: {new Date(task.reviewedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
        )}

                {rightTab === 'instructions' && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Project Information</h3>
                    <div className="space-y-4">
                      {/* Project Name */}
                      {task?.projectId?.name && (
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Project Name</h4>
                          <p className="text-gray-700 text-sm">{task.projectId.name}</p>
                        </div>
                      )}
                      
                      {/* Project Description */}
                      {task?.projectId?.description && (
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Description</h4>
                          <p className="text-gray-600 whitespace-pre-wrap text-sm">
                            {task.projectId.description}
                          </p>
                        </div>
                      )}
                      
                      {/* Guidelines */}
                      {task?.projectId?.guidelines && (
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Guidelines</h4>
                          <p className="text-gray-600 whitespace-pre-wrap text-sm">
                            {task.projectId.guidelines}
                          </p>
                        </div>
                      )}
                      
                      {!task?.projectId?.name && !task?.projectId?.description && !task?.projectId?.guidelines && (
                        <p className="text-sm text-gray-500">No project information provided.</p>
                      )}
                    </div>
                  </div>
                )}

                {rightTab === 'issues' && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Issues</h3>
                    {task?.reviewNotes && task.reviewNotes.length > 0 ? (
                      <div className="space-y-3">
                        {task.reviewNotes.map((note, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700">{note.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No issues reported</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 w-8 h-16 bg-gray-100 hover:bg-gray-200 border-l border-gray-200 rounded-l-lg flex items-center justify-center text-gray-600"
            >
              ←
            </button>
          )}
        </div>
      </div>


      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Xác nhận nộp bài</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Bạn có chắc chắn muốn nộp bài để review?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Sau khi nộp, bạn sẽ không thể chỉnh sửa nữa cho đến khi được review.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubmitConfirm(false)} color="error">
            Hủy
          </Button>
          <Button onClick={handleConfirmSubmit} variant="contained" color="primary" disabled={saving}>
            {saving ? 'Đang nộp...' : 'Xác nhận nộp'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AnnotatorTask;
