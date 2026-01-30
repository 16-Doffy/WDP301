import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageViewer from '../../components/ImageViewer';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [errorCategory, setErrorCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [selectedError, setSelectedError] = useState('');
  const [autoNext, setAutoNext] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [hoveredObjectIndex, setHoveredObjectIndex] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const carouselRef = useRef(null);
  const [carouselScroll, setCarouselScroll] = useState(0);
  const [sentenceFeedbacks, setSentenceFeedbacks] = useState({});
  const [sentenceStatus, setSentenceStatus] = useState({});
  const [processingSentences, setProcessingSentences] = useState({});
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);

  useEffect(() => {
    fetchTask();
    fetchAllTasks();
  }, [id]);

  // ADD THIS LOG
  useEffect(() => {
    if (task) {
      console.log('Task data:', {
        mimeType: task?.dataItem?.mimeType,
        text: task?.dataItem?.text,
        content: task?.dataItem?.content,
        dataItem: task?.dataItem
      });
    }
  }, [task]);

  // Map frontend error types to backend error categories
  const mapErrorCategoryToBackend = (frontendCategory) => {
    const mapping = {
      'tightness': 'poor_quality',      // Tightness issue = poor quality
      'missed': 'missing_label',         // Missed object = missing label
      'wrong_class': 'incorrect_label',  // Wrong class = incorrect label
      'occlusion': 'does_not_follow_guidelines', // Occlusion error = doesn't follow guidelines
      'other': 'other'
    };
    return mapping[frontendCategory] || 'other';
  };

  const errorTypes = [
    {
      id: 'tightness',
      name: 'Tightness Issue',
      description: "Bounding box doesn't fit object",
      icon: '📐',
      color: 'from-yellow-400 to-orange-500',
      backendCategory: 'poor_quality'
    },
    {
      id: 'missed',
      name: 'Missed Object',
      description: 'Visible object not labeled',
      icon: '👁️',
      color: 'from-blue-400 to-cyan-500',
      backendCategory: 'missing_label'
    },
    {
      id: 'wrong_class',
      name: 'Wrong Class',
      description: 'Categorization error',
      icon: '🏷️',
      color: 'from-purple-400 to-pink-500',
      backendCategory: 'incorrect_label'
    },
    {
      id: 'occlusion',
      name: 'Occlusion Error',
      description: 'Improper handling of overlap',
      icon: '🔀',
      color: 'from-red-400 to-rose-500',
      backendCategory: 'does_not_follow_guidelines'
    }
  ];

  const fetchAllTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      setPendingTasks(response.data.pending || []);
      setReviewedTasks(response.data.reviewed || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      let taskData = response.data;

      // If mimeType is text/plain but no text content, fetch from file
      if (taskData.dataItem?.mimeType === 'text/plain' && !taskData.dataItem?.text) {
        try {
          const fileResp = await axios.get(`${API_URL}/${taskData.dataItem.path}`, {
            responseType: 'text'
          });
          taskData.dataItem.text = fileResp.data;
        } catch (err) {
          console.error('Error fetching text file:', err);
        }
      }

      setTask(taskData);
      setReviewNotes(taskData.reviewNotes || []);
      setReviewComments(taskData.reviewComments || '');

      // Load existing sentence feedbacks
      setSentenceFeedbacks({});
      setSentenceStatus({});
      if (taskData.sentenceFeedbacks) {
        const feedbacks = {};
        const statuses = {};
        Object.entries(taskData.sentenceFeedbacks).forEach(([key, fb]) => {
          // Extract index from keys like "sentence_0", "span_0", "audio_0", "segment_0", or just "0"
          const index = key.toString()
            .replace('sentence_', '')
            .replace('span_', '')
            .replace('audio_', '')
            .replace('segment_', '');

          const uiKey = `${id}-${index}`;

          feedbacks[uiKey] = fb.feedback || '';

          // Map both 'approve' and 'approved' to 'approved' for UI consistency
          const backendAction = (fb.action || fb.status || '').toLowerCase();
          if (backendAction === 'approve' || backendAction === 'approved') {
            statuses[uiKey] = 'approved';
          } else if (backendAction === 'reject' || backendAction === 'rejected') {
            statuses[uiKey] = 'rejected';
          } else {
            statuses[uiKey] = backendAction;
          }
        });
        setSentenceFeedbacks(feedbacks);
        setSentenceStatus(statuses);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';

  const handleApprove = useCallback(async () => {
    // Check if task has already been reviewed
    if (isReviewed) {
      alert('Task này đã được đánh giá rồi.');
      return;
    }

    if (!window.confirm('Bạn có chắc muốn phê duyệt task này?')) return;

    setProcessing(true);
    try {
      const payloadNotes = (reviewNotes && reviewNotes.length > 0)
        ? reviewNotes.map(n => ({
          bbox: n.bbox,
          label: n.label,
          comment: n.comment
        }))
        : [];

      const response = await axios.post(`${API_URL}/api/reviews/${id}/approve`, {
        reviewComments: reviewComments.trim() || undefined,
        reviewNotes: payloadNotes,
      }, { timeout: 15000 });

      if (response.status === 200 || response.status === 201) {
        alert('Đã phê duyệt task thành công!');
        await fetchTask();
        await fetchAllTasks();
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Lỗi khi phê duyệt';
      alert(`Không thể hoàn tất: ${msg}`);
      console.error(error);
    } finally {
      setProcessing(false);
    }
  }, [id, task, reviewComments, reviewNotes, isReviewed]);

  const handleReject = useCallback(async () => {
    // Check if task has already been reviewed
    if (task?.status === 'approved' || task?.status === 'rejected') {
      alert('Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (!reviewComments.trim()) {
      alert('Vui lòng nhập nhận xét khi từ chối task');
      return;
    }

    if (window.confirm('Bạn có chắc muốn từ chối task này? Annotator sẽ nhận được phản hồi và cần chỉnh sửa lại. Lưu ý: Mỗi task chỉ có thể được đánh giá 1 lần.')) {
      setProcessing(true);
      try {
        const payloadNotes = (reviewNotes && reviewNotes.length > 0)
          ? reviewNotes.map(n => ({
            bbox: n.bbox,
            label: n.label,
            comment: n.comment
          }))
          : [];
        // Map frontend error category to backend format
        const selectedErrorType = errorTypes.find(et => et.id === (errorCategory || selectedError));
        const backendErrorCategory = selectedErrorType
          ? selectedErrorType.backendCategory
          : mapErrorCategoryToBackend(errorCategory || selectedError || 'other');

        await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: backendErrorCategory,
          reviewNotes: payloadNotes,
        });
        alert('Đã từ chối task thành công!');
        // Refresh task data and tasks list to update statistics
        await fetchTask();
        await fetchAllTasks();
        // Stay on current page instead of navigating away
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        alert(errorMessage);
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, task, reviewComments, reviewNotes, errorCategory, selectedError]);

  const handleSkip = () => {
    if (pendingTasks.length > 1) {
      const currentIndex = pendingTasks.findIndex(t => t._id === id);
      if (currentIndex < pendingTasks.length - 1) {
        navigate(`/reviewer/tasks/${pendingTasks[currentIndex + 1]._id}`);
      } else if (currentIndex > 0) {
        navigate(`/reviewer/tasks/${pendingTasks[currentIndex - 1]._id}`);
      }
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'reviewer',
      timestamp: new Date()
    };
    setChatMessages([...chatMessages, message]);
    setReviewComments(prev => prev ? `${prev}\n${newMessage}` : newMessage);
    setNewMessage('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (task?.status === 'approved' || task?.status === 'rejected') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleApprove();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (reviewComments.trim() && reviewNotes.length > 0) {
          handleReject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [task, reviewComments, reviewNotes, handleApprove, handleReject]);

  const calculateQualityScore = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) return 0;
    const totalObjects = task.labels.objects.length;
    const hasAnswers = task.labels.objects.filter(obj => obj.answer).length;
    const completeness = totalObjects > 0 ? (hasAnswers / totalObjects) * 100 : 0;
    return Math.round(completeness);
  };

  // Calculate average confidence from all objects in current task
  const calculateAverageConfidence = () => {
    if (!task?.labels?.objects || task.labels.objects.length === 0) return 0;
    const objectsWithConfidence = task.labels.objects.filter(obj => obj.confidence != null);
    if (objectsWithConfidence.length === 0) return 0;
    const sumConfidence = objectsWithConfidence.reduce((sum, obj) => sum + (obj.confidence || 0), 0);
    return (sumConfidence / objectsWithConfidence.length) * 100;
  };

  // Calculate accuracy and rejection rates from all reviewed tasks
  const calculateReviewStats = () => {
    // Calculate based on all reviewed tasks (approved + rejected)
    const totalReviewed = reviewedTasks.length;

    if (totalReviewed === 0) {
      // If no tasks reviewed yet, show 0 for both
      return {
        accuracy: 0,
        rejection: 0
      };
    }

    const approvedCount = reviewedTasks.filter(t => t.status === 'approved').length;
    const rejectedCount = reviewedTasks.filter(t => t.status === 'rejected').length;

    // Accuracy = percentage of approved tasks out of all reviewed tasks
    const accuracy = (approvedCount / totalReviewed) * 100;
    // Rejection = percentage of rejected tasks out of all reviewed tasks
    const rejection = (rejectedCount / totalReviewed) * 100;

    return {
      accuracy: Math.round(accuracy * 10) / 10,
      rejection: Math.round(rejection * 10) / 10,
      totalReviewed,
      approvedCount,
      rejectedCount
    };
  };

  const qualityScore = calculateQualityScore();
  const averageConfidence = calculateAverageConfidence();
  const reviewStats = calculateReviewStats();
  const accuracy = reviewStats.accuracy;
  const rejection = reviewStats.rejection;
  const currentTaskIndex = pendingTasks.findIndex(t => t._id === id);
  const batchProgress = pendingTasks.length > 0 && currentTaskIndex >= 0
    ? Math.round(((currentTaskIndex + 1) / pendingTasks.length) * 100)
    : 0;

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      const currentScroll = carouselRef.current.scrollLeft;
      const newScroll = direction === 'left'
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
      const maxScroll = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
      const finalScroll = Math.max(0, Math.min(newScroll, maxScroll));
      carouselRef.current.scrollTo({ left: finalScroll, behavior: 'smooth' });
      setCarouselScroll(finalScroll);
    }
  };

  useEffect(() => {
    if (carouselRef.current) {
      const handleScroll = () => {
        setCarouselScroll(carouselRef.current.scrollLeft);
      };
      carouselRef.current.addEventListener('scroll', handleScroll);
      return () => {
        if (carouselRef.current) {
          carouselRef.current.removeEventListener('scroll', handleScroll);
        }
      };
    }
  }, [pendingTasks]);

  const splitSentences = (text = '') => {
    // Split by newline first (mỗi dòng là 1 câu)
    let sentences = text.split('\n').map(s => s.trim()).filter(Boolean);

    // If no newlines, try splitting by . ? !
    if (sentences.length <= 1) {
      sentences = text
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    // If still only 1 or empty, return original text as single sentence
    if (sentences.length === 0) {
      return text.trim() ? [text.trim()] : [];
    }

    return sentences;
  };

  const handleSentenceAction = async (idx, action, type = 'sentence') => {
    const key = `${id}-${idx}`;
    if (action === 'reject' && !sentenceFeedbacks[key]?.trim()) {
      alert('Vui lòng nhập feedback trước khi từ chối mục này.');
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn ${action === 'approve' ? 'Phê duyệt' : 'Từ chối'} mục này?`)) return;

    setProcessingSentences(prev => ({ ...prev, [key]: true }));
    try {
      await axios.post(`${API_URL}/api/reviews/${id}/sentences`, {
        taskId: id, // Explicitly pass taskId in body too
        index: idx,
        action: action,
        feedback: sentenceFeedbacks[key]?.trim() || undefined,
        type: type,
      }, { timeout: 10000 });

      // Update local state immediately
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update the status map
      setSentenceStatus(prev => ({ ...prev, [key]: newStatus }));

      // Also inject into the current task labels for UI consistency
      setTask(prev => {
        if (!prev) return prev;
        const newLabels = { ...(prev.labels || {}) };
        const listKey = type === 'span' ? 'spans' : 'sentences';
        if (newLabels[listKey] && newLabels[listKey][idx]) {
          newLabels[listKey][idx].status = newStatus;
          newLabels[listKey][idx].reviewFeedback = sentenceFeedbacks[key]?.trim();
        }
        return { ...prev, labels: newLabels };
      });

      // Clear processing after a short delay
      setTimeout(() => {
        setProcessingSentences(prev => ({ ...prev, [key]: false }));
      }, 800);

      await fetchAllTasks();
    } catch (err) {
      setProcessingSentences(prev => ({ ...prev, [key]: false }));
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối';
      alert(`Không thể lưu đánh giá: ${msg}`);
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-purple-50'}`}>
        <div className={`animate-spin rounded-full h-16 w-16 border-4 ${darkMode ? 'border-emerald-400 border-t-transparent' : 'border-emerald-500 border-t-transparent'}`}></div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
      {/* Top Header - Dynamic Style */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/80 backdrop-blur-lg border-gray-200'} border-b px-6 py-4 flex items-center justify-between z-10`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {darkMode ? '🔍 Premium Dark Audit Station' : '⚡ Review task'}
          </h1>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
            {pendingTasks.length} PENDING
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-all ${darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-white/60 text-gray-700 hover:bg-white/80'}`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Detected Objects with Smart Highlight */}
        <div className={`w-80 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200'} border-r flex flex-col`}>
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              DETECTED OBJECTS
            </h3>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {task?.labels?.objects?.length || 0} TOTAL
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {task?.labels?.objects?.map((obj, idx) => {
              const labelInfo = task?.projectId?.labelSet?.find(l => l.name === obj.label);
              const isHovered = hoveredObjectIndex === idx;
              return (
                <div
                  key={idx}
                  id={`object-${idx}`}
                  onMouseEnter={() => setHoveredObjectIndex(idx)}
                  onMouseLeave={() => setHoveredObjectIndex(null)}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${isHovered
                    ? darkMode
                      ? 'bg-emerald-600/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/50'
                      : 'bg-emerald-100 border-2 border-emerald-400 shadow-lg'
                    : darkMode
                      ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                      : 'bg-white/40 border border-gray-300/50 hover:bg-white/60'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {obj.label || `OBJECT_${idx + 1}`}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}
                      title="Độ tin cậy của nhãn này (confidence score)"
                    >
                      {obj.confidence ? `${(obj.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  {obj.answer && (
                    <div className={`text-xs mt-1 ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      ✓ Has answers
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center - Image Viewer with Smart Highlight */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 overflow-y-auto p-6 ${darkMode ? 'bg-gray-900' : ''}`}>
            {/* Status Banner - Show when task is already reviewed */}
            {isReviewed && (
              <div className={`mb-4 p-4 rounded-xl border-2 ${task?.status === 'approved'
                ? darkMode
                  ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300'
                  : 'bg-emerald-100 border-emerald-500 text-emerald-800'
                : darkMode
                  ? 'bg-red-900/30 border-red-500 text-red-300'
                  : 'bg-red-100 border-red-500 text-red-800'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {task?.status === 'approved' ? '✓' : '✕'}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">
                      {task?.status === 'approved' ? 'ĐÃ PHÊ DUYỆT' : 'ĐÃ TỪ CHỐI'}
                    </h3>
                    <p className="text-sm mt-1">
                      Task này đã được đánh giá bởi bạn vào {task?.reviewedAt ? new Date(task.reviewedAt).toLocaleString('vi-VN') : 'trước đó'}.
                      Mỗi task chỉ có thể được đánh giá 1 lần.
                    </p>
                    {task?.reviewComments && (
                      <p className="text-sm mt-2 opacity-90">
                        <strong>Nhận xét của bạn:</strong> {task.reviewComments}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <h2 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                CURRENTLY AUDITING
              </h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {task?.dataItem?.filename || 'Image'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Review Queue (moved down here to replace comparison section) */}
              <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} rounded-2xl border p-6 shadow-xl`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    REVIEW QUEUE
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pendingTasks.length} PENDING
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingTasks.length === 0 ? (
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Không có task nào đang chờ review.
                    </div>
                  ) : (
                    pendingTasks.map((pendingTask) => {
                      const isActive = pendingTask._id === id;
                      const timeAgo = pendingTask.submittedAt ? getTimeAgo(new Date(pendingTask.submittedAt)) : '';
                      return (
                        <button
                          key={pendingTask._id}
                          onClick={() => navigate(`/reviewer/tasks/${pendingTask._id}`)}
                          className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${isActive
                            ? darkMode
                              ? 'bg-emerald-600/30 border-2 border-emerald-400'
                              : 'bg-emerald-100 border-2 border-emerald-400'
                            : darkMode
                              ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                              : 'bg-white/40 border border-gray-300/50 hover:bg-white/60'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            {pendingTask.dataItem?.mimeType?.startsWith('image/') && (
                              <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                <img
                                  src={`${API_URL}/${pendingTask.dataItem?.path}`}
                                  alt="Task thumbnail"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                TSK-{pendingTask._id?.substring(0, 8).toUpperCase()}
                              </div>
                              <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {pendingTask.projectId?.name || 'Project'}
                              </div>
                              {timeAgo && (
                                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {timeAgo}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Annotator Output - Glassmorphism with Neon Glow on Hover */}
              <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} rounded-2xl border p-6 shadow-xl`}>
                <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ANNOTATOR OUTPUT
                </h3>

                {task?.dataItem?.mimeType?.startsWith('image/') ? (
                  <>
                    <div className={`mb-4 rounded-xl overflow-hidden transition-all duration-300 ${hoveredObjectIndex !== null
                      ? darkMode
                        ? 'ring-4 ring-emerald-400/50 shadow-2xl shadow-emerald-500/30'
                        : 'ring-4 ring-emerald-300/50 shadow-2xl'
                      : ''
                      }`}>
                      <ImageViewer
                        imageUrl={`${API_URL}/${task.dataItem.path}`}
                        annotations={task?.labels?.objects?.map((obj, idx) => ({
                          id: idx,
                          bbox: obj.bbox,
                          label: obj.label,
                          index: idx,
                        })) || []}
                        labelSet={task?.projectId?.labelSet || []}
                        reviewNotes={reviewNotes}
                        readOnly={false}
                        highlightedIndex={hoveredObjectIndex}
                        maxHeight="400px"
                        onAnnotationClick={(ann) => {
                          setHoveredObjectIndex(ann.index);
                          const element = document.getElementById(`object-${ann.index}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span
                        className={`font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                        title="Độ tin cậy trung bình của tất cả các đối tượng được gán nhãn trong ảnh này"
                      >
                        AVG CONFIDENCE {averageConfidence.toFixed(1)}%
                      </span>
                      <span
                        className={darkMode ? 'text-gray-400' : 'text-gray-600'}
                        title="Tổng số đối tượng (objects) đã được gán nhãn trong ảnh này"
                      >
                        CLASSES {task?.labels?.objects?.length || 0} Total
                      </span>
                    </div>
                  </>
                ) : task?.dataItem?.mimeType?.startsWith('audio/') ? (
                  (() => {
                    // Support both generic label/note and potential segments
                    const segments = task?.labels?.segments || [];
                    const hasSegments = segments.length > 0;

                    // If no segments, create a pseudo-segment from the main label/note
                    const items = hasSegments ? segments : [
                      {
                        label: task.labels?.label || 'Chưa gán nhãn',
                        note: task.labels?.note || '',
                        isGlobal: true
                      }
                    ];

                    const idx = Math.min(activeSentenceIdx, items.length - 1);
                    const item = items[idx];
                    const key = `${id}-${idx}`;
                    const status = sentenceStatus[key];
                    const isProcessing = !!processingSentences[key];
                    const feedback = sentenceFeedbacks[key] || '';
                    const audioUrl = `${API_URL}/${task.dataItem.path}`;

                    return (
                      <div className="flex flex-col h-full min-h-[450px]">
                        {/* Audio Player Section */}
                        <div className={`p-6 mb-6 rounded-3xl border-2 transition-all ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                          }`}>
                          <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 ${darkMode ? 'bg-gray-900 border-gray-700 text-blue-400' : 'bg-white border-white text-blue-600'
                              }`}>
                              🎧
                            </div>
                            <div className="flex-1">
                              <p className={`font-black truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.dataItem.filename}</p>
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Audio Source • {task.dataItem.mimeType}</p>
                              <audio controls src={audioUrl} className="w-full h-10 mt-4 filter drop-shadow-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Annotation Review Unit */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                            <span className={`text-[10px] font-black tracking-widest px-3 py-1.5 rounded-full ${darkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {item.isGlobal ? 'OVERALL LABEL' : `SEGMENT ${idx + 1} / ${items.length}`}
                            </span>
                            {hasSegments && (
                              <div className="flex gap-2">
                                <button onClick={() => setActiveSentenceIdx(prev => Math.max(0, prev - 1))} disabled={idx === 0} className="p-2 border rounded-xl disabled:opacity-30">←</button>
                                <button onClick={() => setActiveSentenceIdx(prev => Math.min(items.length - 1, prev + 1))} disabled={idx === items.length - 1} className="p-2 border rounded-xl disabled:opacity-30">→</button>
                              </div>
                            )}
                          </div>

                          <div className={`p-8 rounded-[2rem] border-2 flex flex-col items-center justify-center text-center space-y-4 ${status === 'approved'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : status === 'rejected'
                              ? 'bg-rose-500/5 border-rose-500/20'
                              : darkMode ? 'bg-gray-900/30 border-gray-700' : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'
                            }`}>
                            <span className={`px-6 py-2 rounded-full text-sm font-black uppercase tracking-tighter shadow-sm border ${darkMode ? 'bg-gray-800 text-blue-300 border-blue-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                              🏷️ Nhãn: {item.label}
                            </span>
                            <blockquote className={`text-xl font-bold leading-relaxed max-w-md ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              "{item.note || 'Không có ghi chú chi tiết'}"
                            </blockquote>
                            {item.startTime !== undefined && (
                              <p className="text-xs font-black text-gray-400 font-mono">
                                TIME: {item.startTime}s - {item.endTime}s
                              </p>
                            )}
                          </div>

                          {/* Action Area */}
                          <div className="mt-8 border-t pt-6">
                            {!status && !isReviewed ? (
                              <div className="space-y-4">
                                <textarea
                                  value={feedback}
                                  onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="Nhập phản hồi đánh giá cho nhãn audio này..."
                                  className={`w-full p-4 border rounded-2xl resize-none text-sm transition-all ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 focus:bg-white'
                                    }`}
                                  rows={2}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    onClick={() => handleSentenceAction(idx, 'approve', hasSegments ? 'segment' : 'audio')}
                                    disabled={isProcessing}
                                    className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1 disabled:opacity-50"
                                  >
                                    {isProcessing ? '⏳ DUYỆT...' : '✓ Approve'}
                                  </button>
                                  <button
                                    onClick={() => handleSentenceAction(idx, 'reject', hasSegments ? 'segment' : 'audio')}
                                    disabled={isProcessing || !feedback.trim()}
                                    className="py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-500/30 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0"
                                  >
                                    {isProcessing ? '⏳ TỪ CHỐI...' : '✕ Reject'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`p-6 rounded-2xl text-center border-2 ${status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                }`}>
                                <p className="font-black text-xl uppercase tracking-widest mb-2">
                                  {status === 'approved' ? '✅ Đã phê duyệt' : '❌ Đã từ chối'}
                                </p>
                                {feedback && <p className="text-sm italic opacity-80">"{feedback}"</p>}
                                {hasSegments && idx < items.length - 1 && (
                                  <button onClick={() => setActiveSentenceIdx(idx + 1)} className="mt-4 text-[10px] font-black uppercase border-b border-current">
                                    Next Segment →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : task?.dataItem?.mimeType?.startsWith('text/') || task?.dataItem?.text ? (
                  (() => {
                    const annotatedItems = task?.labels?.spans || task?.labels?.sentences || [];
                    const hasItems = annotatedItems.length > 0;

                    if (hasItems) {
                      const idx = Math.min(activeSentenceIdx, annotatedItems.length - 1);
                      const item = annotatedItems[idx];
                      const key = `${id}-${idx}`;
                      const status = sentenceStatus[key];
                      const isProcessing = !!processingSentences[key];
                      const feedback = sentenceFeedbacks[key] || '';
                      const itemText = item.text || item.sentence || '';
                      const itemLabel = item.label || 'No Label';

                      return (
                        <div className="flex flex-col h-full min-h-[400px]">
                          {/* Pagination Header */}
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                CÂU {idx + 1} / {annotatedItems.length}
                              </span>
                              {status && (
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${status === 'approved' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                  }`}>
                                  {status === 'approved' ? '✓ APPROVED' : '✕ REJECTED'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setActiveSentenceIdx(prev => Math.max(0, prev - 1))}
                                disabled={idx === 0}
                                className={`p-2 rounded-xl border transition-all ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-20' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-20 border-gray-200'}`}
                              >
                                ← Prev
                              </button>
                              <button
                                onClick={() => setActiveSentenceIdx(prev => Math.min(annotatedItems.length - 1, prev + 1))}
                                disabled={idx === annotatedItems.length - 1}
                                className={`p-2 rounded-xl border transition-all ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-20' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-20 border-gray-200'}`}
                              >
                                Next →
                              </button>
                            </div>
                          </div>

                          {/* Main Sentence Content */}
                          <div className="flex-1 flex flex-col justify-center items-center py-8">
                            <div className={`w-full p-8 rounded-3xl border-2 transition-all duration-500 relative ${status === 'approved'
                              ? darkMode ? 'bg-green-900/10 border-green-500/40 shadow-xl shadow-green-500/10' : 'bg-green-50/50 border-green-200 shadow-xl shadow-green-100'
                              : status === 'rejected'
                                ? darkMode ? 'bg-red-900/10 border-red-500/40 shadow-xl shadow-red-500/10' : 'bg-red-50/50 border-red-200 shadow-xl shadow-red-100'
                                : darkMode ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50/50 border-gray-200 shadow-xl'
                              }`}>
                              <blockquote className={`text-2xl font-semibold leading-relaxed text-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                "{itemText}"
                              </blockquote>

                              <div className="mt-8 flex flex-wrap justify-center gap-3">
                                <span className={`px-5 py-2 rounded-full text-xs font-bold shadow-md flex items-center gap-2 ${itemLabel.toLowerCase().includes('tích cực') || itemLabel.toLowerCase().includes('positive')
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : itemLabel.toLowerCase().includes('tiêu cực') || itemLabel.toLowerCase().includes('negative')
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  }`}>
                                  🏷️ {itemLabel}
                                </span>
                                {item.note && (
                                  <span className={`px-5 py-2 rounded-full text-[11px] font-medium ${darkMode ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-200 text-gray-600 border border-gray-300'}`}>
                                    Lưu chú: {item.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className={`mt-auto pt-8 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                            {!status && !isReviewed ? (
                              <div className="space-y-5">
                                <div className="relative group">
                                  <textarea
                                    value={feedback}
                                    onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))}
                                    placeholder="Nhập phản hồi đánh giá của bạn cho câu này..."
                                    className={`w-full p-5 border rounded-2xl resize-none text-sm font-medium focus:outline-none focus:ring-4 transition-all ${darkMode
                                      ? 'bg-gray-950 text-white border-gray-700 focus:ring-emerald-500/20'
                                      : 'bg-white text-gray-900 border-gray-300 focus:ring-emerald-500/10 focus:border-emerald-500'
                                      }`}
                                    rows={3}
                                  />
                                  <div className="absolute right-4 bottom-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">
                                    {feedback.length} chars
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    onClick={() => handleSentenceAction(idx, 'approve', task?.labels?.spans ? 'span' : 'sentence')}
                                    disabled={isProcessing}
                                    className="group relative overflow-hidden py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50"
                                  >
                                    <span className="relative z-10">{isProcessing ? '⏳ ĐANG DUYỆT...' : '✓ PHÊ DUYỆT CÂU NÀY'}</span>
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                  </button>
                                  <button
                                    onClick={() => handleSentenceAction(idx, 'reject', task?.labels?.spans ? 'span' : 'sentence')}
                                    disabled={isProcessing || !feedback.trim()}
                                    className="group relative overflow-hidden py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-rose-500/30 disabled:opacity-50"
                                    title={!feedback.trim() ? 'Bạn cần nhập phản hồi trước khi từ chối' : ''}
                                  >
                                    <span className="relative z-10">{isProcessing ? '⏳ ĐANG XỬ LÝ...' : '✕ TỪ CHỐI CÂU NÀY'}</span>
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`p-6 rounded-3xl text-center flex flex-col gap-3 group border-2 ${status === 'approved'
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                                : status === 'rejected'
                                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-500'
                                  : 'bg-gray-500/5 border-gray-500/20 text-gray-500'
                                }`}>
                                <div className="flex items-center justify-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black ${status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                    }`}>
                                    {status === 'approved' ? '✓' : '✕'}
                                  </div>
                                  <p className="font-black text-xl uppercase tracking-[0.2em]">
                                    {status === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối'}
                                  </p>
                                </div>
                                {feedback && (
                                  <div className={`mx-auto max-w-md p-3 rounded-xl text-sm font-bold border-l-4 ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-400' : 'bg-white border-gray-200 text-gray-600'
                                    }`}>
                                    " {feedback} "
                                  </div>
                                )}
                                <button
                                  onClick={() => setActiveSentenceIdx(prev => Math.min(annotatedItems.length - 1, prev + 1))}
                                  disabled={idx === annotatedItems.length - 1}
                                  className={`mt-4 mx-auto px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border-2 transition-all disabled:opacity-0 ${darkMode ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-200 hover:bg-white hover:border-emerald-500 text-gray-600 hover:text-emerald-500 shadow-sm'
                                    }`}
                                >
                                  Câu tiếp theo →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const rawText = task.dataItem?.text || task.dataItem?.content || '';
                    const sentences = splitSentences(rawText);
                    if (!sentences || sentences.length === 0) return <div className="text-center py-20 font-black opacity-20 text-4xl uppercase tracking-tighter">No Content Found</div>;

                    const sIdx = Math.min(activeSentenceIdx, sentences.length - 1);
                    const sent = sentences[sIdx];
                    const sKey = `${id}-${sIdx}`;
                    const sStatus = sentenceStatus[sKey];
                    const sIsProcessing = !!processingSentences[sKey];
                    const sFeedback = sentenceFeedbacks[sKey] || '';

                    return (
                      <div className="flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-4 border-b pb-4">
                          <span className="text-[10px] font-black tracking-widest bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                            AUTO-SEGMENT: {sIdx + 1} / {sentences.length}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => setActiveSentenceIdx(prev => Math.max(0, prev - 1))} className="w-10 h-10 flex items-center justify-center border-2 border-gray-200 rounded-xl font-bold hover:bg-white transition-all">←</button>
                            <button onClick={() => setActiveSentenceIdx(prev => Math.min(sentences.length - 1, prev + 1))} className="w-10 h-10 flex items-center justify-center border-2 border-gray-200 rounded-xl font-bold hover:bg-white transition-all">→</button>
                          </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-12 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-200 shadow-inner">
                          <p className="text-2xl font-bold italic text-gray-800 text-center leading-relaxed">"{sent}"</p>
                        </div>
                        <div className="mt-8 space-y-4">
                          {!sStatus && !isReviewed ? (
                            <>
                              <textarea
                                value={sFeedback}
                                onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [sKey]: e.target.value }))}
                                placeholder="Ghi chú đánh giá cho câu này..."
                                className="w-full p-5 border-2 border-gray-200 rounded-2xl focus:border-amber-500 focus:outline-none transition-all"
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <button
                                  onClick={() => handleSentenceAction(sIdx, 'approve', 'sentence')}
                                  disabled={sIsProcessing}
                                  className={`py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50`}
                                >
                                  {sIsProcessing ? '⏳ ĐANG LƯU...' : '✓ Approve'}
                                </button>
                                <button
                                  onClick={() => handleSentenceAction(sIdx, 'reject', 'sentence')}
                                  disabled={sIsProcessing || !sFeedback.trim()}
                                  className={`py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50`}
                                >
                                  {sIsProcessing ? '⏳ ĐANG LƯU...' : '✕ Reject'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="p-8 bg-gray-100/50 rounded-[2rem] text-center border-2 border-gray-200">
                              <p className="font-black text-2xl uppercase tracking-widest text-gray-400">
                                {sStatus === 'approved' ? '✅ Duyệt thành công' : '❌ Đã từ chối'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Unsupported data type
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quality Metrics & Error Classification */}
        <div className={`w-96 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} border-l overflow-y-auto`}>
          <div className="p-6 space-y-6">
            {/* Quality Metrics - Circular Progress */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  QUALITY METRICS
                </h3>
                <button
                  onClick={() => {
                    alert(`GIẢI THÍCH CÁC THÔNG SỐ:\n\n` +
                      `1. AVG CONFIDENCE: Độ tin cậy trung bình của tất cả các đối tượng được gán nhãn trong ảnh hiện tại.\n` +
                      `2. CLASSES: Tổng số đối tượng (objects) đã được gán nhãn trong ảnh.\n` +
                      `3. BATCH PROGRESS: Tiến độ xem xét - số task đã xem / tổng số task trong hàng đợi.\n` +
                      `4. ACCURACY: Tỷ lệ task được phê duyệt = Số task approved / Tổng số task đã review.\n` +
                      `   Hiện tại: ${reviewStats.approvedCount || 0} approved / ${reviewStats.totalReviewed || 0} reviewed = ${accuracy.toFixed(1)}%\n` +
                      `5. REJECTION: Tỷ lệ task bị từ chối = Số task rejected / Tổng số task đã review.\n` +
                      `   Hiện tại: ${reviewStats.rejectedCount || 0} rejected / ${reviewStats.totalReviewed || 0} reviewed = ${rejection.toFixed(1)}%\n\n` +
                      `Lưu ý: Các thông số này được tính dựa trên TẤT CẢ các task đã được bạn review (approved hoặc rejected), không chỉ các task trong hàng đợi hiện tại.`
                    );
                  }}
                  className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  title="Click để xem giải thích chi tiết về các thông số"
                >
                  ℹ️ Giải thích
                </button>
              </div>

              {/* Batch Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    title="Tiến độ xem xét: số task đã xem / tổng số task trong hàng đợi"
                  >
                    Batch Progress
                  </span>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {Math.round(batchProgress)}%
                  </span>
                </div>
                <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-3 overflow-hidden`}>
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                    style={{ width: `${Math.max(0, Math.min(100, batchProgress))}%` }}
                  ></div>
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {currentTaskIndex >= 0 ? `${currentTaskIndex + 1} / ${pendingTasks.length} tasks` : '0 / 0 tasks'}
                </div>
              </div>

              {/* Circular Progress Charts */}
              <div className="grid grid-cols-2 gap-4">
                {/* Accuracy */}
                <div
                  className="relative w-32 h-32 mx-auto cursor-help"
                  title={`Tỷ lệ task được phê duyệt: ${reviewStats.approvedCount || 0} approved / ${reviewStats.totalReviewed || 0} đã review = ${accuracy.toFixed(1)}%`}
                >
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#10b981"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(Math.min(100, Math.max(0, accuracy)) / 100) * 352} 352`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {accuracy.toFixed(1)}
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      ACCURACY
                    </span>
                  </div>
                </div>

                {/* Rejection */}
                <div
                  className="relative w-32 h-32 mx-auto cursor-help"
                  title={`Tỷ lệ task bị từ chối: ${reviewStats.rejectedCount || 0} rejected / ${reviewStats.totalReviewed || 0} đã review = ${rejection.toFixed(1)}%`}
                >
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#ef4444"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(Math.min(100, Math.max(0, rejection)) / 100) * 352} 352`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {rejection.toFixed(1)}%
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      REJECTION
                    </span>
                  </div>
                </div>
              </div>
              <div className={`text-xs mt-2 text-center ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                <span className="cursor-help" title="Hover vào các biểu đồ để xem giải thích chi tiết">
                  💡 Hover để xem giải thích
                </span>
                {reviewStats.totalReviewed > 0 && (
                  <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({reviewStats.approvedCount || 0} approved, {reviewStats.rejectedCount || 0} rejected)
                  </div>
                )}
              </div>
            </div>

            {/* Error Classification - Tiles with Icons */}
            <div>
              <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                ERROR CLASSIFICATION
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {errorTypes.map((errorType) => (
                  <button
                    key={errorType.id}
                    onClick={() => {
                      setSelectedError(errorType.id);
                      setErrorCategory(errorType.id);
                    }}
                    className={`p-4 rounded-xl transition-all duration-300 transform ${selectedError === errorType.id
                      ? darkMode
                        ? `bg-gradient-to-br ${errorType.color} text-white shadow-2xl scale-105 ring-4 ring-white/20`
                        : `bg-gradient-to-br ${errorType.color} text-white shadow-2xl scale-105`
                      : darkMode
                        ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:scale-102 border border-gray-600'
                        : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:scale-102 border border-gray-300/50'
                      }`}
                  >
                    <div className="text-3xl mb-2">{errorType.icon}</div>
                    <div className="text-xs font-bold mb-1">{errorType.name}</div>
                    <div className={`text-xs ${selectedError === errorType.id ? 'text-white/90' : (darkMode ? 'text-gray-400' : 'text-gray-600')}`}>
                      {errorType.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat-like Feedback System */}
            <div>
              <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                AUDITOR FEEDBACK
              </h3>
              <div className={`${darkMode ? 'bg-gray-900/50' : 'bg-white/40'} rounded-xl p-4 h-64 flex flex-col`}>
                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {chatMessages.length === 0 ? (
                    <div className={`text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      No feedback yet. Start typing...
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'reviewer' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.sender === 'reviewer'
                          ? darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                          : darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
                          }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={`text-xs mt-1 ${msg.sender === 'reviewer' ? (darkMode ? 'text-emerald-200' : 'text-emerald-100') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    )))
                  }
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Add rejection comment..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode
                      ? 'bg-gray-800 text-white border-gray-600 focus:border-emerald-500'
                      : 'bg-white text-gray-900 border-gray-300 focus:border-emerald-500'
                      } border focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                      }`}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Dock */}
      {!isReviewed && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl ${darkMode
          ? 'bg-gray-800/90 backdrop-blur-xl border border-gray-700'
          : 'bg-white/90 backdrop-blur-xl border border-gray-200/50'
          }`}>
          <button
            onClick={handleSkip}
            className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            <span className="mr-2"></span> Skip
          </button>
          <button
            onClick={handleReject}
            disabled={processing || !reviewComments.trim() || isReviewed}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : (!reviewComments.trim() ? 'Vui lòng nhập nhận xét trước khi từ chối' : '')}
          >
            <span className="mr-2">✕</span> Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || isReviewed}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : ''}
          >
            <span className="mr-2">✓</span> Approve Task
          </button>
          <div className={`flex items-center gap-2 ml-4 pl-4 border-l ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              AUTO-NEXT
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => setAutoNext(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`w-12 h-6 rounded-full peer transition-all ${autoNext
                ? darkMode ? 'bg-emerald-600' : 'bg-emerald-500'
                : darkMode ? 'bg-gray-700' : 'bg-gray-300'
                } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50`}>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${autoNext ? 'translate-x-6' : 'translate-x-0'
                  }`}></div>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerTask;