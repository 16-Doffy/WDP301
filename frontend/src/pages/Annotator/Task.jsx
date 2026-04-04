import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageAnnotator from '../../components/ImageAnnotator';
import AudioAnnotator from '../../components/AudioAnnotator';
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
  const [showGuidelines, setShowGuidelines] = useState(false);
  const textContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const canvasRef = useRef(null);

  const getTaskKind = useCallback((t) => {
    const mt = (t?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (
      t?.dataItem?.originalName ||
      t?.dataItem?.filename ||
      t?.dataItem?.path ||
      ''
    ).toLowerCase();

    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt.startsWith('text/')) return 'text';

    // Fallback by extension / uncommon mime
    if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
    // Some audio files are uploaded as video/mp4 container
    if (mt === 'video/mp4' && /\.(mp4|m4a)$/i.test(fileName)) return 'audio';

    if (['application/json', 'application/xml', 'text/csv'].includes(mt)) return 'text';
    if (/\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';

    return 'other';
  }, []);

  const buildFileUrl = (dataItem) => {
    if (!dataItem) return '';
    const baseUrl = API_URL.replace(/\/+$/, '');
    const rawPath = dataItem.path || '';
    const cleanPath = rawPath.replace(/^\/+/, '');
    if (cleanPath) {
      if (dataItem.filename && cleanPath.endsWith(dataItem.filename)) {
        return `${baseUrl}/${cleanPath}`;
      }
      return dataItem.filename ? `${baseUrl}/${cleanPath}/${dataItem.filename}` : `${baseUrl}/${cleanPath}`;
    }
    return dataItem.filename ? `${baseUrl}/uploads/datasets/${dataItem.filename}` : '';
  };

  const renderTextWithSpans = () => {
    if (!textContent) return 'Không có nội dung hiển thị.';
    if (textSpans.length === 0) return textContent;

    const sortedSpans = [...textSpans].sort((a, b) => a.start - b.start);

    const parts = [];
    let lastIndex = 0;

    sortedSpans.forEach((span) => {
      if (span.start > lastIndex) {
        parts.push({
          text: textContent.substring(lastIndex, span.start),
          isSpan: false,
        });
      }

      const labelInfo = task?.availableLabels?.find((l) => l.name === span.label);
      parts.push({
        text: textContent.substring(span.start, span.end),
        isSpan: true,
        spanId: span.id,
        label: span.label,
        color: labelInfo?.color || '#3b82f6',
      });

      lastIndex = span.end;
    });

    if (lastIndex < textContent.length) {
      parts.push({
        text: textContent.substring(lastIndex),
        isSpan: false,
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
                  backgroundColor: part.color + '40',
                  color: 'inherit',
                  borderBottom: `2px solid ${part.color}`,
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
    setAnnotations([]);
    setLabels({});
    setSelectedAnnotation(null);
    setTextContent('');
    setAnnotationNote('');
    setSelectedLabel('');
    setTextSpans([]);
    setSelectedTextRange(null);
    setShowLabelDropdown(false);
    setShowGuidelines(false);
    setLoading(true);
    fetchTask();
  }, [id]);

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

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: Math.round(e.clientX - rect.left),
          y: Math.round(e.clientY - rect.top),
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
          const textRes = await axios.get(buildFileUrl(response.data.dataItem), {
            responseType: 'text',
          });
          setTextContent(textRes.data || '');
        } catch (err) {
          setTextContent('Không thể tải nội dung file văn bản.');
        }

        if (initialLabels?.spans && Array.isArray(initialLabels.spans)) {
          setTextSpans(
            initialLabels.spans.map((span, idx) => ({
              ...span,
              id: span.id || `span-${idx}`,
            }))
          );
        }
        setAnnotationNote(initialLabels?.note || '');
        setSelectedLabel(initialLabels?.label || '');
      }

      if (kind === 'audio') {
        setAnnotationNote(initialLabels?.note || '');
        setSelectedLabel(initialLabels?.label || '');
      }

      if (response.data.datasetId) {
        const batchResponse = await axios.get(`${API_URL}/api/tasks/my-tasks`, {
          params: { datasetId: response.data.datasetId._id || response.data.datasetId },
        });
        const batchTasksList = batchResponse.data || [];
        setBatchTasks(batchTasksList);
        const currentIdx = batchTasksList.findIndex((t) => t._id === id);
        setCurrentTaskIndex(currentIdx >= 0 ? currentIdx : 0);
      }

      if (
        initialLabels.objects &&
        Array.isArray(initialLabels.objects) &&
        initialLabels.objects.length > 0
      ) {
        const loadedAnnotations = initialLabels.objects.map((obj, idx) => ({
          id: Date.now() + idx,
          label: obj.label,
          bbox: obj.bbox || [0, 0, 10, 10],
          confidence: obj.confidence || 1.0,
          type: 'bbox',
          answer: obj.answer || null,
        }));
        setAnnotations(loadedAnnotations);

        const projectData = response.data?.projectId;
        if (projectData?.questions && projectData.questions.length > 0) {
          const totalRequired = projectData.questions.length;
          const completed = loadedAnnotations.filter((a) => a.answer).length;
          setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
        } else {
          setProgress(loadedAnnotations.length > 0 ? 50 : 0);
        }
      } else {
        setAnnotations([]);
        setProgress(0);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage(`Lỗi: ${error.response?.data?.message || error.message}`);
      setAnnotations([]);
      setLabels({});
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationsChange = useCallback(
    (newAnnotations) => {
      setAnnotations(newAnnotations);
      const kind = getTaskKind(task);

      let labelsObj = {};
      if (kind === 'image') {
        labelsObj = {
          objects: newAnnotations.map((ann) => ({
            label: ann.label,
            bbox: ann.bbox,
            confidence: ann.confidence,
            answer: ann.answer || null,
          })),
        };
      } else if (kind === 'text') {
        labelsObj = {
          spans: textSpans.map(({ id, ...rest }) => rest),
          note: annotationNote?.trim() || '',
        };
      }

      setLabels(labelsObj);

      if (task?.projectId?.questions) {
        const totalRequired = task.projectId.questions.length || 0;
        const completed = newAnnotations.filter((a) => a.answer).length;
        setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
      } else {
        setProgress(newAnnotations.length > 0 ? 50 : 0);
      }
    },
    [task, annotationNote, textSpans, getTaskKind]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const kind = getTaskKind(task);
      let labelsPayload = labels;

      if (kind === 'image') {
        labelsPayload = labels;
      } else if (kind === 'text') {
        labelsPayload = {
          spans: textSpans.map(({ id, ...rest }) => rest),
          note: annotationNote?.trim() || '',
        };
      } else if (kind === 'audio') {
        labelsPayload = {
          segments: labels.segments || [],
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
  }, [id, labels, annotationNote, selectedLabel, textSpans, task, getTaskKind]);

  const handleCompleteImage = useCallback(async () => {
    if (!task) return;

    if (getTaskKind(task) === 'image' && (!labels.objects || labels.objects.length === 0)) {
      alert('Vui lòng thêm ít nhất một nhãn trước khi hoàn thành.');
      return;
    }

    if (getTaskKind(task) === 'text' && (!textSpans || textSpans.length === 0) && !annotationNote?.trim()) {
      alert('Vui lòng gán ít nhất một nhãn hoặc thêm ghi chú trước khi hoàn thành.');
      return;
    }

    if (getTaskKind(task) === 'audio' && (!labels.segments || labels.segments.length === 0) && !annotationNote?.trim()) {
      alert('Vui lòng gán ít nhất một đoạn nhãn hoặc thêm ghi chú trước khi hoàn thành.');
      return;
    }

    setSaving(true);
    try {
      await handleSave();

      await axios.post(`${API_URL}/api/tasks/${id}/complete`);

      const updatedBatchTasks = batchTasks.map((t) =>
        t._id === id ? { ...t, status: 'completed' } : t
      );
      setBatchTasks(updatedBatchTasks);
      setTask((prev) => (prev ? { ...prev, status: 'completed' } : null));

      const nextTaskIndex = updatedBatchTasks.findIndex(
        (t, index) =>
          index > currentTaskIndex &&
          t.status !== 'completed' &&
          t.status !== 'submitted' &&
          t.status !== 'approved'
      );

      if (nextTaskIndex !== -1) {
        navigate(`/annotator/tasks/${updatedBatchTasks[nextTaskIndex]._id}`);
      } else {
        const firstUncompletedIndex = updatedBatchTasks.findIndex(
          (t) => t.status !== 'completed' && t.status !== 'submitted' && t.status !== 'approved'
        );
        if (firstUncompletedIndex !== -1) {
          navigate(`/annotator/tasks/${updatedBatchTasks[firstUncompletedIndex]._id}`);
        } else {
          alert('Tất cả ảnh trong batch này đã được hoàn thành! Bạn có thể nộp bài ngay bây giờ.');
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      alert('Lỗi khi hoàn thành ảnh: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  }, [task, labels, handleSave, id, batchTasks, currentTaskIndex, navigate, getTaskKind]);

  const handleBatchSubmit = useCallback(async () => {
    if (!task || !task.datasetId) return;

    const allCompleted = batchTasks.every(
      (t) => t.status === 'completed' || t.status === 'submitted' || t.status === 'approved'
    );
    if (!allCompleted) {
      alert('Vui lòng hoàn thành tất cả task trong project trước khi nộp project.');
      return;
    }

    if (
      task?.projectId?.questions &&
      Array.isArray(task.projectId.questions) &&
      task.projectId.questions.length > 0
    ) {
      const kind = getTaskKind(task);
      if (kind === 'image' && labels.objects && Array.isArray(labels.objects)) {
        const missingAnswers = [];
        labels.objects.forEach((obj, idx) => {
          if (!obj.answer || Object.keys(obj.answer).length === 0) {
            missingAnswers.push(`Đối tượng ${idx + 1} (${obj.label || 'chưa có label'})`);
          }
        });
        if (missingAnswers.length > 0) {
          alert(
            `Vui lòng trả lời tất cả câu hỏi cho các đối tượng sau:\n${missingAnswers.join('\n')}`
          );
          return;
        }
      }
    }

    if (!window.confirm('Bạn có chắc muốn nộp toàn bộ batch này cho reviewer không?')) return;

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/tasks/submit-batch`, {
        datasetId: task.datasetId._id || task.datasetId,
      });
      alert('Nộp bài thành công! Đang quay về trang dashboard.');
      navigate('/annotator/tasks');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      alert('Lỗi khi nộp bài: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  }, [task, batchTasks, navigate, labels, getTaskKind]);

  const handleSubmit = useCallback(async () => {
    if (!task) return;
    if (task.status === 'submitted' || task.status === 'approved') return;

    if (task.status !== 'completed') {
      try {
        await handleSave();
        await axios.post(`${API_URL}/api/tasks/${task._id}/complete`);
        setTask((prev) => (prev ? { ...prev, status: 'completed' } : prev));
        setBatchTasks((list) =>
          list.map((t) => (t._id === task._id ? { ...t, status: 'completed' } : t))
        );
      } catch (err) {
        console.error('Error completing task before submit:', err);
      }
    }

    setShowSubmitConfirm(true);
  }, [task, handleSave]);

  const handleConfirmSubmit = useCallback(async () => {
    if (!task) return;

    // Submit current task directly for image/text/audio,
    // then return to annotator dashboard.
    setSaving(true);
    try {
      await handleSave();
      await axios.post(`${API_URL}/api/tasks/${task._id}/submit`);
      setShowSubmitConfirm(false);
      navigate('/annotator/tasks', { replace: true });
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      alert('Lỗi khi nộp bài: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  }, [task, handleSave, navigate]);

  const navigateToTask = async (taskId, saveCurrent = true) => {
    if (
      saveCurrent &&
      task &&
      task._id !== taskId &&
      task.status !== 'submitted' &&
      task.status !== 'approved'
    ) {
      try {
        await axios.put(`${API_URL}/api/tasks/${task._id}/label`, {
          labels,
          status: 'in_progress',
        });
      } catch (error) {
        console.error('Error auto-saving before navigation:', error);
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

  useEffect(() => {
    if (loading) return;

    const handleKeyDown = (e) => {
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
  }, [
    loading,
    saving,
    task?.status,
    handleSave,
    handleSubmit,
    currentTaskIndex,
    batchTasks.length,
    navigateToPrevious,
    navigateToNext,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const allCompletedInBatch =
    batchTasks.length > 0 &&
    batchTasks.every(
      (t) => t.status === 'completed' || t.status === 'submitted' || t.status === 'approved'
    );

  const batchProgress = batchTasks.length > 0 ? ((currentTaskIndex + 1) / batchTasks.length) * 100 : 0;
  const completedInBatch = batchTasks.filter((t) => t.status === 'completed' || t.status === 'submitted' || t.status === 'approved').length;

  const getStatusBadge = () => {
    if (!task) return null;
    const status = task.status;
    if (status === 'approved') {
      return (
        <div className="px-4 py-2 bg-green-100 border-2 border-green-400 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-800 font-bold">✓ APPROVED</span>
            {task.reviewedAt && (
              <span className="text-green-600 text-lg">
                by {task.reviewerId?.fullName || task.reviewerId?.username || 'Reviewer'} on{' '}
                {new Date(task.reviewedAt).toLocaleString()}
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
                by {task.reviewerId?.fullName || task.reviewerId?.username || 'Reviewer'} on{' '}
                {new Date(task.reviewedAt).toLocaleString()}
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
    <div className="flex-1 flex flex-col overflow-hidden overflow-x-hidden bg-gray-150 h-screen">
      {getStatusBadge() && <div className="px-6 pt-4">{getStatusBadge()}</div>}

      <div className="px-6 pt-3">
        <div className="rounded-lg border border-blue-200 bg-gray-150/40 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="md:w-[38%]">
              <h2 className="text-base font-semibold text-white">{task?.projectId?.name || 'Project Detail'}</h2>
              <p className="text-lg text-white mt-0.5">
                Task hiện tại: {Math.max(1, currentTaskIndex + 1)} / {Math.max(1, batchTasks.length)}
                {' '}• Đã hoàn thành: {completedInBatch}/{Math.max(1, batchTasks.length)}
              </p>
              {task?.projectId?.deadline && (
                <p className="text-lg font-medium text-rose-500 mt-0.5">
                  Deadline: {new Date(task.projectId.deadline).toLocaleString('vi-VN')}
                </p>
              )}
              <p className="text-lg text-white mt-0.5">Dataset: {task?.datasetId?.name || 'N/A'}</p>
              <p className="text-lg text-white mt-0.5">Subtopic: {task?.subtopicId?.name || 'N/A'}</p>
            </div>

            <div className="md:flex-1 md:px-4">
              {task?.projectId?.guidelines && (
                <div className="rounded-lg border border-sky-700/40 bg-sky-900/20">
                  <button
                    type="button"
                    onClick={() => setShowGuidelines((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Huong dan project</p>
                    <span className="text-sky-300 text-sm">{showGuidelines ? '▲' : '▼'}</span>
                  </button>
                  {showGuidelines && (
                    <div className="px-3 pb-3">
                      <p className="whitespace-pre-wrap text-sm text-slate-200">
                        {task.projectId.guidelines}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:pt-1">
              <button
                onClick={() => navigate('/annotator/tasks')}
                className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 hover:bg-blue-100"
              >
                Quay lại danh sách project
              </button>
            </div>
          </div>

          {Array.isArray(task?.projectId?.questions) && task.projectId.questions.length > 0 && (
            <div className="mt-3 rounded-lg border border-violet-700/40 bg-violet-900/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                Cau hoi can tra loi ({task.projectId.questions.length})
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-200 space-y-1">
                {task.projectId.questions.map((q, idx) => (
                  <li key={idx}>
                    {q?.questionText || q?.text || q?.label || 'Cau hoi'}
                    {q?.required !== false && <span className="ml-1 text-rose-300">*</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 h-2 w-full rounded-full bg-blue-100">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, Math.round(batchProgress || 0))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-150/40" ref={canvasRef}>
          {/* NOTE: UI phần dưới giữ nguyên như file hiện tại (không đụng vào để tránh sửa lớn). */}
          <div className="flex-1 overflow-auto bg-gray-150/40 p-4 md:p-6">
            {getTaskKind(task) === 'image' ? (
              <div className="mx-auto w-full max-w-6xl rounded-xl border border-slate-200 bg-gray-150/40 shadow-sm p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Image Annotation</h3>
                  <span className="text-xs text-slate-500">{task?.dataItem?.filename || 'Image file'}</span>
                </div>

                <ImageAnnotator
                  imageUrl={buildFileUrl(task.dataItem)}
                  labelSet={task?.availableLabels || []}
                  questions={task?.projectId?.questions || []}
                  onAnnotationsChange={handleAnnotationsChange}
                  initialAnnotations={annotations}
                  readOnly={task?.status === 'submitted' || task?.status === 'approved'}
                />

                <div className="mt-4 border-t border-slate-200 pt-4 flex flex-wrap gap-3 justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToPrevious}
                      disabled={saving || currentTaskIndex <= 0}
                    >
                      Ảnh Sau
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToNext}
                      disabled={saving || currentTaskIndex >= batchTasks.length - 1}
                    >
                      Ảnh trước
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={handleCompleteImage}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Image
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={handleBatchSubmit}
                      disabled={!allCompletedInBatch || saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Project
                    </Button>
                  </div>
                </div>
              </div>
            ) : getTaskKind(task) === 'text' ? (
              <div className="mx-auto w-full max-w-5xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm relative">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Text Annotation</h3>
                  <span className="text-xs font-medium text-slate-500">{task?.dataItem?.mimeType}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Text File</p>
                    <p className="text-base font-semibold text-slate-900">
                      {task?.dataItem?.filename || 'Unnamed file'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 font-medium">{task?.dataItem?.mimeType}</span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <strong>Hướng dẫn:</strong> Bôi đen phần văn bản bạn muốn gán nhãn, sau đó chọn nhãn từ dropdown.
                </div>

                <div className="relative">
                  <div
                    ref={textContainerRef}
                    className="border border-slate-300 rounded-md bg-gray-150/40 p-4 max-h-96 overflow-auto text-base text-slate-900 whitespace-pre-wrap relative select-text leading-relaxed"
                    onMouseUp={() => {
                      if (task?.status === 'submitted' || task?.status === 'approved') return;

                      const selection = window.getSelection();
                      if (!selection || selection.rangeCount === 0) return;

                      const range = selection.getRangeAt(0);
                      const selectedText = selection.toString().trim();

                      if (selectedText.length === 0) {
                        setSelectedTextRange(null);
                        setShowLabelDropdown(false);
                        return;
                      }

                      if (!textContainerRef.current) return;

                      const preRange = document.createRange();
                      preRange.selectNodeContents(textContainerRef.current);
                      preRange.setEnd(range.startContainer, range.startOffset);
                      const start = preRange.toString().length;
                      const end = start + selection.toString().length;

                      const overlaps = textSpans.some(
                        (span) =>
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

                      const rect = range.getBoundingClientRect();
                      const containerRect = textContainerRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        x: rect.left - containerRect.left + rect.width / 2,
                        y: rect.top - containerRect.top - 10,
                      });
                      setShowLabelDropdown(true);
                    }}
                    style={{ userSelect: 'text' }}
                  >
                    {renderTextWithSpans()}
                  </div>

                  {showLabelDropdown && selectedTextRange && task?.availableLabels?.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-50 bg-gray-150/40 border border-slate-300 rounded-lg shadow-xl p-2 min-w-[220px]"
                      style={{
                        left: `${dropdownPosition.x}px`,
                        top: `${dropdownPosition.y}px`,
                        transform: 'translateX(-50%) translateY(-100%)',
                      }}
                    >
                      <div className="text-sm font-semibold text-slate-800 mb-2">Chọn nhãn:</div>
                      <div className="space-y-1">
                        {task.availableLabels.map((lbl) => (
                          <button
                            key={lbl.name}
                            onClick={() => {
                              const newSpan = {
                                id: `span-${Date.now()}`,
                                start: selectedTextRange.start,
                                end: selectedTextRange.end,
                                text: selectedTextRange.text,
                                label: lbl.name,
                                note: '',
                              };
                              setTextSpans([...textSpans, newSpan].sort((a, b) => a.start - b.start));
                              setSelectedTextRange(null);
                              setShowLabelDropdown(false);
                              window.getSelection()?.removeAllRanges();
                            }}
                            className="w-full bg-gray-150/40 text-slate-800 text-left px-3 py-2 text-sm rounded hover:bg-blue-50 hover:text-slate-900 border border-transparent hover:border-blue-200 transition-colors"
                            style={{ borderLeftColor: lbl.color || '#3b82f6', borderLeftWidth: '30px' }}
                          >
                            {lbl.name}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTextRange(null);
                          setShowLabelDropdown(false);
                          window.getSelection()?.removeAllRanges();
                        }}
                        className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 text-center"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>

                {textSpans.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Các phần đã gán nhãn ({textSpans.length}):
                    </label>
                    <div className="border rounded-md p-3 max-h-48 overflow-auto space-y-2">
                      {textSpans.map((span) => {
                        const labelInfo = task?.availableLabels?.find((l) => l.name === span.label);
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
                                <span className="text-xs text-gray-500">({span.start}-{span.end})</span>
                              </div>
                              <div className="text-xs text-gray-600 bg-gray-150/40 p-1 rounded border border-gray-200 truncate">
                                "{span.text}"
                              </div>
                            </div>
                            {task?.status !== 'submitted' && task?.status !== 'approved' && (
                              <button
                                onClick={() => {
                                  setTextSpans(textSpans.filter((s) => s.id !== span.id));
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ghi chú tổng thể (tùy chọn)</label>
                  <textarea
                    className="w-full border border-gray-300 bg-gray-150/40 text-white placeholder:text-gray-400 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Nhập ghi chú tổng thể cho toàn bộ văn bản..."
                    value={annotationNote}
                    onChange={(e) => setAnnotationNote(e.target.value)}
                    disabled={task?.status === 'submitted' || task?.status === 'approved'}
                  />
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 flex flex-wrap gap-3 justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToPrevious}
                      disabled={saving || currentTaskIndex <= 0}
                    >
                      Sau
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToNext}
                      disabled={saving || currentTaskIndex >= batchTasks.length - 1}
                    >
                      Tiếp
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleSave}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Lưu
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={handleCompleteImage}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Text
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={handleBatchSubmit}
                      disabled={!allCompletedInBatch || saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Project
                    </Button>
                  </div>
                </div>
              </div>
            ) : getTaskKind(task) === 'audio' ? (
              <div className="mx-auto w-full max-w-5xl space-y-4 rounded-xl border border-slate-200 bg-gray-150/40 p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Audio Annotation</h3>
                  <span className="text-xs font-medium text-slate-500">{task?.dataItem?.mimeType}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Audio File</p>
                    <p className="text-base font-semibold text-gray-800">
                      {task?.dataItem?.filename || 'Unnamed audio'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{task?.dataItem?.mimeType}</span>
                </div>
                <AudioAnnotator
                  audioUrl={buildFileUrl(task?.dataItem)}
                  labelSet={task?.availableLabels || []}
                  initialSegments={labels?.segments || []}
                  readOnly={task?.status === 'submitted' || task?.status === 'approved'}
                  onChange={(segs) => {
                    setLabels((prev) => ({ ...prev, segments: segs }));
                  }}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ghi chú / Nhãn cho audio</label>
                  <textarea
                    className="w-full border border-gray-300 bg-gray-150/40 text-gray-900 placeholder:text-gray-400 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Nhập nhận xét hoặc nhãn..."
                    value={annotationNote}
                    onChange={(e) => setAnnotationNote(e.target.value)}
                    disabled={task?.status === 'submitted' || task?.status === 'approved'}
                  />
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 flex flex-wrap gap-3 justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToPrevious}
                      disabled={saving || currentTaskIndex <= 0}
                    >
                      Trước
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={navigateToNext}
                      disabled={saving || currentTaskIndex >= batchTasks.length - 1}
                    >
                      Tiếp
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleSave}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Lưu
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={handleCompleteImage}
                      disabled={saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Audio
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={handleBatchSubmit}
                      disabled={!allCompletedInBatch || saving || task?.status === 'submitted' || task?.status === 'approved'}
                    >
                      Submit Project
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">Không hỗ trợ loại file này.</div>
            )}
          </div>
        </div>

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
    </div>
  );
};

export default AnnotatorTask;
