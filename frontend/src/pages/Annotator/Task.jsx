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
  const [textSpans, setTextSpans] = useState([]); // [{ id, start, end, label }]
  const [pendingSelection, setPendingSelection] = useState(null); // { start, end }
  const [pendingLabel, setPendingLabel] = useState('');
  const [showSpanPicker, setShowSpanPicker] = useState(false);
  const [spanPickerPos, setSpanPickerPos] = useState({ x: 0, y: 0 });
  const textContainerRef = useRef(null);
  const canvasRef = useRef(null);

  const getTaskKind = useCallback((t) => {
    const mt = t?.dataItem?.mimeType || '';
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt.startsWith('text/')) return 'text';
    if (['application/json', 'application/xml', 'text/csv'].includes(mt)) return 'text';
    return 'other';
  }, []);

  useEffect(() => {
    setAnnotations([]);
    setLabels({});
    setSelectedAnnotation(null);
    setTextContent('');
    setAnnotationNote('');
    setTextSpans([]);
    setPendingSelection(null);
    setPendingLabel('');
    setShowSpanPicker(false);
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
      setTextSpans([]);
      setPendingSelection(null);
      setPendingLabel('');
      setShowSpanPicker(false);

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
        setAnnotationNote(initialLabels?.note || '');
        setTextSpans(Array.isArray(initialLabels?.spans) ? initialLabels.spans : []);
      }

      if (kind === 'audio') {
        setAnnotationNote(initialLabels?.note || '');
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
      const labelsObj = {
        objects: newAnnotations.map((ann) => ({
          label: ann.label,
          bbox: ann.bbox,
          confidence: ann.confidence,
          answer: ann.answer || null,
        })),
      };
      setLabels(labelsObj);

      if (task?.projectId?.questions) {
        const totalRequired = task.projectId.questions.length || 0;
        const completed = newAnnotations.filter((a) => a.answer).length;
        setProgress(totalRequired > 0 ? (completed / totalRequired) * 100 : 0);
      } else {
        setProgress(newAnnotations.length > 0 ? 50 : 0);
      }
    },
    [task]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const kind = getTaskKind(task);
      let labelsPayload = labels;

      if (kind === 'image') {
        labelsPayload = labels;
      } else {
        labelsPayload =
          kind === 'text'
            ? { note: annotationNote?.trim() || '', spans: textSpans }
            : { note: annotationNote?.trim() || '' };
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
  }, [id, labels, annotationNote, task, getTaskKind, textSpans]);

  const handleSubmit = useCallback(() => {
    const kind = getTaskKind(task);
    if (kind === 'image') {
      if (Object.keys(labels).length === 0 || (labels.objects && labels.objects.length === 0)) {
        alert('Bạn chưa khoanh vùng đối tượng nào. Vui lòng thêm annotations trước khi nộp bài.');
        return;
      }
    } else if (kind === 'text') {
      if (!Array.isArray(textSpans) || textSpans.length === 0) {
        alert('Vui lòng bôi đen đoạn văn và gán nhãn (ít nhất 1 đoạn) trước khi nộp.');
        return;
      }
    } else if (kind === 'audio') {
      if (!annotationNote.trim()) {
        alert('Vui lòng nhập ghi chú/nhãn trước khi nộp.');
        return;
      }
    }

    if (!task?.reviewers || task.reviewers.length === 0) {
      alert('Task chưa được gán Reviewer. Liên hệ Manager để gán Reviewer trước khi nộp.');
      return;
    }

    if (
      task?.projectId?.questions &&
      Array.isArray(task.projectId.questions) &&
      task.projectId.questions.length > 0
    ) {
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
  }, [labels, task, getTaskKind, textSpans, annotationNote]);

  const handleConfirmSubmit = useCallback(async () => {
    setShowSubmitConfirm(false);
    if (task?.status === 'submitted' || task?.status === 'approved') {
      alert('Task đã được nộp. Vui lòng chờ reviewer đánh giá.');
      return;
    }

    if (task?.projectId?.deadline) {
      const deadline = new Date(task.projectId.deadline);
      const now = new Date();
      if (now > deadline) {
        alert(
          `Không thể nộp task. Deadline của project đã hết hạn (${deadline.toLocaleString(
            'vi-VN'
          )}). Vui lòng liên hệ Manager.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const kind = getTaskKind(task);
      let labelsPayload = labels;

      if (kind === 'image') {
        labelsPayload = labels;
      } else {
        labelsPayload =
          kind === 'text'
            ? { note: annotationNote?.trim() || '', spans: textSpans }
            : { note: annotationNote?.trim() || '' };
      }

      await axios.put(`${API_URL}/api/tasks/${id}/label`, {
        labels: labelsPayload,
        status: 'in_progress',
      });
      await axios.post(`${API_URL}/api/tasks/${id}/submit`);
      const msg =
        task?.status === 'rejected'
          ? 'Nộp lại bài thành công! Reviewer sẽ kiểm tra và phản hồi.'
          : 'Nộp bài thành công! Reviewer sẽ kiểm tra và phản hồi.';
      alert(msg);
      setTask((prev) => (prev ? { ...prev, status: 'submitted' } : prev));

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
  }, [id, labels, currentTaskIndex, batchTasks, navigate, task, getTaskKind, annotationNote, textSpans]);

  const getSpanColor = useCallback(
    (labelName) => {
      const ls = task?.projectId?.labelSet || [];
      const found = ls.find((l) => (typeof l === 'string' ? l === labelName : l?.name === labelName));
      const color = typeof found === 'object' && found?.color ? found.color : null;
      if (color) return color;
      if (labelName?.toLowerCase().includes('tích') || labelName?.toLowerCase().includes('positive'))
        return '#22C55E';
      if (labelName?.toLowerCase().includes('tiêu') || labelName?.toLowerCase().includes('negative'))
        return '#EF4444';
      return '#3B82F6';
    },
    [task]
  );

  const getSelectionOffsets = useCallback(() => {
    const container = textContainerRef.current;
    if (!container) return null;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = range.toString();
    const end = start + selectedText.length;
    if (!selectedText || start === end) return null;
    return { start, end };
  }, []);

  const handleMouseUpOnText = useCallback(
    (e) => {
      const offsets = getSelectionOffsets();
      if (!offsets) {
        setShowSpanPicker(false);
        setPendingSelection(null);
        return;
      }
      setPendingSelection(offsets);
      setPendingLabel('');
      setShowSpanPicker(true);
      setSpanPickerPos({ x: e.clientX, y: e.clientY });
    },
    [getSelectionOffsets]
  );

  const addSpan = useCallback(() => {
    if (!pendingSelection || !pendingLabel) return;
    const { start, end } = pendingSelection;
    const text = textContent || '';
    if (start < 0 || end > text.length || start >= end) return;
    const exists = textSpans.some((s) => s.start === start && s.end === end && s.label === pendingLabel);
    if (exists) {
      setShowSpanPicker(false);
      return;
    }
    const newSpan = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      start,
      end,
      label: pendingLabel,
    };
    setTextSpans((prev) => [...prev, newSpan].sort((a, b) => a.start - b.start || a.end - b.end));
    setShowSpanPicker(false);
    setPendingSelection(null);
    setPendingLabel('');
    window.getSelection?.()?.removeAllRanges?.();
  }, [pendingSelection, pendingLabel, textContent, textSpans]);

  const removeSpan = useCallback((idToRemove) => {
    setTextSpans((prev) => prev.filter((s) => s.id !== idToRemove));
  }, []);

  const renderTextWithSpans = useCallback(() => {
    const text = textContent || '';
    if (!text) return 'Không có nội dung hiển thị.';
    if (!Array.isArray(textSpans) || textSpans.length === 0) return text;
    const spansSorted = [...textSpans]
      .filter((s) => typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const nodes = [];
    let cursor = 0;
    for (const s of spansSorted) {
      const start = Math.max(0, Math.min(s.start, text.length));
      const end = Math.max(0, Math.min(s.end, text.length));
      if (end <= cursor) continue;
      if (start > cursor) nodes.push(text.slice(cursor, start));
      const bg = getSpanColor(s.label);
      nodes.push(
        <mark
          key={s.id}
          style={{ backgroundColor: `${bg}33`, borderBottom: `2px solid ${bg}` }}
          className="rounded px-1"
          title={`${s.label}`}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
  }, [textContent, textSpans, getSpanColor]);

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
  }, [loading, saving, task?.status, handleSave, handleSubmit, currentTaskIndex, batchTasks.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      {getStatusBadge() && <div className="px-6 pt-4">{getStatusBadge()}</div>}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-100" ref={canvasRef}>
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
              <div className="bg-white rounded-lg shadow-lg p-4 max-w-3xl w-full space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Text File</p>
                    <p className="text-base font-semibold text-gray-800">
                      {task?.dataItem?.filename || 'Unnamed file'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{task?.dataItem?.mimeType}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Bôi đen đoạn văn bạn muốn gán nhãn (multi-label). Mỗi đoạn bôi đen có thể gán 1 nhãn riêng.
                </div>
                <div
                  ref={textContainerRef}
                  onMouseUp={
                    task?.status === 'submitted' || task?.status === 'approved'
                      ? undefined
                      : handleMouseUpOnText
                  }
                  className="border rounded-md bg-gray-50 p-3 max-h-72 overflow-auto text-sm text-gray-800 whitespace-pre-wrap relative select-text"
                >
                  {renderTextWithSpans()}
                </div>
                {showSpanPicker && (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72"
                    style={{ left: spanPickerPos.x + 8, top: spanPickerPos.y + 8 }}
                  >
                    <div className="text-xs text-gray-500 mb-2">Gán nhãn cho đoạn đã bôi đen</div>
                    <select
                      className="w-full border rounded-md px-2 py-2 text-sm"
                      value={pendingLabel}
                      onChange={(e) => setPendingLabel(e.target.value)}
                    >
                      <option value="">-- Chọn nhãn --</option>
                      {(task?.projectId?.labelSet || []).map((lbl) => {
                        const name = typeof lbl === 'string' ? lbl : lbl?.name;
                        if (!name) return null;
                        return (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                        onClick={() => {
                          setShowSpanPicker(false);
                          setPendingSelection(null);
                          setPendingLabel('');
                        }}
                      >
                        Hủy
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={!pendingLabel}
                        onClick={addSpan}
                      >
                        Thêm nhãn
                      </button>
                    </div>
                  </div>
                )}

                {textSpans.length > 0 && (
                  <div className="border rounded-md p-3 bg-white">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Các đoạn đã gán nhãn</div>
                    <div className="space-y-2">
                      {textSpans.map((s) => (
                        <div key={s.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-gray-500">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getSpanColor(s.label) }}
                                />
                                <span className="font-medium text-gray-700">{s.label}</span>
                                <span className="text-gray-400">
                                  ({s.start}–{s.end})
                                </span>
                              </span>
                            </div>
                            <div className="text-sm text-gray-800 line-clamp-2">
                              “{(textContent || '').slice(s.start, s.end)}”
                            </div>
                          </div>
                          <button
                            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => removeSpan(s.id)}
                            disabled={task?.status === 'submitted' || task?.status === 'approved'}
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ghi chú (optional)</label>
                  <textarea
                    className="w-full border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Nhập ghi chú nếu cần..."
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
                <audio controls className="w-full" src={`${API_URL}/${task?.dataItem?.path}`} />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ghi chú / Nhãn cho audio</label>
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
              <div className="text-center py-12 text-gray-500">Không hỗ trợ loại file này.</div>
            )}
          </div>
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

      {message && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-2 text-sm text-gray-800">
          {message}
        </div>
      )}
    </div>
  );
};

export default AnnotatorTask;
