import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageViewer from '../../components/ImageViewer';
import AudioAnnotator from '../../components/AudioAnnotator';
import { useAuth } from '../../context/AuthContext';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [autoNext, setAutoNext] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [hoveredObjectIndex, setHoveredObjectIndex] = useState(null);
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [issueTargets, setIssueTargets] = useState({});
  const [issueComments, setIssueComments] = useState({});
  const carouselRef = useRef(null);
  const [carouselScroll, setCarouselScroll] = useState(0);
  const [sentenceFeedbacks, setSentenceFeedbacks] = useState({});
  const [sentenceStatus, setSentenceStatus] = useState({});
  const [processingSentences, setProcessingSentences] = useState({});
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [localReviewed, setLocalReviewed] = useState(false);
  const [primaryQueued, setPrimaryQueued] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [annotatorVisibility, setAnnotatorVisibility] = useState({});
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [showAnnotatorLabels, setShowAnnotatorLabels] = useState(false);
  const [activeAnnotatorId, setActiveAnnotatorId] = useState('');

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopedProjectId = searchParams.get('projectId') || '';
  const scopedDatasetId = searchParams.get('datasetId') || '';
  const scopedAnnotatorId = searchParams.get('annotatorId') || '';
  const scopedAnnotatorIds = searchParams.get('annotatorIds') || '';
  const reviewOnly = searchParams.get('reviewOnly') === '1';

  useEffect(() => {
    setLocalReviewed(false);
    setSelectedIssues([]);
    setIssueTargets({});
    setIssueComments({});
    setReviewComments('');
    setReviewNotes([]);
    setSentenceFeedbacks({});
    setSentenceStatus({});
    setProcessingSentences({});
    setActiveSentenceIdx(0);
    setShowAnnotatorLabels(false);
    setActiveAnnotatorId('');
    fetchTask();
    fetchAllTasks();
    fetchRelatedTasks();
  }, [id, scopedProjectId, scopedDatasetId, scopedAnnotatorId, scopedAnnotatorIds]);

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

  const datasetType = (task?.dataItem?.mimeType || '').startsWith('image/')
    ? 'image'
    : (task?.dataItem?.mimeType || '').startsWith('audio/')
      ? 'audio'
      : ((task?.dataItem?.mimeType || '').startsWith('text/') || !!task?.dataItem?.text)
        ? 'text'
        : 'image';

  const issueCatalogByType = {
    image: [
      { id: 'missing_object', label: 'Missed Object', needsTarget: false },
      { id: 'wrong_class', label: 'Wrong Class', needsTarget: true, targetLabel: 'Affected Object ID' },
      { id: 'bbox_loose', label: 'Bounding Box Too Loose', needsTarget: true, targetLabel: 'Affected Object ID' },
      { id: 'bbox_tight', label: 'Bounding Box Too Tight', needsTarget: true, targetLabel: 'Affected Object ID' },
      { id: 'wrong_overlap', label: 'Wrong Overlap Handling', needsTarget: true, targetLabel: 'Affected Object ID' },
    ],
    audio: [
      { id: 'wrong_label', label: 'Wrong Label', needsTarget: true, targetLabel: 'Segment ID' },
      { id: 'incorrect_timestamp', label: 'Incorrect Timestamp', needsTarget: true, targetLabel: 'Segment ID' },
      { id: 'overlapping_segments', label: 'Overlapping Segments', needsTarget: true, targetLabel: 'Segment ID' },
      { id: 'missing_segment', label: 'Missing Segment', needsTarget: false },
      { id: 'noise_misclassified', label: 'Background Noise Misclassified', needsTarget: true, targetLabel: 'Segment ID' },
    ],
    text: [
      { id: 'wrong_category', label: 'Wrong Category', needsTarget: true, targetLabel: 'Entity ID' },
      { id: 'missing_entity', label: 'Missing Entity', needsTarget: false },
      { id: 'wrong_span', label: 'Wrong Span', needsTarget: true, targetLabel: 'Entity ID' },
      { id: 'overlapping_entity', label: 'Overlapping Entity', needsTarget: true, targetLabel: 'Entity ID' },
      { id: 'incorrect_classification', label: 'Incorrect Classification', needsTarget: true, targetLabel: 'Entity ID' },
    ],
  };

  const issueOptions = issueCatalogByType[datasetType] || issueCatalogByType.image;
  const targetOptions = datasetType === 'image'
    ? (task?.labels?.objects || []).map((obj, idx) => ({ id: `object_${idx + 1}`, label: `Object #${idx + 1} (${obj.label || 'Unknown'})` }))
    : datasetType === 'audio'
      ? ((task?.labels?.segments || []).length > 0
        ? (task?.labels?.segments || []).map((_, idx) => ({ id: `segment_${idx + 1}`, label: `Segment #${idx + 1}` }))
        : [{ id: 'segment_1', label: 'Segment #1' }])
      : ((task?.labels?.spans || task?.labels?.sentences || []).map((_, idx) => ({ id: `entity_${idx + 1}`, label: `Entity #${idx + 1}` })));

  const selectedIssueDetails = selectedIssues
    .map((issueId) => issueOptions.find((i) => i.id === issueId))
    .filter(Boolean);

  const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string') return `rgba(59,130,246,${alpha})`;
    const normalized = hex.replace('#', '');
    if (![3, 6].includes(normalized.length)) return `rgba(59,130,246,${alpha})`;

    const full = normalized.length === 3
      ? normalized.split('').map((ch) => ch + ch).join('')
      : normalized;

    const intVal = parseInt(full, 16);
    if (Number.isNaN(intVal)) return `rgba(59,130,246,${alpha})`;

    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const imageClassSummary = (() => {
    const objects = task?.labels?.objects || [];
    const map = {};
    objects.forEach((o) => {
      const key = o?.label || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map);
  })();

  const audioSegments = task?.labels?.segments || [];
  const textEntities = task?.labels?.spans || task?.labels?.sentences || [];

  const fetchAllTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/all`);
      let pending = response.data.pending || [];
      let reviewed = response.data.reviewed || [];

      if (scopedProjectId) {
        pending = pending.filter((t) => (t?.projectId?._id || t?.projectId)?.toString() === scopedProjectId);
        reviewed = reviewed.filter((t) => (t?.projectId?._id || t?.projectId)?.toString() === scopedProjectId);
      }
      if (scopedDatasetId) {
        pending = pending.filter((t) => (t?.datasetId?._id || t?.datasetId)?.toString() === scopedDatasetId);
        reviewed = reviewed.filter((t) => (t?.datasetId?._id || t?.datasetId)?.toString() === scopedDatasetId);
      }
      if (scopedAnnotatorId) {
        pending = pending.filter((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString() === scopedAnnotatorId);
        reviewed = reviewed.filter((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString() === scopedAnnotatorId);
      }

      setPendingTasks(pending);
      setReviewedTasks(reviewed);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const buildFileUrl = (dataItem) => {
    if (!dataItem) return '';
    const baseUrl = API_URL.replace(/\/+$/, '');
    if (dataItem.imageUrl) {
      const cleanImageUrl = dataItem.imageUrl.replace(/^\/+/, '');
      return `${baseUrl}/${cleanImageUrl}`;
    }
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

  const fetchRelatedTasks = async () => {
    if (!id) return;
    setRelatedLoading(true);
    try {
      const query = new URLSearchParams();
      if (scopedAnnotatorIds) query.set('annotatorIds', scopedAnnotatorIds);
      const qs = query.toString();
      const res = await axios.get(`${API_URL}/api/tasks/${id}/related${qs ? `?${qs}` : ''}`);
      let tasks = (res.data || []).filter((t) => t?.status === 'submitted');

      if (scopedAnnotatorId) {
        tasks = tasks.filter((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() === scopedAnnotatorId);
      } else if (scopedAnnotatorIds) {
        const allowedIds = scopedAnnotatorIds.split(',').map((val) => val.trim()).filter(Boolean);
        tasks = tasks.filter((t) => allowedIds.includes((t?.annotatorId?._id || t?.annotatorId)?.toString?.()));
      }

      setRelatedTasks(tasks);
      const visibility = {};
      tasks.forEach((t) => {
        const aid = t?.annotatorId?._id || t?.annotatorId;
        if (aid) visibility[aid] = true;
      });
      setAnnotatorVisibility(visibility);
      if (scopedAnnotatorId) {
        setActiveAnnotatorId(scopedAnnotatorId);
      } else if (tasks.length === 1) {
        const onlyId = tasks[0]?.annotatorId?._id || tasks[0]?.annotatorId || '';
        setActiveAnnotatorId(onlyId);
      }
    } catch (err) {
      console.error('Error fetching related tasks:', err);
      setRelatedTasks([]);
      setAnnotatorVisibility({});
    } finally {
      setRelatedLoading(false);
    }
  };

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      let taskData = response.data;

      // If mimeType is text/plain but no text content, fetch from file
      if (taskData.dataItem?.mimeType === 'text/plain' && !taskData.dataItem?.text) {
        try {
          const fileResp = await axios.get(buildFileUrl(taskData.dataItem), {
            responseType: 'text'
          });
          taskData.dataItem.text = fileResp.data;
        } catch (err) {
          console.error('Error fetching text file:', err);
        }
      }

      setTask(taskData);

      const myReviewerEntry = Array.isArray(taskData.reviewers)
        ? taskData.reviewers.find((r) => {
          const rid = r?.reviewerId?._id || r?.reviewerId;
          return rid?.toString?.() === user?._id?.toString?.();
        })
        : null;

      // Blind-review mode: each reviewer only sees own vote/comment before finalization.
      const isFinalized = taskData.status === 'approved' || taskData.status === 'rejected';
      if (isFinalized) {
        setReviewNotes(taskData.reviewNotes || []);
        setReviewComments(taskData.reviewComments || '');
      } else {
        setReviewNotes([]);
        setReviewComments(myReviewerEntry?.comment || '');
      }

      // Load existing sentence feedbacks (blind-review aware)
      setSentenceFeedbacks({});
      setSentenceStatus({});
      if (taskData.sentenceFeedbacks) {
        const feedbacks = {};
        const statuses = {};

        Object.entries(taskData.sentenceFeedbacks).forEach(([key, fb]) => {
          const index = key.toString()
            .replace('sentence_', '')
            .replace('span_', '')
            .replace('audio_', '')
            .replace('segment_', '');

          const uiKey = `${id}-${index}`;
          const feedbackBy = fb?.reviewerId?.toString?.();
          const isMine = feedbackBy && feedbackBy === user?._id?.toString?.();
          const isFinalized = taskData.status === 'approved' || taskData.status === 'rejected';

          if (!isFinalized && !isMine) {
            return;
          }

          feedbacks[uiKey] = fb.feedback || '';

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

  const myReviewerEntry = Array.isArray(task?.reviewers)
    ? task.reviewers.find((r) => {
      const rid = r?.reviewerId?._id || r?.reviewerId;
      return rid?.toString?.() === user?._id?.toString?.();
    })
    : null;

  const hasMyDecision = myReviewerEntry && myReviewerEntry.status !== 'pending';
  const isFinalized = task?.status === 'approved' || task?.status === 'rejected';
  const isReviewed = localReviewed || isFinalized || hasMyDecision;
  const isMyApproved = myReviewerEntry?.status === 'approved' || task?.status === 'approved';

  // pendingTasks from /api/reviews/all is already scoped to current reviewer queue.
  const actionablePendingTasks = reviewOnly
    ? []
    : (pendingTasks || []).filter((t) => t?.status === 'submitted');

  const goToNextPendingTask = useCallback(() => {
    if (!Array.isArray(actionablePendingTasks) || actionablePendingTasks.length === 0) {
      navigate('/reviewer/dashboard');
      return;
    }

    const currentIndex = actionablePendingTasks.findIndex((t) => t._id === id);
    const scopeQuery = new URLSearchParams();
    if (scopedProjectId) scopeQuery.set('projectId', scopedProjectId);
    if (scopedDatasetId) scopeQuery.set('datasetId', scopedDatasetId);
    if (scopedAnnotatorId) scopeQuery.set('annotatorId', scopedAnnotatorId);
    const query = scopeQuery.toString();

    if (currentIndex >= 0 && currentIndex < actionablePendingTasks.length - 1) {
      navigate(`/reviewer/tasks/${actionablePendingTasks[currentIndex + 1]._id}${query ? `?${query}` : ''}`);
      return;
    }

    if (currentIndex === -1 && actionablePendingTasks.length > 0) {
      navigate(`/reviewer/tasks/${actionablePendingTasks[0]._id}${query ? `?${query}` : ''}`);
      return;
    }

    navigate('/reviewer/dashboard');
  }, [actionablePendingTasks, id, navigate, scopedProjectId, scopedDatasetId, scopedAnnotatorId]);

  const handleApprove = useCallback(async () => {
    if (processing || isReviewed) {
      alert('Task này đã được đánh giá rồi.');
      return;
    }

    if (activeAnnotatorCount > 1) {
      alert('Bạn chỉ có thể Approve/Reject khi đang chọn đúng 1 annotator.');
      return;
    }

    const targetTaskId = activeAnnotatorId
      ? (relatedTasks.find((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() === activeAnnotatorId.toString?.())?._id || id)
      : id;

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

      const response = await axios.post(`${API_URL}/api/reviews/${targetTaskId}/approve`, {
        reviewComments: reviewComments.trim() || undefined,
        reviewNotes: payloadNotes,
      }, { timeout: 15000 });

      if (response.status === 200 || response.status === 201) {
        if (primaryQueued && targetTaskId === id) {
          try {
            await axios.post(`${API_URL}/api/reviews/${id}/primary`);
          } catch (err) {
            console.error('Error setting primary after approve:', err);
            alert('Approve thành công nhưng không thể đặt ảnh chính. Vui lòng thử lại.');
          }
        }
        setLocalReviewed(true);
        setPrimaryQueued(false);
        alert('Đã phê duyệt task thành công!');
        await fetchAllTasks();
        await fetchRelatedTasks();
        if (autoNext) {
          goToNextPendingTask();
        } else {
          await fetchTask();
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Lỗi khi phê duyệt';
      const alreadyReviewed = /already submitted your review decision|already been submitted|đã được đánh giá|đã gửi quyết định/i.test(msg);
      if (alreadyReviewed) {
        setLocalReviewed(true);
        await fetchAllTasks();
        await fetchRelatedTasks();
        if (autoNext) {
          goToNextPendingTask();
        } else {
          await fetchTask();
        }
        alert('Task này đã được bạn chấm trước đó. Mình đã đồng bộ lại trạng thái.');
      } else {
        alert(`Không thể hoàn tất: ${msg}`);
      }
      console.error(error);
    } finally {
      setProcessing(false);
    }
  }, [id, reviewComments, reviewNotes, isReviewed, autoNext, fetchAllTasks, fetchTask, fetchRelatedTasks, goToNextPendingTask, processing, primaryQueued, activeAnnotatorId, relatedTasks]);

  const handleReject = useCallback(async () => {
    if (processing || isReviewed || task?.status === 'approved' || task?.status === 'rejected') {
      alert('Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (activeAnnotatorCount > 1) {
      alert('Bạn chỉ có thể Approve/Reject khi đang chọn đúng 1 annotator.');
      return;
    }

    if (selectedIssues.length === 0) {
      alert('Reject bắt buộc chọn ít nhất 1 lỗi.');
      return;
    }

    if (!reviewComments.trim()) {
      alert('Reject bắt buộc có comment tổng quan.');
      return;
    }

    const targetTaskId = activeAnnotatorId
      ? (relatedTasks.find((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() === activeAnnotatorId.toString?.())?._id || id)
      : id;

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

        const issues = selectedIssues.map((issueId) => {
          const issueMeta = issueOptions.find((i) => i.id === issueId);
          return {
            type: issueMeta?.label || issueId,
            targetId: issueTargets[issueId] || undefined,
            comment: issueComments[issueId]?.trim() || undefined,
          };
        });

        const firstIssue = issues[0]?.type?.toLowerCase?.() || 'other';
        const backendErrorCategory = firstIssue.includes('class')
          ? 'incorrect_label'
          : firstIssue.includes('miss')
            ? 'missing_label'
            : firstIssue.includes('box') || firstIssue.includes('tight') || firstIssue.includes('loose')
              ? 'poor_quality'
              : 'does_not_follow_guidelines';

        await axios.post(`${API_URL}/api/reviews/${targetTaskId}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: backendErrorCategory,
          reviewNotes: payloadNotes,
          review: {
            taskId: targetTaskId,
            datasetType,
            status: 'rejected',
            issues,
            overallComment: reviewComments.trim(),
          },
        });
        setLocalReviewed(true);
        alert('Đã từ chối task thành công!');
        await fetchAllTasks();
        await fetchRelatedTasks();
        if (autoNext) {
          goToNextPendingTask();
        } else {
          await fetchTask();
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Lỗi khi từ chối task';
        const alreadyReviewed = /already submitted your review decision|already been submitted|đã được đánh giá|đã gửi quyết định/i.test(errorMessage);
        if (alreadyReviewed) {
          setLocalReviewed(true);
          await fetchAllTasks();
          await fetchRelatedTasks();
          if (autoNext) {
            goToNextPendingTask();
          } else {
            await fetchTask();
          }
          alert('Task này đã được bạn chấm trước đó. Mình đã đồng bộ lại trạng thái.');
        } else {
          alert(errorMessage);
        }
        console.error('Error rejecting task:', error);
      } finally {
        setProcessing(false);
      }
    }
  }, [id, task, reviewComments, reviewNotes, selectedIssues, issueOptions, issueTargets, issueComments, datasetType, autoNext, fetchAllTasks, fetchTask, fetchRelatedTasks, goToNextPendingTask, processing, isReviewed, activeAnnotatorId, relatedTasks]);

  const handleSkip = () => {
    goToNextPendingTask();
  };

  const handleSetPrimary = async () => {
    if (processing) return;

    if (!isMyApproved) {
      const confirmQueue = window.confirm('Bạn muốn đánh dấu ảnh này làm ảnh chính và sẽ áp dụng khi Approve Task?');
      if (!confirmQueue) return;
      setPrimaryQueued(prev => !prev);
      return;
    }

    if (!window.confirm('Đặt ảnh/nhãn của annotator này làm ảnh chính cho item?')) return;

    setProcessing(true);
    try {
      await axios.post(`${API_URL}/api/reviews/${id}/primary`);
      alert('Đã đặt ảnh chính. Manager sẽ thấy ngay trong dataset.');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Lỗi khi đặt ảnh chính';
      alert(msg);
    } finally {
      setProcessing(false);
    }
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

  const visibleRelatedTasks = useMemo(() => {
    if (!relatedTasks || relatedTasks.length === 0) return [];
    return relatedTasks.filter((t) => {
      const aid = t?.annotatorId?._id || t?.annotatorId;
      return aid ? annotatorVisibility[aid] !== false : true;
    });
  }, [relatedTasks, annotatorVisibility]);

  const combinedAnnotations = useMemo(() => {
    if (visibleRelatedTasks.length === 0) return [];
    return visibleRelatedTasks.flatMap((t, tIdx) => {
      const aid = t?.annotatorId?._id || t?.annotatorId || `ann_${tIdx}`;
      const labelSet = t?.projectId?.labelSet || [];
      const color = labelSet.find((l) => l?.name)?.color;
      return (t?.labels?.objects || []).map((obj, idx) => ({
        id: `${aid}_${idx}`,
        bbox: obj.bbox,
        label: `${obj.label || 'Unknown'} • ${t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator'}`,
        annotatorId: aid,
        color,
      }));
    });
  }, [visibleRelatedTasks]);

  const activeAnnotatorCount = useMemo(() => {
    if (!relatedTasks || relatedTasks.length === 0) return 1;
    return relatedTasks.reduce((count, t) => {
      const aid = t?.annotatorId?._id || t?.annotatorId;
      if (!aid) return count;
      return annotatorVisibility[aid] !== false ? count + 1 : count;
    }, 0);
  }, [relatedTasks, annotatorVisibility]);

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
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-[#0f172a]' : 'bg-[#0f172a]'}`}>
        <div className={`animate-spin rounded-full h-16 w-16 border-4 ${darkMode ? 'border-emerald-400 border-t-transparent' : 'border-emerald-500 border-t-transparent'}`}></div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-[#0f172a]' : 'bg-[#0f172a]'}`}>
      {/* Top Header - Dynamic Style */}
      <div className={`${darkMode ? 'bg-[#1e293b] border-slate-700 shadow-[0_0_0_1px_rgba(59,130,246,0.1)]' : 'bg-[#1e293b] border-slate-700'} border-b px-6 py-4 flex items-center justify-between z-10`}>
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

            <div className="grid grid-cols-12 gap-4">
              {/* Annotator Output - Made bigger */}
              <div className={`col-span-9 ${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/60 backdrop-blur-lg border-gray-200/50'} rounded-2xl border p-6 shadow-xl`}>
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
                        imageUrl={buildFileUrl(task.dataItem)}
                        annotations={(showAnnotatorLabels
                          ? (combinedAnnotations.length > 0 ? combinedAnnotations : (task?.labels?.objects?.map((obj, idx) => ({
                            id: idx,
                            bbox: obj.bbox,
                            label: obj.label,
                            index: idx,
                          })) || []))
                          : [])}
                        labelSet={task?.projectId?.labelSet || []}
                        reviewNotes={showAnnotatorLabels ? reviewNotes : []}
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
                    <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                      <button
                        onClick={() => setShowAnnotatorLabels((prev) => !prev)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${showAnnotatorLabels
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                      >
                        {showAnnotatorLabels ? 'Ẩn nhãn annotator' : 'Hiện nhãn annotator'}
                      </button>
                      {showAnnotatorLabels && relatedTasks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {relatedTasks.map((t) => {
                            const aid = t?.annotatorId?._id || t?.annotatorId;
                            const name = t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator';
                            const isOn = annotatorVisibility[aid] !== false;
                            const isActive = activeAnnotatorId === aid;
                            const isPrimary = Boolean(t?.primaryForItem);
                            return (
                              <button
                                key={aid}
                                onClick={() => {
                                  setAnnotatorVisibility((prev) => ({ ...prev, [aid]: !isOn }));
                                  setActiveAnnotatorId(aid);
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isOn
                                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                                  } ${isActive ? 'ring-1 ring-amber-400' : ''} ${isPrimary ? 'ring-2 ring-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.6)]' : ''}`}
                              >
                                {isOn ? 'Ẩn' : 'Hiện'} {name}
                                {isPrimary && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                    PRIMARY
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                    // Normalize audio segments from annotator output
                    const normalizedSegments = (task?.labels?.segments || [])
                      .map((seg, index) => ({
                        id: seg?.id || `segment_${index + 1}`,
                        start: Number(seg?.start ?? seg?.startTime ?? 0),
                        end: Number(seg?.end ?? seg?.endTime ?? 0),
                        label: seg?.label || 'unknown',
                        note: seg?.note || '',
                      }))
                      .filter((seg) => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);

                    const hasSegments = normalizedSegments.length > 0;

                    // If no segments, create a pseudo-segment from the main label/note
                    const items = hasSegments ? normalizedSegments : [
                      {
                        id: 'segment_global',
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
                    const audioUrl = buildFileUrl(task.dataItem);

                    return (
                      <div className="flex flex-col h-full min-h-[450px]">
                        {/* Audio Player + Annotator Segments */}
                        <div className={`p-6 mb-6 rounded-3xl border-2 transition-all ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200'
                          }`}>
                          <div className="flex items-center gap-6 mb-5">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 ${darkMode ? 'bg-gray-900 border-gray-700 text-blue-400' : 'bg-white border-white text-blue-600'
                              }`}>
                              🎧
                            </div>
                            <div className="flex-1">
                              <p className={`font-black truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.dataItem.filename}</p>
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Audio Source • {task.dataItem.mimeType}</p>
                            </div>
                          </div>

                          <AudioAnnotator
                            audioUrl={audioUrl}
                            labelSet={task?.projectId?.labelSet || []}
                            initialSegments={normalizedSegments}
                            readOnly
                          />
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
                      const itemLabelColor = task?.projectId?.labelSet?.find((l) => l.name === item.label)?.color || '#6366f1';
                      const fullText = task?.dataItem?.text || task?.dataItem?.content || '';

                      const sortedItems = [...annotatedItems]
                        .map((span) => ({
                          ...span,
                          text: span.text || span.sentence || '',
                          start: typeof span.start === 'number' ? span.start : fullText.indexOf(span.text || span.sentence || ''),
                        }))
                        .sort((a, b) => (a.start || 0) - (b.start || 0));

                      const renderTextWithHighlights = () => {
                        if (!fullText) {
                          return sortedItems.map((span, index) => {
                            const isActive = index === idx;
                            return (
                              <span
                                key={`fallback-${index}`}
                                className={`inline rounded px-1 py-0.5 ${isActive ? 'bg-blue-500/30 text-blue-100' : 'bg-slate-700/40 text-slate-300'}`}
                              >
                                {span.text}
                              </span>
                            );
                          });
                        }

                        const parts = [];
                        let cursor = 0;
                        sortedItems.forEach((span, index) => {
                          const text = span.text || '';
                          if (!text) return;
                          const start = typeof span.start === 'number' && span.start >= 0 ? span.start : fullText.indexOf(text, cursor);
                          if (start < 0) return;
                          const end = start + text.length;

                          if (start > cursor) {
                            parts.push({ type: 'plain', text: fullText.slice(cursor, start) });
                          }

                          const labelColor = task?.projectId?.labelSet?.find((l) => l.name === span.label)?.color || '#3b82f6';
                          parts.push({ type: 'span', text, label: span.label, index, labelColor });
                          cursor = end;
                        });

                        if (cursor < fullText.length) {
                          parts.push({ type: 'plain', text: fullText.slice(cursor) });
                        }

                        return parts.map((part, pIdx) => {
                          if (part.type === 'plain') {
                            return <span key={`plain-${pIdx}`} className="text-slate-200">{part.text}</span>;
                          }
                          const isActive = part.index === idx;
                          const borderColor = part.labelColor || '#3b82f6';
                          const activeBorder = hexToRgba(borderColor, 0.95);
                          const inactiveBorder = hexToRgba(borderColor, 0.55);
                          return (
                            <span
                              key={`span-${pIdx}`}
                              className="inline rounded px-1.5 py-0.5 border font-semibold"
                              style={{
                                color: '#f8fafc',
                                backgroundColor: 'transparent',
                                borderColor: isActive ? activeBorder : inactiveBorder,
                                boxShadow: isActive ? `0 0 0 1px ${activeBorder}, 0 4px 12px ${hexToRgba(borderColor, 0.35)}` : `0 0 0 1px ${inactiveBorder}`,
                              }}
                              title={`Label: ${part.label || 'Unknown'}`}
                            >
                              {part.text}
                            </span>
                          );
                        });
                      };

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

                          {/* Annotator-style Result View */}
                          <div className="flex-1 flex flex-col justify-center items-center py-8 space-y-4">
                            <div className="w-full rounded-2xl border-2 border-blue-500/40 bg-[#0b1730] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_16px_40px_rgba(30,64,175,0.25)]">
                              <div className="text-xs text-blue-200 mb-3 uppercase tracking-wider font-semibold">
                                Kết quả gán nhãn của {task?.annotatorId?.fullName || task?.annotatorId?.username || 'Annotator'}
                              </div>
                              <div className="max-h-64 overflow-auto text-[17px] leading-8 whitespace-pre-wrap font-medium text-slate-50">
                                {renderTextWithHighlights()}
                              </div>
                            </div>

                            <div className={`w-full p-6 rounded-2xl border transition-all duration-300 ${status === 'approved'
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : status === 'rejected'
                                ? 'bg-rose-500/10 border-rose-500/30'
                                : 'bg-slate-800/40 border-slate-700'
                              }`}>
                              <div className="flex flex-wrap items-center gap-3 mb-3">
                                <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Vùng gán nhãn {idx + 1} / {annotatedItems.length}
                                </span>
                                <span
                                  className="px-4 py-1.5 rounded-full text-xs font-semibold border"
                                  style={{
                                    color: itemLabelColor,
                                    borderColor: hexToRgba(itemLabelColor, 0.55),
                                    backgroundColor: hexToRgba(itemLabelColor, 0.18),
                                  }}
                                >
                                  🏷️ {itemLabel}
                                </span>
                              </div>
                              <blockquote className="text-lg font-semibold text-slate-100 leading-relaxed">
                                "{itemText}"
                              </blockquote>
                              {item.note && (
                                <p className="mt-2 text-sm text-slate-400">Ghi chú annotator: {item.note}</p>
                              )}
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
                                <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-400">
                                  Đánh giá ở mức task bằng thanh action phía dưới (Approve/Reject).
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

          {!reviewOnly && (
            <div className={`mt-4 ${darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-[#1e293b] border-slate-700'} rounded-2xl border p-4 shadow-2xl`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  REVIEW QUEUE
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                  {actionablePendingTasks.length} ACTIONABLE
                </span>
              </div>
              <div className="space-y-3">
                {actionablePendingTasks.length === 0 ? (
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Không có task nào bạn có thể chấm lúc này.
                  </div>
                ) : (
                  actionablePendingTasks.slice(0, 3).map((pendingTask) => {
                    const isActive = pendingTask._id === id;
                    const timeAgo = pendingTask.submittedAt ? getTimeAgo(new Date(pendingTask.submittedAt)) : '';
                    return (
                      <button
                        key={pendingTask._id}
                        onClick={() => {
                          const scopeQuery = new URLSearchParams();
                          if (scopedProjectId) scopeQuery.set('projectId', scopedProjectId);
                          if (scopedDatasetId) scopeQuery.set('datasetId', scopedDatasetId);
                          if (scopedAnnotatorId) scopeQuery.set('annotatorId', scopedAnnotatorId);
                          if (scopedAnnotatorIds) scopeQuery.set('annotatorIds', scopedAnnotatorIds);
                          const query = scopeQuery.toString();
                          navigate(`/reviewer/tasks/${pendingTask._id}${query ? `?${query}` : ''}`);
                        }}
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
                              {(() => {
                                const thumbUrl = buildFileUrl(pendingTask.dataItem);
                                if (!thumbUrl) {
                                  return (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                                      No image
                                    </div>
                                  );
                                }
                                return (
                                  <img
                                    src={thumbUrl}
                                    alt="Task thumbnail"
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                );
                              })()}
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
          )}
        </div>

        {/* Right Sidebar - Made smaller */}
        {!reviewOnly && (
          <div className={`w-72 ${darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-[#1e293b] border-slate-700'} border-l overflow-y-auto`}>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Review Overview</h3>
                <div className="rounded-xl border border-slate-700 bg-[#0f172a] p-4 text-sm text-slate-300 space-y-3">
                  <p className="text-slate-200 font-medium">Assigned → Submitted → In Review → Approved / Rejected</p>
                  <p>Reject phải có ít nhất 1 lỗi và comment tổng quan.</p>
                  <p>Sau khi review, task sẽ bị khóa.</p>

                  {datasetType === 'image' && (
                    <div className="pt-2 border-t border-slate-700 space-y-1">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Object Summary</p>
                      <p className="text-slate-200">Detected Objects: {(task?.labels?.objects || []).length}</p>
                      {imageClassSummary.map(([name, count]) => (
                        <p key={name} className="text-xs text-slate-300">• {name}: {count}</p>
                      ))}
                    </div>
                  )}

                  {datasetType === 'audio' && (
                    <div className="pt-2 border-t border-slate-700 space-y-1">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Segment Overview</p>
                      <p className="text-slate-200">Total Segments: {audioSegments.length}</p>
                      <p className="text-xs text-slate-300">Duration: {task?.dataItem?.duration ? `${task.dataItem.duration}s` : 'N/A'}</p>
                    </div>
                  )}

                  {datasetType === 'text' && (
                    <div className="pt-2 border-t border-slate-700 space-y-1">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Label Summary</p>
                      <p className="text-slate-200">Entities: {textEntities.length}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Error Checklist ({datasetType.toUpperCase()})</h3>
                <div className="space-y-3">
                  {issueOptions.map((issue) => {
                    const checked = selectedIssues.includes(issue.id);
                    return (
                      <div key={issue.id} className="rounded-xl border border-slate-700 bg-[#0f172a] p-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedIssues((prev) => isChecked
                                ? [...prev, issue.id]
                                : prev.filter((x) => x !== issue.id));
                            }}
                            className="h-4 w-4 rounded border-slate-600 bg-[#0f172a] text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-200">{issue.label}</span>
                        </label>

                        {checked && issue.needsTarget && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-slate-400">{issue.targetLabel}</p>
                            <select
                              value={issueTargets[issue.id] || ''}
                              onChange={(e) => setIssueTargets((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              className="w-full rounded-lg bg-[#0f172a] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm px-3 py-2"
                            >
                              <option value="">Select target</option>
                              {targetOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {checked && (
                          <div className="mt-3">
                            <textarea
                              value={issueComments[issue.id] || ''}
                              onChange={(e) => setIssueComments((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              rows={2}
                              placeholder="Issue comment (optional)"
                              className="w-full rounded-lg bg-[#0f172a] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm px-3 py-2"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Structured Comment</h3>
                <div className="rounded-xl border border-blue-700/40 bg-gradient-to-b from-[#0f172a] to-[#0b1220] p-4 space-y-3 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-blue-200 block">Overall Feedback</label>
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${reviewComments.trim().length >= 12 ? 'text-emerald-300 border-emerald-600/40 bg-emerald-900/20' : 'text-amber-300 border-amber-600/40 bg-amber-900/20'}`}>
                      {reviewComments.trim().length >= 12 ? 'Đủ nội dung' : 'Nên >= 12 ký tự'}
                    </span>
                  </div>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    rows={5}
                    placeholder={datasetType === 'image'
                      ? 'Ví dụ: Thiếu 1 object ở góc trái và sai class object #3.'
                      : datasetType === 'audio'
                        ? 'Ví dụ: Segment #2 sai nhãn, Segment #3 lệch timestamp 0.5s.'
                        : 'Ví dụ: Missing entity LOCATION ở cuối câu, span entity #2 sai.'}
                    disabled={isReviewed}
                    className="w-full rounded-lg bg-[#0a1020] border border-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 text-slate-100 text-sm px-3 py-3 placeholder:text-slate-400 disabled:opacity-60"
                  />
                  <div className="text-xs text-slate-300 rounded-lg border border-slate-700 bg-[#0b1328] px-3 py-2">
                    {selectedIssueDetails.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-blue-200 font-semibold">Issues selected ({selectedIssueDetails.length})</p>
                        {selectedIssueDetails.map((issue) => (
                          <p key={issue.id}>• {issue.label}{issueTargets[issue.id] ? ` (${issueTargets[issue.id]})` : ''}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-amber-200">Chưa chọn issue nào. Reject sẽ bị khóa cho tới khi chọn ít nhất 1 issue.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Dock */}
      {!isReviewed && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl ${darkMode
          ? 'bg-gray-800/95 backdrop-blur-xl border border-gray-700'
          : 'bg-white/95 backdrop-blur-xl border border-gray-200/50'
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
            disabled={processing || !reviewComments.trim() || selectedIssues.length === 0 || isReviewed || activeAnnotatorCount > 1}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : (activeAnnotatorCount > 1 ? 'Chỉ được phép khi chọn đúng 1 annotator' : (selectedIssues.length === 0 ? 'Chọn ít nhất 1 lỗi trước khi reject' : (!reviewComments.trim() ? 'Vui lòng nhập nhận xét trước khi từ chối' : '')))}
          >
            <span className="mr-2">✕</span> Reject
          </button>
          <button
            onClick={handleSetPrimary}
            disabled={processing}
            className={`px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${primaryQueued && !isMyApproved
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/40'
              : 'bg-gradient-to-r from-indigo-500 to-blue-600 shadow-indigo-500/40'
              } text-white`}
            title={!isMyApproved ? 'Chọn trước, sẽ áp dụng khi Approve Task' : ''}
          >
            {primaryQueued && !isMyApproved ? 'Đã chọn ảnh chính' : 'Đặt ảnh chính'}
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || isReviewed || activeAnnotatorCount > 1}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isReviewed ? 'Task này đã được đánh giá rồi' : (activeAnnotatorCount > 1 ? 'Chỉ được phép khi chọn đúng 1 annotator' : '')}
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