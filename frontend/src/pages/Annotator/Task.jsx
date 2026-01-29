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
  const [textContent, setTextContent] = useState('');
  const [annotationNote, setAnnotationNote] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [textSpans, setTextSpans] = useState([]); // [{ start, end, label, text, note, id }]
  const [selectedTextRange, setSelectedTextRange] = useState(null); // { start, end, text }
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const textContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const canvasRef = useRef(null);

  const getTaskKind = useCallback((t) => {
    const mt = t?.dataItem?.mimeType || '';
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt.startsWith('text/')) return 'text';
    // common text-ish mime/types
    if (['application/json', 'application/xml', 'text/csv'].includes(mt)) return 'text';
    return 'other';
  }, []);

  const renderTextWithSpans = () => {
    if (!textContent) return 'Không có nội dung hiển thị.';
    if (textSpans.length === 0) return textContent;

    // Sort spans by start position
    const sortedSpans = [...textSpans].sort((a, b) => a.start - b.start);
    
    const parts = [];
    let lastIndex = 0;

    sortedSpans.forEach((span) => {
      // Add text before this span
      if (span.start > lastIndex) {
        parts.push({
          text: textContent.substring(lastIndex, span.start),
          isSpan: false
        });
      }

      // Add the span with highlight
      const labelInfo = task?.projectId?.labelSet?.find(l => l.name === span.label);
      parts.push({
        text: textContent.substring(span.start, span.end),
        isSpan: true,
        spanId: span.id,
        label: span.label,
        color: labelInfo?.color || '#3b82f6'
      });

      lastIndex = span.end;
    });

    // Add remaining text after last span
    if (lastIndex < textContent.length) {
      parts.push({
        text: textContent.substring(lastIndex),
        isSpan: false
      });
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.isSpan) {
            return (
              <mark
                key={`span-${part.spanId}-${idx}`}
                className="px-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: part.color + '40', // 40 = 25% opacity
                  color: 'inherit',
                  borderBottom: `2px solid ${part.color}`
                }}
                title={`Nhãn: ${part.label}`}
              >
                {part.text}
              </mark>
            );
          }
          return <span key={`text-${idx}`}>{part.text}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    // Reset annotations when task ID changes
    setAnnotations([]);
    setLabels({});
    setSelectedAnnotation(null);
      setTextContent('');
      setAnnotationNote('');
      setSelectedLabel('');
      setTextSpans([]);
      setSelectedTextRange(null);
      setShowLabelDropdown(false);
      setLoading(true);
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
      // Reset annotations first to clear previous task's annotations
      setAnnotations([]);
      setLabels({});
      setSelectedAnnotation(null);
      setTextContent('');
      setAnnotationNote('');
      setSelectedLabel('');
      setTextSpans([]);
      setSelectedTextRange(null);
      setShowLabelDropdown(false);
      
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(response.data);
      const initialLabels = response.data.labels || {};
      setLabels(initialLabels);
      const kind = getTaskKind(response.data);

      if (kind === 'text') {
        try {
          const textRes = await axios.get(`${API_URL}/${response.data.dataItem.path}`, {
            responseType: 'text',
          });
          setTextContent(textRes.data || '');
        } catch (err) {
          setTextContent('Không thể tải nội dung file văn bản.');
        }
        // Load text spans if they exist
        if (initialLabels?.spans && Array.isArray(initialLabels.spans)) {
          setTextSpans(initialLabels.spans.map((span, idx) => ({
            ...span,
            id: span.id || `span-${idx}`
          })));
        }
        setAnnotationNote(initialLabels?.note || '');
        setSelectedLabel(initialLabels?.label || '');
      }

      if (kind === 'audio') {
        setAnnotationNote(initialLabels?.note || '');
        setSelectedLabel(initialLabels?.label || '');
      }
      
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
      
      // Load annotations from new task
      if (initialLabels.objects && Array.isArray(initialLabels.objects) && initialLabels.objects.length > 0) {
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
      } else {
        // No annotations in this task, reset progress
        setAnnotations([]);
        setProgress(0);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage(`Lỗi: ${error.response?.data?.message || error.message}`);
      // Ensure annotations are cleared even on error
      setAnnotations([]);
      setLabels({});
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
      const kind = getTaskKind(task);
      let labelsPayload = labels;

      if (kind === 'image') {
        labelsPayload = labels;
      } else if (kind === 'text') {
        labelsPayload = {
          spans: textSpans.map(({ id, ...rest }) => rest), // Remove id before saving
          note: annotationNote?.trim() || '',
        };
      } else {
        labelsPayload = {
          note: annotationNote?.trim() || '',
          label: selectedLabel || '',
        };
      }

      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels: labelsPayload,
        status: 'in_progress',
      });
      setMessage('Đã lưu thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Lỗi khi lưu: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  }, [id, labels, annotationNote, selectedLabel, textSpans, task]);

  const handleSubmit = useCallback(() => {
    const kind = getTaskKind(task);
    if (kind === 'image') {
      if (Object.keys(labels).length === 0 || (labels.objects && labels.objects.length === 0)) {
        alert('Bạn chưa khoanh vùng đối tượng nào. Vui lòng thêm annotations trước khi nộp bài.');
        return;
      }
    } else if (kind === 'text') {
      if (!textSpans || textSpans.length === 0) {
        alert('Vui lòng bôi đen và gán nhãn cho ít nhất một phần văn bản trước khi nộp.');
        return;
      }
    } else {
      if (!selectedLabel) {
        alert('Vui lòng chọn nhãn cho đoạn audio trước khi nộp.');
        return;
      }
      if (!annotationNote.trim()) {
        alert('Vui lòng nhập ghi chú/nhãn trước khi nộp.');
        return;
      }
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
  }, [labels, task, textSpans, selectedLabel, annotationNote]);

  const handleConfirmSubmit = useCallback(async () => {
    setShowSubmitConfirm(false);
    if (task?.status === 'submitted' || task?.status === 'approved') {
      alert('Task đã được nộp. Vui lòng chờ reviewer đánh giá.');
      return;
    }

    // Check deadline if project has one
    if (task?.projectId?.deadline) {
      const deadline = new Date(task.projectId.deadline);
      const now = new Date();
      if (now > deadline) {
        alert(`Không thể nộp task. Deadline của project đã hết hạn (${deadline.toLocaleString('vi-VN')}). Vui lòng liên hệ Manager.`);
        return;
      }
    }

    setSaving(true);
    try {
      const kind = getTaskKind(task);
      let labelsPayload = labels;

      if (kind === 'image') {
        labelsPayload = labels;
      } else if (kind === 'text') {
        labelsPayload = {
          spans: textSpans.map(({ id, ...rest }) => rest), // Remove id before saving
          note: annotationNote?.trim() || '',
        };
      } else {
        labelsPayload = {
          note: annotationNote?.trim() || '',
          label: selectedLabel || '',
        };
      }

      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels: labelsPayload,
        status: task?.status === 'rejected' ? 'in_progress' : 'in_progress',
      });
      await axios.post(`${API_URL}/api/tasks/${id}/submit`);
      const message = task?.status === 'rejected' 
        ? 'Nộp lại bài thành công! Reviewer sẽ kiểm tra và phản hồi.'
        : 'Nộp bài thành công! Reviewer sẽ kiểm tra và phản hồi.';
      alert(message);
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
  }, [id, labels, currentTaskIndex, batchTasks, navigate, task, textSpans, annotationNote, selectedLabel]);

  const navigateToTask = async (taskId, saveCurrent = true) => {
    // Auto-save current task before navigating
    // Allow saving rejected tasks (they can be edited and resubmitted)
    if (saveCurrent && task && task._id !== taskId && task.status !== 'submitted' && task.status !== 'approved') {
      try {
        await axios.put(`${API_URL}/api/tasks/${task._id}/label`, {
          labels,
          status: 'in_progress',
        });
      } catch (error) {
        console.error('Error auto-saving before navigation:', error);
        // Continue navigation even if save fails
      }
    }
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

  const navigateToTaskByIndex = (index) => {
    if (index >= 0 && index < batchTasks.length) {
      navigateToTask(batchTasks[index]._id);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!showLabelDropdown) return;
      const inText = !!textContainerRef.current?.contains(e.target);
      const inDropdown = !!dropdownRef.current?.contains(e.target);
      if (!inText && !inDropdown) {
        setShowLabelDropdown(false);
        setSelectedTextRange(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLabelDropdown]);

  // Keyboard shortcuts - MUST be before any conditional returns
  useEffect(() => {
    if (loading) return; // Don't set up shortcuts while loading
    
    const handleKeyDown = (e) => {
      // Prevent shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

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
      // Arrow keys for navigation (always allow navigation to view tasks)
      if (e.key === 'ArrowLeft' && currentTaskIndex > 0) {
        e.preventDefault();
        navigateToPrevious();
      }
      if (e.key === 'ArrowRight' && currentTaskIndex < batchTasks.length - 1) {
        e.preventDefault();
        navigateToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, saving, task?.status, handleSave, handleSubmit, currentTaskIndex, batchTasks.length, navigateToPrevious, navigateToNext]);

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
          {/* Navigation Bar */}
          {batchTasks.length > 1 && (
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={navigateToPrevious}
                  disabled={currentTaskIndex === 0}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    currentTaskIndex === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <span>←</span> Previous
                </button>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">Ảnh {currentTaskIndex + 1} / {batchTasks.length}</span>
                  {task?.dataItem?.filename && (
                    <span className="ml-2 text-gray-500">({task.dataItem.filename})</span>
                  )}
                </div>
                <button
                  onClick={navigateToNext}
                  disabled={currentTaskIndex >= batchTasks.length - 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    currentTaskIndex >= batchTasks.length - 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Next <span>→</span>
                </button>
              </div>
              
              {/* Task Thumbnail Grid */}
              {batchTasks.length > 1 && batchTasks.length <= 20 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 mr-2">Chọn ảnh:</span>
                  <div className="flex gap-1 overflow-x-auto max-w-md">
                    {batchTasks.map((batchTask, idx) => {
                      const isCurrent = batchTask._id === id;
                      const isSubmitted = batchTask.status === 'submitted' || batchTask.status === 'approved';
                      const isRejected = batchTask.status === 'rejected';
                      return (
                        <button
                          key={batchTask._id}
                          onClick={() => navigateToTaskByIndex(idx)}
                          className={`w-12 h-12 rounded border-2 flex-shrink-0 overflow-hidden transition-all cursor-pointer ${
                            isCurrent
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : isSubmitted
                              ? 'border-green-300 hover:border-green-400'
                              : isRejected
                              ? 'border-red-300 hover:border-red-400'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          title={`Task ${idx + 1}: ${batchTask.dataItem?.filename || 'Image'} ${isSubmitted ? '(Approved)' : isRejected ? '(Rejected)' : ''}`}
                        >
                          {batchTask.dataItem?.mimeType?.startsWith('image/') ? (
                            <img
                              src={`${API_URL}/${batchTask.dataItem.path}`}
                              alt={`Task ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs text-gray-400">${idx + 1}</div>`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                              {idx + 1}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Annotation Canvas */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6 flex items-center justify-center">
              {getTaskKind(task) === 'image' ? (
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
              ) : getTaskKind(task) === 'text' ? (
                <div className="bg-white rounded-lg shadow-lg p-4 max-w-4xl w-full space-y-4 relative">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">Text File</p>
                      <p className="text-base font-semibold text-gray-800">
                        {task?.dataItem?.filename || 'Unnamed file'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{task?.dataItem?.mimeType}</span>
                  </div>
                  
                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                    <strong>Hướng dẫn:</strong> Bôi đen phần văn bản bạn muốn gán nhãn, sau đó chọn nhãn từ dropdown.
                  </div>

                  {/* Text Content with Span Highlighting */}
                  <div className="relative">
                    <div
                      ref={textContainerRef}
                      className="border rounded-md bg-gray-50 p-4 max-h-96 overflow-auto text-sm text-gray-800 whitespace-pre-wrap relative select-text"
                      onMouseUp={(e) => {
                        if (task?.status === 'submitted' || task?.status === 'approved') return;
                        
                        const selection = window.getSelection();
                        if (selection.rangeCount === 0) return;
                        
                        const range = selection.getRangeAt(0);
                        const selectedText = selection.toString().trim();
                        
                        if (selectedText.length === 0) {
                          setSelectedTextRange(null);
                          setShowLabelDropdown(false);
                          return;
                        }
                        
                        // Get start and end positions relative to textContent
                        // We need to calculate based on the actual text content, ignoring HTML tags
                        if (!textContainerRef.current) return;
                        
                        // Clone the container and get plain text version
                        const clone = textContainerRef.current.cloneNode(true);
                        const plainText = clone.textContent || clone.innerText || '';
                        
                        // Get the selected text from the original container
                        const selectedPlainText = selection.toString();
                        
                        // Find the start position by getting text before selection
                        const preRange = document.createRange();
                        preRange.selectNodeContents(textContainerRef.current);
                        preRange.setEnd(range.startContainer, range.startOffset);
                        const start = preRange.toString().length;
                        
                        // End position
                        const end = start + selectedPlainText.length;
                        
                        // Check if this range overlaps with existing spans
                        const overlaps = textSpans.some(span => 
                          (start >= span.start && start < span.end) ||
                          (end > span.start && end <= span.end) ||
                          (start <= span.start && end >= span.end)
                        );
                        
                        if (overlaps) {
                          alert('Phần văn bản này đã được gán nhãn. Vui lòng chọn phần khác hoặc xóa nhãn cũ trước.');
                          selection.removeAllRanges();
                          return;
                        }
                        
                        setSelectedTextRange({ start, end, text: selectedText });
                        
                        // Position dropdown near selection
                        const rect = range.getBoundingClientRect();
                        const containerRect = textContainerRef.current.getBoundingClientRect();
                        setDropdownPosition({
                          x: rect.left - containerRect.left + rect.width / 2,
                          y: rect.top - containerRect.top - 10
                        });
                        setShowLabelDropdown(true);
                      }}
                      style={{ userSelect: 'text' }}
                    >
                      {renderTextWithSpans()}
                    </div>
                    
                    {/* Label Dropdown */}
                    {showLabelDropdown && selectedTextRange && task?.projectId?.labelSet?.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-[200px]"
                        style={{
                          left: `${dropdownPosition.x}px`,
                          top: `${dropdownPosition.y}px`,
                          transform: 'translateX(-50%) translateY(-100%)'
                        }}
                      >
                        <div className="text-xs font-semibold text-gray-700 mb-2">Chọn nhãn:</div>
                        <div className="space-y-1">
                          {task.projectId.labelSet.map((lbl) => (
                            <button
                              key={lbl.name}
                              onClick={() => {
                                const newSpan = {
                                  id: `span-${Date.now()}`,
                                  start: selectedTextRange.start,
                                  end: selectedTextRange.end,
                                  text: selectedTextRange.text,
                                  label: lbl.name,
                                  note: ''
                                };
                                setTextSpans([...textSpans, newSpan].sort((a, b) => a.start - b.start));
                                setSelectedTextRange(null);
                                setShowLabelDropdown(false);
                                window.getSelection().removeAllRanges();
                              }}
                              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                              style={{ borderLeftColor: lbl.color || '#3b82f6', borderLeftWidth: '3px' }}
                            >
                              {lbl.name}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTextRange(null);
                            setShowLabelDropdown(false);
                            window.getSelection().removeAllRanges();
                          }}
                          className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 text-center"
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Annotated Spans List */}
                  {textSpans.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Các phần đã gán nhãn ({textSpans.length}):
                      </label>
                      <div className="border rounded-md p-3 max-h-48 overflow-auto space-y-2">
                        {textSpans.map((span, idx) => {
                          const labelInfo = task?.projectId?.labelSet?.find(l => l.name === span.label);
                          return (
                            <div
                              key={span.id}
                              className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                            >
                              <div
                                className="w-4 h-4 rounded mt-1 flex-shrink-0"
                                style={{ backgroundColor: labelInfo?.color || '#3b82f6' }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-700">{span.label}</span>
                                  <span className="text-xs text-gray-500">
                                    ({span.start}-{span.end})
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 bg-white p-1 rounded border border-gray-200 truncate">
                                  "{span.text}"
                                </div>
                              </div>
                              {task?.status !== 'submitted' && task?.status !== 'approved' && (
                                <button
                                  onClick={() => {
                                    setTextSpans(textSpans.filter(s => s.id !== span.id));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-sm font-bold px-2"
                                  title="Xóa nhãn này"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* General Note */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Ghi chú tổng thể (tùy chọn)
                    </label>
                    <textarea
                      className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Nhập ghi chú tổng thể cho toàn bộ văn bản..."
                      value={annotationNote}
                      onChange={(e) => setAnnotationNote(e.target.value)}
                      disabled={task?.status === 'submitted' || task?.status === 'approved'}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outlined"
                      onClick={handleSave}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Lưu
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Nộp ({textSpans.length} nhãn)
                    </Button>
                  </div>
                </div>
              ) : getTaskKind(task) === 'audio' ? (
                <div className="bg-white rounded-lg shadow-lg p-4 max-w-3xl w-full space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">Audio File</p>
                      <p className="text-base font-semibold text-gray-800">
                        {task?.dataItem?.filename || 'Unnamed audio'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{task?.dataItem?.mimeType}</span>
                  </div>
                  <audio
                    controls
                    className="w-full"
                    src={`${API_URL}/${task?.dataItem?.path}`}
                  />
                  {task?.projectId?.labelSet?.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Chọn nhãn</label>
                      <div className="flex flex-wrap gap-2">
                        {task.projectId.labelSet.map((lbl) => (
                          <label
                            key={lbl.name}
                            className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${
                              selectedLabel === lbl.name
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                            }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              value={lbl.name}
                              checked={selectedLabel === lbl.name}
                              onChange={() => setSelectedLabel(lbl.name)}
                              disabled={task?.status === 'submitted' || task?.status === 'approved'}
                            />
                            {lbl.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Ghi chú / Nhãn cho audio
                    </label>
                    <textarea
                      className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Nhập nhận xét hoặc nhãn..."
                      value={annotationNote}
                      onChange={(e) => setAnnotationNote(e.target.value)}
                      disabled={task?.status === 'submitted' || task?.status === 'approved'}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outlined"
                      onClick={handleSave}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Lưu
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Nộp
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Không hỗ trợ loại file này.
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
