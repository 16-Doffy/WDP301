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
      if (taskData.sentenceFeedbacks) {
        const feedbacks = {};
        const statuses = {};
        Object.entries(taskData.sentenceFeedbacks).forEach(([key, fb]) => {
          const sentenceIndex = key.replace('sentence_', '');
          feedbacks[`${taskData._id}-${sentenceIndex}`] = fb.feedback || '';
          statuses[`${taskData._id}-${sentenceIndex}`] = fb.action;
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

  const handleApprove = useCallback(async () => {
    // Check if task has already been reviewed
    if (task?.status === 'approved' || task?.status === 'rejected') {
      alert('Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (window.confirm('Bạn có chắc muốn phê duyệt task này? Task sẽ được đánh dấu là approved và không thể chỉnh sửa nữa. Lưu ý: Mỗi task chỉ có thể được đánh giá 1 lần.')) {
      setProcessing(true);
      try {
        const payloadNotes = (reviewNotes && reviewNotes.length > 0)
          ? reviewNotes.map(n => ({
              bbox: n.bbox,
              label: n.label,
              comment: n.comment
            }))
          : [];
        await axios.post(`${API_URL}/api/reviews/${id}/approve`, {
          reviewComments: reviewComments.trim() || undefined,
          reviewNotes: payloadNotes,
        });
        alert('Đã phê duyệt task thành công!');
        // Refresh task data and tasks list to update statistics
        await fetchTask();
        await fetchAllTasks();
        // Stay on current page instead of navigating away
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Lỗi khi phê duyệt task';
        alert(errorMessage);
        console.error('Error approving task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, task, reviewComments, reviewNotes]);

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
  const isReviewed = task?.status === 'approved' || task?.status === 'rejected';
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

  const splitSentences = (text = '') =>
    text
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

  const handleSentenceAction = async (idx, action) => {
    const key = `${task?._id}-${idx}`;
    if (action === 'reject' && !sentenceFeedbacks[key]?.trim()) {
      alert('Vui lòng nhập feedback trước khi từ chối câu này.');
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn ${action} câu này?`)) return;

    setProcessingSentences(prev => ({ ...prev, [key]: true }));
    try {
      await axios.post(`${API_URL}/api/reviews/${task._id}/sentences`, {
        index: idx,
        action,
        feedback: sentenceFeedbacks[key]?.trim() || undefined,
      });
      setSentenceStatus(prev => ({ ...prev, [key]: action === 'approve' ? 'approved' : 'rejected' }));
      // refresh task data if needed
      await fetchTask();
      await fetchAllTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu đánh giá câu');
      console.error(err);
    } finally {
      setProcessingSentences(prev => ({ ...prev, [key]: false }));
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
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    isHovered
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
              <div className={`mb-4 p-4 rounded-xl border-2 ${
                task?.status === 'approved'
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
                          className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${
                            isActive
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
                    <div className={`mb-4 rounded-xl overflow-hidden transition-all duration-300 ${
                      hoveredObjectIndex !== null 
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
                ) : task?.dataItem?.mimeType?.startsWith('text/') || task?.dataItem?.text ? (
                  (() => {
                    // Check if we have sentence-level labels from annotator
                    if (task?.labels?.sentences && Array.isArray(task.labels.sentences) && task.labels.sentences.length > 0) {
                      console.log('Sentence labels from annotator:', task.labels.sentences);
                      
                      return (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                          {task.labels.sentences.map((sentenceLabel, idx) => {
                            const key = `${task._id}-${idx}`;
                            const status = sentenceStatus[key];
                            const processing = !!processingSentences[key];
                            const feedback = sentenceFeedbacks[key] || '';
                            
                            return (
                              <div 
                                key={key} 
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  status === 'approved'
                                    ? darkMode ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-300'
                                    : status === 'rejected'
                                      ? darkMode ? 'bg-red-900/20 border-red-500/50' : 'bg-red-50 border-red-300'
                                      : darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/60 border-gray-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className={`text-sm p-2 rounded flex-1 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'} leading-relaxed`}>
                                    "{sentenceLabel.text || sentenceLabel.sentence || ''}"
                                  </div>
                                  <span className={`text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap flex-shrink-0 ${
                                    sentenceLabel.label?.toLowerCase().includes('tích cực') || sentenceLabel.label?.toLowerCase().includes('positive')
                                      ? darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                                      : sentenceLabel.label?.toLowerCase().includes('tiêu cực') || sentenceLabel.label?.toLowerCase().includes('negative')
                                        ? darkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                                        : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    📌 {sentenceLabel.label}
                                  </span>
                                </div>
                                
                                {!status && (
                                  <>
                                    <textarea
                                      value={feedback}
                                      onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))
                                      }
                                      placeholder="Feedback (required to reject)"
                                      className={`w-full mb-3 p-2 border rounded resize-none text-sm focus:outline-none focus:ring-2 ${
                                        darkMode
                                          ? 'bg-gray-800 text-white border-gray-600 focus:ring-emerald-500/50'
                                          : 'bg-white text-gray-900 border-gray-300 focus:ring-emerald-500/30'
                                      }`}
                                      rows={2}
                                    />
                                    
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSentenceAction(idx, 'approve')}
                                        disabled={processing}
                                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {processing ? '⏳ Processing...' : '✓ Approve'}
                                      </button>
                                      <button
                                        onClick={() => handleSentenceAction(idx, 'reject')}
                                        disabled={processing || !feedback.trim()}
                                        className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={!feedback.trim() ? 'Feedback is required' : ''}
                                      >
                                        {processing ? '⏳ Processing...' : '✕ Reject'}
                                      </button>
                                    </div>
                                  </>
                                )}
                                
                                {status && (
                                  <div className={`p-2 rounded text-center font-bold text-sm ${
                                    status === 'approved'
                                      ? darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                                      : darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {status === 'approved' ? '✓ APPROVED' : '✕ REJECTED'}
                                    {feedback && (
                                      <div className={`text-xs mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Feedback: {feedback}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    // Fallback to old logic: split text by sentences
                    const rawText = task.dataItem?.text || task.dataItem?.content || '';
                    const sentences = splitSentences(rawText);
                    
                    if (!sentences || sentences.length === 0) {
                      return <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No text content found.</div>;
                    }

                    return (
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {sentences.map((sent, idx) => {
                          const key = `${task._id}-${idx}`;
                          const status = sentenceStatus[key];
                          const processing = !!processingSentences[key];
                          const feedback = sentenceFeedbacks[key] || '';
                          
                          return (
                            <div 
                              key={key} 
                              className={`p-4 rounded-lg border-2 transition-all ${
                                status === 'approved'
                                  ? darkMode ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-300'
                                  : status === 'rejected'
                                    ? darkMode ? 'bg-red-900/20 border-red-500/50' : 'bg-red-50 border-red-300'
                                    : darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/60 border-gray-300'
                              }`}
                            >
                              <div className={`text-sm mb-3 p-2 rounded ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'} leading-relaxed`}>
                                📝 Câu {idx + 1}: "{sent}"
                              </div>
                              
                              {!status && (
                                <>
                                  <textarea
                                    value={feedback}
                                    onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))
                                    }
                                    placeholder="Feedback (required to reject)"
                                    className={`w-full mb-3 p-2 border rounded resize-none text-sm focus:outline-none focus:ring-2 ${
                                      darkMode
                                        ? 'bg-gray-800 text-white border-gray-600 focus:ring-emerald-500/50'
                                        : 'bg-white text-gray-900 border-gray-300 focus:ring-emerald-500/30'
                                    }`}
                                    rows={2}
                                  />
                                  
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSentenceAction(idx, 'approve')}
                                      disabled={processing}
                                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {processing ? '⏳ Processing...' : '✓ Approve'}
                                    </button>
                                    <button
                                      onClick={() => handleSentenceAction(idx, 'reject')}
                                      disabled={processing || !feedback.trim()}
                                      className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={!feedback.trim() ? 'Feedback is required' : ''}
                                    >
                                      {processing ? '⏳ Processing...' : '✕ Reject'}
                                    </button>
                                  </div>
                                </>
                              )}
                              
                              {status && (
                                <div className={`p-2 rounded text-center font-bold text-sm ${
                                  status === 'approved'
                                    ? darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                                    : darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'
                                }`}>
                                  {status === 'approved' ? '✓ APPROVED' : '✕ REJECTED'}
                                  {feedback && (
                                    <div className={`text-xs mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      Feedback: {feedback}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                    className={`p-4 rounded-xl transition-all duration-300 transform ${
                      selectedError === errorType.id
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
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.sender === 'reviewer'
                            ? darkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                            : darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={`text-xs mt-1 ${msg.sender === 'reviewer' ? (darkMode ? 'text-emerald-200' : 'text-emerald-100') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Add rejection comment..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode 
                        ? 'bg-gray-800 text-white border-gray-600 focus:border-emerald-500' 
                        : 'bg-white text-gray-900 border-gray-300 focus:border-emerald-500'
                    } border focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      darkMode
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
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl ${
          darkMode 
            ? 'bg-gray-800/90 backdrop-blur-xl border border-gray-700' 
            : 'bg-white/90 backdrop-blur-xl border border-gray-200/50'
        }`}>
          <button
            onClick={handleSkip}
            className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
              darkMode
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
              <div className={`w-12 h-6 rounded-full peer transition-all ${
                autoNext
                  ? darkMode ? 'bg-emerald-600' : 'bg-emerald-500'
                  : darkMode ? 'bg-gray-700' : 'bg-gray-300'
              } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50`}>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${
                  autoNext ? 'translate-x-6' : 'translate-x-0'
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