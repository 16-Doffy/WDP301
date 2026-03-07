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

  const isTextTask = task?.dataItem?.mimeType?.startsWith('text/') || task?.dataItem?.text;
  const rawText = task?.dataItem?.text || task?.dataItem?.content || '';
  const annotatedItems = isTextTask
    ? (task?.labels?.spans || task?.labels?.sentences || (rawText ? splitSentences(rawText) : []))
    : [];

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
      {/* Top Header - Glassmorphism Design */}
      <div className={`${darkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-xl border-b px-6 py-3 flex items-center justify-between z-20 shadow-sm`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg ${darkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-500 text-white'}`}>
              {task?.dataItem?.mimeType?.startsWith('audio/') ? '🎵' : task?.dataItem?.mimeType?.startsWith('text/') ? '📝' : '🖼️'}
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Audit Station <span className="text-emerald-500">v2.0</span>
              </h1>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {task?.projectId?.name || 'Project Detail'}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2 hidden md:block"></div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="flex flex-col">
              <span className={`text-[10px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Status</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block text-center ${task?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                task?.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                {task?.status || 'Pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse bg-emerald-500`}></span>
            <span className={`text-xs font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {pendingTasks.length} TASKS IN QUEUE
            </span>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${darkMode
              ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600 shadow-lg shadow-black/20'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
              }`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          <button
            onClick={() => navigate('/reviewer/dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${darkMode
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
              }`}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Task Navigation & Objects */}
        <div className={`w-80 ${darkMode ? 'bg-gray-850 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col z-10`}>
          {/* Review Queue Tab-like header */}
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Review Queue
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                {pendingTasks.length} LEFT
              </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 thin-scrollbar">
              {pendingTasks.map((pt) => {
                const isActive = pt._id === id;
                return (
                  <button
                    key={pt._id}
                    onClick={() => navigate(`/reviewer/tasks/${pt._id}`)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${isActive
                      ? (darkMode ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200 shadow-sm')
                      : (darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50 border border-transparent')
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center text-lg`}>
                      {pt.dataItem?.mimeType?.startsWith('image/') ? (
                        <img src={`${API_URL}/${pt.dataItem?.path}`} className="w-full h-full object-cover" alt="" />
                      ) : pt.dataItem?.mimeType?.startsWith('audio/') ? '🎵' : '📝'}
                    </div>
                    <div className="text-left min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isActive ? (darkMode ? 'text-emerald-400' : 'text-emerald-700') : (darkMode ? 'text-gray-200' : 'text-gray-700')}`}>
                        TSK-{pt._id?.substring(pt._id.length - 6).toUpperCase()}
                      </p>
                      <p className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {pt.submittedAt ? getTimeAgo(new Date(pt.submittedAt)) : 'New'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-4 flex-1 flex flex-col min-h-0`}>
            <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Components / Labels
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 thin-scrollbar space-y-2">
              {task?.labels?.objects?.length > 0 ? (
                task.labels.objects.map((obj, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredObjectIndex(idx)}
                    onMouseLeave={() => setHoveredObjectIndex(null)}
                    className={`p-3 rounded-xl cursor-default transition-all ${hoveredObjectIndex === idx
                      ? (darkMode ? 'bg-emerald-500/10 border border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-emerald-50 border border-emerald-200 shadow-md')
                      : (darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100 shadow-sm')
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-black uppercase ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {obj.label || `OBJECT_${idx + 1}`}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                        CONF: {obj.confidence ? Math.round(obj.confidence * 100) : '—'}%
                      </span>
                    </div>
                    {obj.answer && <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-500 font-bold uppercase"><span className="w-1 h-1 rounded-full bg-emerald-500"></span> Verified</div>}
                  </div>
                ))
              ) : (
                <div className={`text-center py-10 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                  <p className="text-2xl mb-2">🔭</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest">No objects found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Image Viewer with Smart Highlight */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className={`flex-1 overflow-y-auto p-8 ${darkMode ? 'bg-gray-950' : 'bg-gray-50/30'}`}>
            {/* Status Banner - Ultra Slim & Integrated */}
            {isReviewed && (
              <div className={`mb-8 p-6 rounded-[2rem] border-2 transition-all shadow-2xl ${task?.status === 'approved'
                ? (darkMode ? 'bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5' : 'bg-emerald-50 border-emerald-200 shadow-emerald-500/10')
                : (darkMode ? 'bg-rose-500/5 border-rose-500/20 shadow-rose-500/5' : 'bg-rose-50 border-rose-200 shadow-rose-500/10')
                }`}>
                <div className="flex items-start gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${task?.status === 'approved'
                    ? 'bg-emerald-500 text-white shadow-emerald-400/50'
                    : 'bg-rose-500 text-white shadow-rose-400/50'
                    }`}>
                    {task?.status === 'approved' ? '✓' : '✕'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-black text-xl tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {task?.status === 'approved' ? 'AUDIT APPROVED' : 'AUDIT REJECTED'}
                      </h3>
                      <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500 border border-gray-200'
                        }`}>
                        Official Record
                      </span>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Verified on {task?.reviewedAt ? new Date(task.reviewedAt).toLocaleString('vi-VN') : '—'} by Reviewer
                    </p>

                    {task?.reviewComments && (
                      <div className={`mt-4 p-4 rounded-2xl border ${darkMode ? 'bg-gray-900/50 border-gray-800 text-gray-300' : 'bg-white border-gray-100 text-gray-700 shadow-sm'
                        }`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Auditor's Note</p>
                        <p className="text-sm font-medium italic">"{task.reviewComments}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-end justify-between border-b pb-6 dark:border-gray-800">
                <div>
                  <h2 className={`text-3xl font-black tracking-tighter mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {task?.dataItem?.mimeType?.startsWith('image/') ? 'Image Inspection' :
                      task?.dataItem?.mimeType?.startsWith('audio/') ? 'Acoustic Analysis' : 'Linguistic Audit'}
                  </h2>
                  <p className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-emerald-500' : 'text-emerald-600'}`}>
                    Source: {task?.dataItem?.filename || 'Untitled Task'} • {task?.dataItem?.mimeType}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Precision</p>
                    <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{averageConfidence.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Items</p>
                    <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task?.labels?.objects?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Main Content Card */}
              <div className={`${darkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-200'} rounded-[2.5rem] border p-1 shadow-2xl overflow-hidden`}>
                <div className={`h-full min-h-[500px] flex flex-col`}>
                  <div className="flex-1 p-8">
                    {/* Data type specific display */}
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
                    ) : task?.dataItem?.mimeType?.startsWith('audio/') ?
                      (() => {
                        const segments = task?.labels?.segments || [];
                        const hasSegments = segments.length > 0;
                        const items = hasSegments ? segments : [{
                          label: task.labels?.label || 'Unlabeled',
                          note: task.labels?.note || '',
                          isGlobal: true
                        }];

                        const idx = Math.min(activeSentenceIdx, items.length - 1);
                        const item = items[idx];
                        const key = `${id}-${idx}`;
                        const status = sentenceStatus[key];
                        const isProcessing = !!processingSentences[key];
                        const feedback = sentenceFeedbacks[key] || '';
                        const audioUrl = `${API_URL}/${task.dataItem.path}`;

                        return (
                          <div className="flex flex-col h-full">
                            {/* Audio Waveform/Player Area */}
                            <div className={`p-8 rounded-[2.5rem] mb-8 transition-all relative overflow-hidden ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100 shadow-xl shadow-gray-200/50'
                              }`}>
                              <div className="flex items-center gap-8 relative z-10">
                                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl ${darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500 text-white'
                                  }`}>
                                  🎧
                                </div>
                                <div className="flex-1">
                                  <p className={`text-xl font-black mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.dataItem.filename}</p>
                                  <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 rounded bg-gray-500/10 text-[9px] font-black uppercase tracking-widest text-gray-500">Audio Stream</span>
                                    <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></span>
                                    <span className="text-[10px] font-bold text-gray-400 capitalize">{task.dataItem.mimeType}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-8">
                                <audio controls src={audioUrl} className="w-full h-12 filter grayscale brightness-125 dark:invert" />
                              </div>
                              {/* Decorative subtle background waves */}
                              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                                <svg width="200" height="100" viewBox="0 0 200 100">
                                  <path d="M0 50 Q 50 20, 100 50 T 200 50" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                                  <path d="M0 60 Q 50 30, 100 60 T 200 60" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                                </svg>
                              </div>
                            </div>

                            {/* Annotation Review Unit */}
                            <div className="flex-1 flex flex-col pt-4">
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    }`}>
                                    {item.isGlobal ? 'Global Annotation' : `Segment ${idx + 1} of ${items.length}`}
                                  </div>
                                  {status && (
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                      }`}>
                                      {status}
                                    </div>
                                  )}
                                </div>

                                {hasSegments && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setActiveSentenceIdx(prev => Math.max(0, prev - 1))}
                                      disabled={idx === 0}
                                      className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white disabled:opacity-20' : 'bg-white border-gray-100 shadow-sm hover:border-emerald-500 disabled:opacity-30'
                                        }`}
                                    >
                                      ←
                                    </button>
                                    <button
                                      onClick={() => setActiveSentenceIdx(prev => Math.min(items.length - 1, prev + 1))}
                                      disabled={idx === items.length - 1}
                                      className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white disabled:opacity-20' : 'bg-white border-gray-100 shadow-sm hover:border-emerald-500 disabled:opacity-30'
                                        }`}
                                    >
                                      →
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className={`p-10 rounded-[3rem] border-2 transition-all duration-500 relative flex flex-col items-center text-center ${status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                status === 'rejected' ? 'bg-rose-500/5 border-rose-500/20' :
                                  darkMode ? 'bg-gray-901 border-gray-800' : 'bg-white border-gray-100 shadow-2xl shadow-gray-200/50'
                                }`}>
                                <div className="mb-6">
                                  <span className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl ${darkMode ? 'bg-gray-800 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-500 text-white'
                                    }`}>
                                    Label: {item.label}
                                  </span>
                                </div>

                                <blockquote className={`text-2xl font-bold leading-relaxed max-w-2xl mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                  "{item.note || 'No detailed note provided'}"
                                </blockquote>

                                {item.startTime !== undefined && (
                                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 font-mono tracking-tighter">
                                    <span className="bg-gray-500/10 px-2 py-0.5 rounded">START {item.startTime}s</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="bg-gray-500/10 px-2 py-0.5 rounded">END {item.endTime}s</span>
                                  </div>
                                )}
                              </div>

                              {/* Action Area */}
                              <div className={`mt-auto pt-10 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                                {!status && !isReviewed ? (
                                  <div className="space-y-6">
                                    <div className="relative">
                                      <textarea
                                        value={feedback}
                                        onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Add feedback for this specific audio element..."
                                        className={`w-full p-6 border-2 rounded-[2rem] resize-none text-sm transition-all outline-none ${darkMode
                                          ? 'bg-gray-950 border-gray-800 text-white focus:border-emerald-500/50'
                                          : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:shadow-xl focus:shadow-emerald-500/5'
                                          }`}
                                        rows={2}
                                      />
                                      <div className="absolute right-6 bottom-4 text-[9px] font-black uppercase tracking-widest text-gray-400 pointer-events-none">
                                        Segment Input
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                      <button
                                        onClick={() => handleSentenceAction(idx, 'approve', hasSegments ? 'segment' : 'audio')}
                                        disabled={isProcessing}
                                        className="group py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-emerald-500/40 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                                      >
                                        {isProcessing ? 'Saving...' : 'Approve Unit'}
                                      </button>
                                      <button
                                        onClick={() => handleSentenceAction(idx, 'reject', hasSegments ? 'segment' : 'audio')}
                                        disabled={isProcessing || !feedback.trim()}
                                        className="group py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-rose-500/40 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                                      >
                                        {isProcessing ? 'Processing...' : 'Reject Unit'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`p-8 rounded-[2rem] text-center border-2 flex items-center justify-between ${status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                    }`}>
                                    <div className="text-left">
                                      <p className="font-black text-xs uppercase tracking-widest mb-1 opacity-60">Status Result</p>
                                      <p className="font-black text-2xl uppercase tracking-tighter">
                                        {status === 'approved' ? 'Approved Unit' : 'Rejected Unit'}
                                      </p>
                                      {feedback && <p className="text-sm font-medium mt-2 italic">" {feedback} "</p>}
                                    </div>

                                    {hasSegments && idx < items.length - 1 && (
                                      <button
                                        onClick={() => setActiveSentenceIdx(idx + 1)}
                                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${darkMode ? 'bg-white/10 hover:bg-white text-white hover:text-black' : 'bg-black text-white hover:bg-gray-800'
                                          }`}
                                      >
                                        Next Unit →
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()
                      : (task?.dataItem?.mimeType?.startsWith('text/') || task?.dataItem?.text) ?
                        (() => {
                          const currentAnnotatedItems = task?.labels?.spans || task?.labels?.sentences || [];
                          const hasItems = currentAnnotatedItems.length > 0;

                          if (hasItems) {
                            const idx = Math.min(activeSentenceIdx, currentAnnotatedItems.length - 1);
                            const item = currentAnnotatedItems[idx];
                            const key = `${id}-${idx}`;
                            const status = sentenceStatus[key];
                            const isProcessing = !!processingSentences[key];
                            const feedback = sentenceFeedbacks[key] || '';
                            const itemText = item.text || item.sentence || '';
                            const itemLabel = item.label || 'No Label';

                            return (
                              <div className="flex flex-col h-full min-h-[400px]">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                      CÂU {idx + 1} / {currentAnnotatedItems.length}
                                    </span>
                                    {status && (
                                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${status === 'approved' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>
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
                                      onClick={() => setActiveSentenceIdx(prev => Math.min(currentAnnotatedItems.length - 1, prev + 1))}
                                      disabled={idx === currentAnnotatedItems.length - 1}
                                      className={`p-2 rounded-xl border transition-all ${darkMode ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-20' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-20 border-gray-200'}`}
                                    >
                                      Next →
                                    </button>
                                  </div>
                                </div>

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

                                <div className={`mt-auto pt-8 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                  {!status && !isReviewed ? (
                                    <div className="space-y-5">
                                      <div className="relative group">
                                        <textarea
                                          value={feedback}
                                          onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [key]: e.target.value }))}
                                          placeholder="Nhập phản hồi đánh giá của bạn cho câu này..."
                                          className={`w-full p-5 border rounded-2xl resize-none text-sm font-medium focus:outline-none focus:ring-4 transition-all ${darkMode ? 'bg-gray-950 text-white border-gray-700 focus:ring-emerald-500/20' : 'bg-white text-gray-900 border-gray-300 focus:ring-emerald-500/10 focus:border-emerald-500'}`}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <button
                                          onClick={() => handleSentenceAction(idx, 'approve', task?.labels?.spans ? 'span' : 'sentence')}
                                          disabled={isProcessing}
                                          className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/30"
                                        >
                                          {isProcessing ? '⏳ DUYỆT...' : '✓ PHÊ DUYỆT'}
                                        </button>
                                        <button
                                          onClick={() => handleSentenceAction(idx, 'reject', task?.labels?.spans ? 'span' : 'sentence')}
                                          disabled={isProcessing || !feedback.trim()}
                                          className="py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-500/30"
                                        >
                                          {isProcessing ? '⏳ XỬ LÝ...' : '✕ TỪ CHỐI'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`p-6 rounded-3xl text-center flex flex-col gap- group border-2 ${status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'}`}>
                                      <div className="flex items-center justify-center gap-3">
                                        <p className="font-black text-xl uppercase tracking-widest">
                                          {status === 'approved' ? '✓ Đã phê duyệt' : '✕ Đã từ chối'}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          }

                          const rawText = task.dataItem?.text || task.dataItem?.content || ''
                          const sentences = splitSentences(rawText)
                          if (!sentences || sentences.length === 0) return <div className="text-center py-20 font-black opacity-20 text-4xl uppercase tracking-tighter">No Content Found</div>

                          const sIdx = Math.min(activeSentenceIdx, sentences.length - 1)
                          const sent = sentences[sIdx]
                          const sKey = `${id}-${sIdx}`
                          const sStatus = sentenceStatus[sKey]
                          const sIsProcessing = !!processingSentences[sKey]
                          const sFeedback = sentenceFeedbacks[sKey] || ''

                          return (
                            <div className="flex flex-col h-full min-h-[400px]">
                              <div className="flex items-center justify-between mb-4 border-b pb-4">
                                <span className="text-[10px] font-black tracking-widest bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                                  AUTO-SEGMENT: {sIdx + 1} / {sentences.length}
                                </span>
                                <div className="flex gap-2">
                                  <button onClick={() => setActiveSentenceIdx(prev => Math.max(0, prev - 1))} className="w-10 h-10 flex items-center justify-center border-2 border-gray-200 rounded-xl font-bold">←</button>
                                  <button onClick={() => setActiveSentenceIdx(prev => Math.min(sentences.length - 1, prev + 1))} className="w-10 h-10 flex items-center justify-center border-2 border-gray-200 rounded-xl font-bold">→</button>
                                </div>
                              </div>
                              <div className="flex-1 flex items-center justify-center p-12 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                                <p className="text-2xl font-bold italic text-gray-800 text-center leading-relaxed">"{sent}"</p>
                              </div>
                              <div className="mt-8 space-y-4">
                                {!sStatus && !isReviewed ? (
                                  <>
                                    <textarea
                                      value={sFeedback}
                                      onChange={(e) => setSentenceFeedbacks(prev => ({ ...prev, [sKey]: e.target.value }))}
                                      placeholder="Ghi chú đánh giá cho câu này..."
                                      className="w-full p-5 border-2 border-gray-200 rounded-2xl focus:border-amber-500 focus:outline-none"
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                      <button onClick={() => handleSentenceAction(sIdx, 'approve', 'sentence')} disabled={sIsProcessing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase">Approve</button>
                                      <button onClick={() => handleSentenceAction(sIdx, 'reject', 'sentence')} disabled={sIsProcessing || !sFeedback.trim()} className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase">Reject</button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="p-8 bg-gray-100/50 rounded-[2rem] text-center border-2 border-gray-200">
                                    <p className="font-black text-2xl uppercase tracking-widest text-gray-400">
                                      {sStatus === 'approved' ? '✅ Approved' : '❌ Rejected'}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()
                        : (
                          <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Unsupported data type
                          </div>
                        )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Right Sidebar - Quality Metrics & Error Classification */}
        <div className={`w-96 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} border-l overflow-y-auto`}>
          <div className="p-6 space-y-6">
            {/* Text Annotations List - Only for Text tasks */}
            {isTextTask && annotatedItems.length > 0 && (
              <div className="mb-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    TEXT ANNOTATIONS
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${darkMode ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                    {annotatedItems.length} ITEMS
                  </span>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {annotatedItems.map((item, idx) => {
                    const isActive = activeSentenceIdx === idx;
                    const itemText = typeof item === 'string' ? item : (item.text || item.sentence || '');
                    const itemLabel = typeof item === 'string' ? 'Unlabeled' : (item.label || 'No Label');
                    const key = `${id}-${idx}`;
                    const status = sentenceStatus[key];

                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveSentenceIdx(idx)}
                        className={`group p-4 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${isActive
                          ? darkMode
                            ? 'bg-emerald-600/20 border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : 'bg-emerald-50 border-emerald-400 shadow-md'
                          : darkMode
                            ? 'bg-gray-700/30 border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
                            : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white/80 shadow-sm'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${isActive ? 'bg-emerald-500 text-white' : (darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')
                              }`}>
                              {idx + 1}
                            </span>
                            {status && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                {status === 'approved' ? '✓' : '✕'}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${itemLabel.toLowerCase().includes('tích cực') || itemLabel.toLowerCase().includes('positive')
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : itemLabel.toLowerCase().includes('tiêu cực') || itemLabel.toLowerCase().includes('negative')
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}>
                            {itemLabel}
                          </span>
                        </div>
                        <p className={`text-xs ml-8 leading-relaxed line-clamp-2 ${isActive ? (darkMode ? 'text-white font-medium' : 'text-gray-900 font-medium') : (darkMode ? 'text-gray-400' : 'text-gray-600')
                          }`}>
                          {itemText}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className={`h-px w-full mt-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
              </div>
            )}

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