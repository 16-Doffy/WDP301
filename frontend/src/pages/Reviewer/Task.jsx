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
  const [primaryQueued, setPrimaryQueued] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [annotatorVisibility, setAnnotatorVisibility] = useState({});
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [showAnnotatorLabels, setShowAnnotatorLabels] = useState(false);
  const [compactCompareView, setCompactCompareView] = useState(true);
  const [activeAnnotatorId, setActiveAnnotatorId] = useState('');

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopedProjectId = searchParams.get('projectId') || '';
  const scopedDatasetId = searchParams.get('datasetId') || '';
  const scopedAnnotatorId = searchParams.get('annotatorId') || '';
  const scopedAnnotatorIds = searchParams.get('annotatorIds') || '';
  const reviewOnly = searchParams.get('reviewOnly') === '1';

  useEffect(() => {
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
      : ((task?.dataItem?.mimeType || '').startsWith('text/') || !!task?.dataItem?.text || !!task?.dataItem?.content)
        ? 'text'
        : 'image';
  const canSetPrimary = datasetType === 'image';

  // Issue catalog by dataset type - unified for all types
  const issueCatalogByType = {
    image: [
      { id: 'missing_object', label: 'Missed Object', needsTarget: false, description: 'Object exists but not labeled' },
      { id: 'wrong_class', label: 'Wrong Class', needsTarget: true, targetLabel: 'Object ID', description: 'Object classified incorrectly' },
      { id: 'bbox_loose', label: 'Bounding Box Too Loose', needsTarget: true, targetLabel: 'Object ID', description: 'Box includes too much background' },
      { id: 'bbox_tight', label: 'Bounding Box Too Tight', needsTarget: true, targetLabel: 'Object ID', description: 'Box cuts off part of object' },
      { id: 'wrong_overlap', label: 'Wrong Overlap Handling', needsTarget: true, targetLabel: 'Object ID', description: 'Overlapping objects handled incorrectly' },
    ],
    audio: [
      { id: 'wrong_label', label: 'Wrong Label', needsTarget: true, targetLabel: 'Segment #', description: 'Audio segment labeled incorrectly' },
      { id: 'incorrect_timestamp', label: 'Incorrect Timestamp', needsTarget: true, targetLabel: 'Segment #', description: 'Start/end time is wrong' },
      { id: 'overlapping_segments', label: 'Overlapping Segments', needsTarget: true, targetLabel: 'Segment #', description: 'Segments should not overlap' },
      { id: 'missing_segment', label: 'Missing Segment', needsTarget: false, description: 'Expected segment not found' },
      { id: 'noise_misclassified', label: 'Background Noise Misclassified', needsTarget: true, targetLabel: 'Segment #', description: 'Noise labeled as speech or vice versa' },
    ],
    text: [
      { id: 'wrong_category', label: 'Wrong Category', needsTarget: true, targetLabel: 'Entity #', description: 'Entity category is incorrect' },
      { id: 'missing_entity', label: 'Missing Entity', needsTarget: false, description: 'Expected entity not found in text' },
      { id: 'wrong_span', label: 'Wrong Span', needsTarget: true, targetLabel: 'Entity #', description: 'Text span does not match entity' },
      { id: 'overlapping_entity', label: 'Overlapping Entity', needsTarget: true, targetLabel: 'Entity #', description: 'Entities should not overlap' },
      { id: 'incorrect_classification', label: 'Incorrect Classification', needsTarget: true, targetLabel: 'Entity #', description: 'Classification is wrong' },
    ],
  };

  const issueOptions = issueCatalogByType[datasetType] || issueCatalogByType.image;

  // Target options based on dataset type
  const targetOptions = useMemo(() => {
    if (datasetType === 'image') {
      return (task?.labels?.objects || []).map((obj, idx) => ({
        id: `object_${idx + 1}`,
        label: `Object #${idx + 1} (${obj.label || 'Unknown'})`,
        index: idx
      }));
    } else if (datasetType === 'audio') {
      const segments = task?.labels?.segments || [];
      if (segments.length > 0) {
        return segments.map((seg, idx) => ({
          id: `segment_${idx + 1}`,
          label: `Segment #${idx + 1} (${seg.label || 'unknown'})`,
          index: idx
        }));
      }
      return [{ id: 'segment_1', label: 'Segment #1 (no segments)', index: 0 }];
    } else {
      // Text - spans or sentences
      const items = task?.labels?.spans || task?.labels?.sentences || [];
      return items.map((item, idx) => ({
        id: `entity_${idx + 1}`,
        label: `Entity #${idx + 1} (${item.label || 'text'})`,
        index: idx
      }));
    }
  }, [datasetType, task?.labels]);

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
      } else if (scopedAnnotatorIds) {
        const allowedIds = scopedAnnotatorIds.split(',').map((v) => v.trim()).filter(Boolean);
        pending = pending.filter((t) => allowedIds.includes((t?.annotatorId?._id || t?.annotatorId)?.toString?.()));
        reviewed = reviewed.filter((t) => allowedIds.includes((t?.annotatorId?._id || t?.annotatorId)?.toString?.()));
      }

      // Hide tasks that no longer have annotator assigned/resolved
      pending = pending.filter((t) => {
        const aid = t?.annotatorId?._id || t?.annotatorId;
        return Boolean(aid);
      });

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
      let tasks = (res.data || []).filter((t) => {
        const hasAnnotator = Boolean(t?.annotatorId?._id || t?.annotatorId);
        return t?.status === 'submitted' && hasAnnotator;
      });

      if (scopedAnnotatorId) {
        tasks = tasks.filter((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() === scopedAnnotatorId);
      } else if (scopedAnnotatorIds) {
        const allowedIds = scopedAnnotatorIds.split(',').map((val) => val.trim()).filter(Boolean);
        tasks = tasks.filter((t) => allowedIds.includes((t?.annotatorId?._id || t?.annotatorId)?.toString?.()));
      }

      setRelatedTasks(tasks);

      const taskAnnotatorIds = tasks
        .map((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '')
        .filter(Boolean);

      const scopedId = scopedAnnotatorId?.toString?.() || scopedAnnotatorId;
      const currentActive = activeAnnotatorId?.toString?.() || activeAnnotatorId;
      const nextActiveId = (scopedId && taskAnnotatorIds.includes(scopedId))
        ? scopedId
        : (currentActive && taskAnnotatorIds.includes(currentActive)
          ? currentActive
          : (taskAnnotatorIds[0] || ''));

      const visibility = {};
      taskAnnotatorIds.forEach((aid) => {
        visibility[aid] = aid === nextActiveId;
      });

      setAnnotatorVisibility(visibility);
      setActiveAnnotatorId(nextActiveId);
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

  const selectedAnnotatorCount = useMemo(() => {
    if (!relatedTasks || relatedTasks.length === 0) return activeAnnotatorId ? 1 : 0;
    return relatedTasks.reduce((count, t) => {
      const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
      if (!aid) return count;
      return annotatorVisibility[aid] ? count + 1 : count;
    }, 0);
  }, [relatedTasks, annotatorVisibility, activeAnnotatorId]);

  const selectedTaskForReview = useMemo(() => {
    if (!task) return null;

    // Khi đã chọn annotator thì chỉ lấy đúng task của annotator đó,
    // KHÔNG fallback về task route để tránh chấm nhầm task đã review.
    if (activeAnnotatorId) {
      return relatedTasks.find((t) => (t?.annotatorId?._id || t?.annotatorId)?.toString?.() === activeAnnotatorId?.toString?.()) || null;
    }

    // Chưa chọn annotator: lấy task hiện tại nếu còn submitted, nếu không thì lấy task submitted đầu tiên trong related.
    if (task?.status === 'submitted') return task;
    return relatedTasks.find((t) => t?.status === 'submitted') || null;
  }, [task, relatedTasks, activeAnnotatorId]);

  const selectedMyReviewerEntry = Array.isArray(selectedTaskForReview?.reviewers)
    ? selectedTaskForReview.reviewers.find((r) => {
      const rid = r?.reviewerId?._id || r?.reviewerId;
      return rid?.toString?.() === user?._id?.toString?.();
    })
    : null;

  const hasMyDecision = selectedMyReviewerEntry && selectedMyReviewerEntry.status !== 'pending';
  const isFinalized = selectedTaskForReview?.status === 'approved' || selectedTaskForReview?.status === 'rejected';
  const isOverdue = !!(task?.projectId?.deadline && new Date(task.projectId.deadline) < new Date());
  const isReviewed = isFinalized || hasMyDecision;
  const isLockedForReview = isReviewed || isOverdue;
  const isMyApproved = selectedMyReviewerEntry?.status === 'approved' || selectedTaskForReview?.status === 'approved';

  // Actionable = submitted + reviewer hiện tại vẫn còn trạng thái pending trên task đó
  const actionablePendingTasks = useMemo(() => {
    if (reviewOnly) return [];

    return (pendingTasks || []).filter((t) => {
      if (t?.status !== 'submitted') return false;

      const reviewerEntries = Array.isArray(t?.reviewers) ? t.reviewers : [];
      if (reviewerEntries.length > 0) {
        const myEntry = reviewerEntries.find((r) => {
          const rid = r?.reviewerId?._id || r?.reviewerId;
          return rid?.toString?.() === user?._id?.toString?.();
        });
        // Backend đã scope theo reviewer; nếu chưa map được myEntry thì vẫn cho hiển thị.
        return myEntry ? myEntry.status === 'pending' : true;
      }

      const primaryReviewerId = t?.reviewerId?._id || t?.reviewerId;
      return primaryReviewerId
        ? primaryReviewerId?.toString?.() === user?._id?.toString?.()
        : true;
    });
  }, [reviewOnly, pendingTasks, user?._id]);

  const groupedQueueTasks = useMemo(() => {
    const map = new Map();

    actionablePendingTasks.forEach((t) => {
      const dataItemKey = (
        t?.dataItem?._id ||
        t?.datasetItemId?._id ||
        t?.datasetItemId ||
        t?.itemId?._id ||
        t?.itemId ||
        t?.dataItem?.path ||
        t?.dataItem?.filename ||
        t?._id
      )?.toString?.();

      if (!dataItemKey) return;

      const submittedAt = t?.submittedAt ? new Date(t.submittedAt) : null;

      if (!map.has(dataItemKey)) {
        map.set(dataItemKey, {
          key: dataItemKey,
          representative: t,
          tasks: [t],
          latestSubmittedAt: submittedAt,
        });
      } else {
        const entry = map.get(dataItemKey);
        entry.tasks.push(t);
        if (submittedAt && (!entry.latestSubmittedAt || submittedAt > entry.latestSubmittedAt)) {
          entry.latestSubmittedAt = submittedAt;
          entry.representative = t;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.latestSubmittedAt ? a.latestSubmittedAt.getTime() : 0;
      const tb = b.latestSubmittedAt ? b.latestSubmittedAt.getTime() : 0;
      return tb - ta;
    });
  }, [actionablePendingTasks]);

  const goToNextPendingTask = useCallback(() => {
    if (!Array.isArray(groupedQueueTasks) || groupedQueueTasks.length === 0) {
      navigate('/reviewer/dashboard');
      return;
    }

    const currentIndex = groupedQueueTasks.findIndex((g) => g.tasks.some((t) => t._id === id));
    const scopeQuery = new URLSearchParams();
    if (scopedProjectId) scopeQuery.set('projectId', scopedProjectId);
    if (scopedDatasetId) scopeQuery.set('datasetId', scopedDatasetId);
    if (scopedAnnotatorId) scopeQuery.set('annotatorId', scopedAnnotatorId);
    if (scopedAnnotatorIds) scopeQuery.set('annotatorIds', scopedAnnotatorIds);
    const query = scopeQuery.toString();

    if (currentIndex >= 0 && currentIndex < groupedQueueTasks.length - 1) {
      navigate(`/reviewer/tasks/${groupedQueueTasks[currentIndex + 1].representative._id}${query ? `?${query}` : ''}`);
      return;
    }

    if (currentIndex === -1 && groupedQueueTasks.length > 0) {
      navigate(`/reviewer/tasks/${groupedQueueTasks[0].representative._id}${query ? `?${query}` : ''}`);
      return;
    }

    navigate('/reviewer/dashboard');
  }, [groupedQueueTasks, id, navigate, scopedProjectId, scopedDatasetId, scopedAnnotatorId, scopedAnnotatorIds]);

  const handleApprove = useCallback(async () => {
    if (processing || isLockedForReview) {
      alert(isOverdue ? 'Task đã quá hạn deadline project, bạn không thể review nữa.' : 'Task này đã được đánh giá rồi.');
      return;
    }

    if (!activeAnnotatorId || selectedAnnotatorCount !== 1) {
      alert('Vui lòng chỉ bật ON đúng 1 annotator để chấm.');
      return;
    }

    const targetTaskId = selectedTaskForReview?._id;
    if (!targetTaskId) {
      alert('Không tìm thấy task pending của annotator này để chấm.');
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
  }, [id, reviewComments, reviewNotes, isLockedForReview, isOverdue, autoNext, fetchAllTasks, fetchTask, fetchRelatedTasks, goToNextPendingTask, processing, primaryQueued, activeAnnotatorId, selectedTaskForReview, selectedAnnotatorCount]);

  const handleReject = useCallback(async () => {
    if (processing || isLockedForReview || task?.status === 'approved' || task?.status === 'rejected') {
      alert(isOverdue
        ? 'Task đã quá hạn deadline project, bạn không thể review nữa.'
        : 'Task này đã được đánh giá rồi. Mỗi task chỉ có thể được đánh giá 1 lần.');
      return;
    }

    if (!activeAnnotatorId || selectedAnnotatorCount !== 1) {
      alert('Vui lòng chỉ bật ON đúng 1 annotator để chấm.');
      return;
    }

    // Validation: Must select at least 1 issue for rejection
    // if (selectedIssues.length === 0) {
    //   alert('Vui lòng chọn ít nhất 1 lỗi (issue) trước khi từ chối task.');
    //   return;
    // }

    // Validate that issues requiring targets have targets selected
    for (const issueId of selectedIssues) {
      const issueInfo = issueOptions.find(i => i.id === issueId);
      if (issueInfo?.needsTarget && !issueTargets[issueId]) {
        alert(`Vui lòng chọn ${issueInfo.targetLabel} cho lỗi "${issueInfo.label}"`);
        return;
      }
    }

    const targetTaskId = selectedTaskForReview?._id;
    if (!targetTaskId) {
      alert('Không tìm thấy task pending của annotator này để chấm.');
      return;
    }

    if (window.confirm('Bạn có chắc muốn từ chối task này? Annotator sẽ nhận được phản hồi và cần chỉnh sửa lại. Lưu ý: Mỗi task chỉ có thể được đánh giá 1 lần.')) {
      setProcessing(true);
      try {
        // Build issues array with full details
        const issues = selectedIssues.map((issueId) => {
          const issueMeta = issueOptions.find((i) => i.id === issueId);
          const targetId = issueTargets[issueId];
          
          // Get target details for display
          let targetDetails = null;
          if (targetId) {
            if (datasetType === 'image') {
              const idx = parseInt(targetId.replace('object_', '')) - 1;
              const obj = task?.labels?.objects?.[idx];
              targetDetails = { id: targetId, label: obj?.label || 'Unknown', index: idx };
            } else if (datasetType === 'audio') {
              const idx = parseInt(targetId.replace('segment_', '')) - 1;
              const seg = task?.labels?.segments?.[idx];
              targetDetails = { id: targetId, label: seg?.label || 'unknown', index: idx };
            } else {
              const idx = parseInt(targetId.replace('entity_', '')) - 1;
              const entity = task?.labels?.spans?.[idx] || task?.labels?.sentences?.[idx];
              targetDetails = { id: targetId, label: entity?.label || 'text', index: idx };
            }
          }

          return {
            type: issueMeta?.label || issueId,
            typeId: issueId,
            targetId: targetId || null,
            targetDetails: targetDetails,
            comment: issueComments[issueId]?.trim() || null,
          };
        });

        // Validate: bắt buộc comment khi reject
        if (!reviewComments.trim()) {
          alert('Bạn phải nhập comment khi từ chối task.');
          return;
        }

        // Determine backend error category based on first issue
        const firstIssue = selectedIssues[0]?.toLowerCase?.() || '';
        const backendErrorCategory = firstIssue.includes('class') || firstIssue.includes('wrong_category') || firstIssue.includes('incorrect_classification')
          ? 'incorrect_label'
          : firstIssue.includes('miss') || firstIssue.includes('missing')
            ? 'missing_label'
            : firstIssue.includes('box') || firstIssue.includes('tight') || firstIssue.includes('loose') || firstIssue.includes('span') || firstIssue.includes('timestamp')
              ? 'poor_quality'
              : 'does_not_follow_guidelines';

        await axios.post(`${API_URL}/api/reviews/${targetTaskId}/reject`, {
          reviewComments: reviewComments.trim(),
          errorCategory: backendErrorCategory,
          reviewNotes: [],
          review: {
            taskId: targetTaskId,
            datasetType,
            status: 'rejected',
            issues,
            overallComment: reviewComments.trim(),
          },
        });
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
  }, [id, task, reviewComments, reviewNotes, selectedIssues, issueOptions, issueTargets, issueComments, datasetType, autoNext, fetchAllTasks, fetchTask, fetchRelatedTasks, goToNextPendingTask, processing, isLockedForReview, isOverdue, activeAnnotatorId, selectedTaskForReview, selectedAnnotatorCount]);

  const handleSkip = () => {
    goToNextPendingTask();
  };

  const handleSetPrimary = async () => {
    if (!canSetPrimary) {
      alert('Chỉ project image mới có chức năng đặt Primary.');
      return;
    }

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
      const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
      return aid ? annotatorVisibility[aid] !== false : true;
    });
  }, [relatedTasks, annotatorVisibility]);

  const combinedAnnotations = useMemo(() => {
    if (visibleRelatedTasks.length === 0) return [];

    return visibleRelatedTasks.flatMap((t, tIdx) => {
      const aid = t?.annotatorId?._id || t?.annotatorId || `ann_${tIdx}`;
      const labelSet = t?.availableLabels || [];
      const color = labelSet.find((l) => l?.name)?.color;
      const isPrimary = Boolean(t?.primaryForItem);
      const isSelected = activeAnnotatorId === aid || (!activeAnnotatorId && tIdx === 0);
      const annotatorName = t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator';

      return (t?.labels?.objects || []).map((obj, idx) => {
        const baseLabel = obj.label || 'Unknown';
        let finalLabel = baseLabel;

        if (showAnnotatorLabels) {
          finalLabel = isPrimary
            ? `${baseLabel} • ${annotatorName} (PRIMARY)`
            : `${baseLabel} • ${annotatorName}`;
        } else if (isPrimary) {
          finalLabel = `${baseLabel} (PRIMARY)`;
        }

        return {
          id: `${aid}_${idx}`,
          bbox: obj.bbox,
          label: finalLabel,
          annotatorId: aid,
          color,
          isPrimary,
          isSelected,
        };
      });
    });
  }, [visibleRelatedTasks, activeAnnotatorId, showAnnotatorLabels]);

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
          <button
            onClick={() => navigate(-1)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${darkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            title="Quay về trang trước"
          >
            ← Quay lại
          </button>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {task?.projectId?.name || 'Project Review'}
            <span className={`ml-3 align-middle text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
              {datasetType.toUpperCase()}
            </span>
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
            {isOverdue && !isReviewed && (
              <div className={`mb-4 p-4 rounded-xl border-2 ${darkMode
                ? 'bg-orange-900/30 border-orange-500 text-orange-200'
                : 'bg-orange-100 border-orange-500 text-orange-800'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏰</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">TASK ĐÃ QUÁ HẠN</h3>
                    <p className="text-sm mt-1">
                      Deadline project đã hết hạn ({task?.projectId?.deadline ? new Date(task.projectId.deadline).toLocaleString('vi-VN') : 'N/A'}).
                      Reviewer không thể approve/reject task này nữa.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

            <div className="mb-4 space-y-3">
              <div>
                <h2 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  CURRENTLY AUDITING
                </h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {task?.dataItem?.filename || 'Item'}
                </p>
              </div>

              <div className={`rounded-xl border px-4 py-3 ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className={`${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    <span className="opacity-70">Dataset:</span>{' '}
                    <span className="font-medium">{task?.datasetId?.name || 'N/A'}</span>
                  </div>
                  <div className={`${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    <span className="opacity-70">Labels:</span>{' '}
                    <span className="font-medium">{task?.availableLabels?.length || 0}</span>
                  </div>
                  <div className={`${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    <span className="opacity-70">Scope:</span>{' '}
                    <span className="font-medium">{pendingTasks.length + reviewedTasks.length} tasks</span>
                  </div>
                  <div className={`${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    <span className="opacity-70">Deadline:</span>{' '}
                    <span className="font-medium">{task?.projectId?.deadline ? new Date(task.projectId.deadline).toLocaleDateString('vi-VN') : 'N/A'}</span>
                  </div>
                </div>
              </div>
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
                        annotations={combinedAnnotations}
                        labelSet={task?.availableLabels || []}
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
                    <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                      {/* Hiển thị thông báo về primary annotation */}
                      {relatedTasks.length > 0 && (
                        <div className="flex items-center gap-2">
                          {visibleRelatedTasks.some(t => t?.primaryForItem) ? (
                            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-200">
                              ✓ Đã chọn: {visibleRelatedTasks.find(t => t?.primaryForItem)?.annotatorId?.fullName || visibleRelatedTasks.find(t => t?.primaryForItem)?.annotatorId?.username || 'Annotator'} (PRIMARY)
                            </div>
                          ) : (
                            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-200">
                              ℹ️ Hãy chọn 1 annotator bên dưới để duyệt/từ chối
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Nút chọn annotator để duyệt/từ chối + bật/tắt hiển thị */}
                      {relatedTasks.length > 0 && (
                        <div className="w-full space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setShowAnnotatorLabels((prev) => !prev)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${showAnnotatorLabels
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                }`}
                            >
                              {showAnnotatorLabels ? 'Ẩn label annotator' : 'Hiện label annotator'}
                            </button>

                            <button
                              onClick={() => {
                                const next = {};
                                relatedTasks.forEach((t) => {
                                  const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                                  if (aid) next[aid] = true;
                                });
                                setAnnotatorVisibility(next);
                              }}
                              className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                            >
                              Hiện tất cả annotator
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {relatedTasks.map((t) => {
                              const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                              const name = t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator';
                              const isSelected = activeAnnotatorId === aid;
                              const isPrimary = Boolean(t?.primaryForItem);
                              const isVisible = annotatorVisibility[aid] !== false;

                              return (
                                <button
                                  key={aid}
                                  onClick={() => {
                                    const nextVisible = !isVisible;
                                    setAnnotatorVisibility((prev) => ({ ...prev, [aid]: nextVisible }));
                                    if (nextVisible) {
                                      setActiveAnnotatorId(aid);
                                    } else if (activeAnnotatorId === aid) {
                                      setActiveAnnotatorId('');
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${isVisible
                                    ? isSelected
                                      ? (isPrimary
                                        ? 'bg-amber-600 border-amber-500 text-white ring-2 ring-amber-400'
                                        : 'bg-blue-600 border-blue-500 text-white ring-2 ring-blue-400')
                                      : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                  title={isVisible ? 'Nhấn để OFF annotator này' : 'Nhấn để ON annotator này'}
                                >
                                  {name}
                                  {isPrimary && <span className="ml-1">★</span>}
                                  <span className="ml-2">{isVisible ? 'ON' : 'OFF'}</span>
                                </button>
                              );
                            })}
                          </div>
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
                    const normalizeSegments = (segments = []) => (
                      segments
                        .map((seg, index) => ({
                          id: seg?.id || `segment_${index + 1}`,
                          start: Number(seg?.start ?? seg?.startTime ?? 0),
                          end: Number(seg?.end ?? seg?.endTime ?? 0),
                          label: seg?.label || 'unknown',
                          note: seg?.note || '',
                        }))
                        .filter((seg) => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start)
                    );

                    const audioCompareTasks = visibleRelatedTasks.length > 0 ? visibleRelatedTasks : [task];

                    return (
                      <div className="flex flex-col h-full min-h-[400px] space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setCompactCompareView((prev) => !prev)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${compactCompareView
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                          >
                            {compactCompareView ? 'Compact: ON' : 'Compact: OFF'}
                          </button>

                          <button
                            onClick={() => setShowAnnotatorLabels((prev) => !prev)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${showAnnotatorLabels
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                          >
                            {showAnnotatorLabels ? 'Ẩn tên annotator' : 'Hiện tên annotator'}
                          </button>

                          <button
                            onClick={() => {
                              const next = {};
                              relatedTasks.forEach((t) => {
                                const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                                if (aid) next[aid] = true;
                              });
                              setAnnotatorVisibility(next);
                            }}
                            className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          >
                            Hiện tất cả
                          </button>
                        </div>

                        {relatedTasks.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {relatedTasks.map((t) => {
                              const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                              const name = t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator';
                              const isVisible = annotatorVisibility[aid] !== false;
                              return (
                                <button
                                  key={aid}
                                  onClick={() => {
                                    const nextVisible = !isVisible;
                                    setAnnotatorVisibility((prev) => ({ ...prev, [aid]: nextVisible }));
                                    if (nextVisible) {
                                      setActiveAnnotatorId(aid);
                                    } else if (activeAnnotatorId === aid) {
                                      setActiveAnnotatorId('');
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${isVisible
                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                >
                                  {isVisible ? 'ON' : 'OFF'} • {name}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className={`${compactCompareView ? 'space-y-2' : 'space-y-3'} max-h-[620px] overflow-y-auto pr-1`}>
                          {audioCompareTasks.map((t, idx) => {
                            const annotatorName = t?.annotatorId?.fullName || t?.annotatorId?.username || `Annotator ${idx + 1}`;
                            const isPrimary = Boolean(t?.primaryForItem);
                            const aid = t?.annotatorId?._id || t?.annotatorId || `ann_${idx}`;
                            const segments = normalizeSegments(t?.labels?.segments || []);
                            const audioUrl = buildFileUrl(t?.dataItem) || buildFileUrl(task?.dataItem);

                            return (
                              <div key={aid} className={`rounded-xl border p-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-200 font-semibold">
                                      {annotatorName}
                                      {isPrimary ? ' ★ PRIMARY' : ''}
                                    </span>
                                    <span className="text-xs text-slate-400">{segments.length} labels</span>
                                  </div>
                                </div>

                                {!compactCompareView && (
                                  <div className={`p-2 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <AudioAnnotator
                                      audioUrl={audioUrl}
                                      labelSet={task?.availableLabels || []}
                                      initialSegments={segments}
                                      readOnly
                                    />
                                  </div>
                                )}

                                {segments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {segments.slice(0, 8).map((seg, segIdx) => (
                                      <span
                                        key={`${aid}-${seg.id}-${segIdx}`}
                                        className="text-[11px] px-2 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-200"
                                      >
                                        {showAnnotatorLabels
                                          ? `${seg.label} • ${annotatorName}`
                                          : seg.label}
                                        {' '}({seg.start.toFixed(1)}-{seg.end.toFixed(1)}s)
                                      </span>
                                    ))}
                                    {segments.length > 8 && (
                                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                                        +{segments.length - 8} labels
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : task?.dataItem?.mimeType?.startsWith('text/') || task?.dataItem?.text ? (
                  (() => {
                    const getLabelColor = (label) => task?.availableLabels?.find((l) => l.name === label)?.color || '#3b82f6';

                    const textCompareTasks = visibleRelatedTasks.length > 0
                      ? visibleRelatedTasks
                      : [task];

                    const renderHighlightedText = (taskItem) => {
                      const baseText = task?.dataItem?.text || task?.dataItem?.content || '';
                      const text = taskItem?.dataItem?.text || taskItem?.dataItem?.content || baseText || '';
                      const spansRaw = taskItem?.labels?.spans || taskItem?.labels?.sentences || [];

                      if (!text) {
                        return <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Không có nội dung văn bản.</p>;
                      }

                      const spans = spansRaw
                        .map((s, idx) => {
                          let start = Number(s?.start);
                          let end = Number(s?.end);
                          const snippet = (s?.text || s?.sentence || '').trim();

                          // Fallback: nếu không có start/end thì dò theo text snippet
                          if ((!Number.isFinite(start) || !Number.isFinite(end) || end <= start) && snippet) {
                            const foundAt = text.indexOf(snippet);
                            if (foundAt >= 0) {
                              start = foundAt;
                              end = foundAt + snippet.length;
                            }
                          }

                          return {
                            id: s?.id || `span_${idx}`,
                            start,
                            end,
                            label: s?.label || 'Unknown',
                            text: snippet,
                          };
                        })
                        .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.start >= 0 && s.end <= text.length)
                        .sort((a, b) => a.start - b.start);

                      if (spans.length === 0) {
                        return <p className={`whitespace-pre-wrap text-sm leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{text}</p>;
                      }

                      const parts = [];
                      let cursor = 0;

                      spans.forEach((span) => {
                        if (span.start < cursor) return;
                        if (span.start > cursor) {
                          parts.push({ type: 'text', value: text.slice(cursor, span.start) });
                        }
                        parts.push({ type: 'span', value: text.slice(span.start, span.end), label: span.label });
                        cursor = span.end;
                      });

                      if (cursor < text.length) {
                        parts.push({ type: 'text', value: text.slice(cursor) });
                      }

                      const annotatorName = taskItem?.annotatorId?.fullName || taskItem?.annotatorId?.username || 'Annotator';

                      return (
                        <p className={`whitespace-pre-wrap text-sm leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {parts.map((part, idx) => {
                            if (part.type === 'text') return <React.Fragment key={`txt-${idx}`}>{part.value}</React.Fragment>;

                            const color = getLabelColor(part.label);
                            return (
                              <mark
                                key={`span-${idx}`}
                                className="px-1 rounded mx-[1px]"
                                style={{
                                  backgroundColor: `${color}33`,
                                  borderBottom: `2px solid ${color}`,
                                  color: darkMode ? '#e2e8f0' : '#0f172a',
                                }}
                                title={showAnnotatorLabels ? `${part.label} • ${annotatorName}` : part.label}
                              >
                                {part.value}
                                <span
                                  className="ml-1 text-[10px] font-semibold"
                                  style={{ color }}
                                >
                                  [{part.label}{showAnnotatorLabels ? ` • ${annotatorName}` : ''}]
                                </span>
                              </mark>
                            );
                          })}
                        </p>
                      );
                    };

                    return (
                      <div className="flex flex-col h-full min-h-[400px] space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setShowAnnotatorLabels((prev) => !prev)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${showAnnotatorLabels
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                          >
                            {showAnnotatorLabels ? 'Ẩn tên annotator' : 'Hiện tên annotator'}
                          </button>

                          <button
                            onClick={() => {
                              const next = {};
                              relatedTasks.forEach((t) => {
                                const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                                if (aid) next[aid] = true;
                              });
                              setAnnotatorVisibility(next);
                            }}
                            className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          >
                            Hiện tất cả
                          </button>
                        </div>

                        {relatedTasks.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {relatedTasks.map((t) => {
                              const aid = (t?.annotatorId?._id || t?.annotatorId)?.toString?.() || '';
                              const name = t?.annotatorId?.fullName || t?.annotatorId?.username || 'Annotator';
                              const isVisible = annotatorVisibility[aid] !== false;
                              return (
                                <button
                                  key={aid}
                                  onClick={() => {
                                    const nextVisible = !isVisible;
                                    setAnnotatorVisibility((prev) => ({ ...prev, [aid]: nextVisible }));
                                    if (nextVisible) {
                                      setActiveAnnotatorId(aid);
                                    } else if (activeAnnotatorId === aid) {
                                      setActiveAnnotatorId('');
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${isVisible
                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                >
                                  {isVisible ? 'ON' : 'OFF'} • {name}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                          {textCompareTasks.map((t, idx) => {
                            const annotatorName = t?.annotatorId?.fullName || t?.annotatorId?.username || `Annotator ${idx + 1}`;
                            const spans = t?.labels?.spans || t?.labels?.sentences || [];
                            const aid = t?.annotatorId?._id || t?.annotatorId || `ann_${idx}`;
                            const isPrimary = Boolean(t?.primaryForItem);

                            return (
                              <div key={aid} className={`rounded-xl border p-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-200 font-semibold">
                                      {annotatorName}
                                      {isPrimary ? ' ★ PRIMARY' : ''}
                                    </span>
                                    <span className="text-xs text-slate-400">{spans.length} labels</span>
                                  </div>
                                </div>

                                <div className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                  {renderHighlightedText(t)}
                                </div>
                              </div>
                            );
                          })}
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
                  {groupedQueueTasks.length} ACTIONABLE
                </span>
              </div>
              <div className="space-y-3">
                {groupedQueueTasks.length === 0 ? (
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Không có task nào bạn có thể chấm lúc này.
                  </div>
                ) : (
                  groupedQueueTasks.map((group) => {
                    const pendingTask = group.representative;
                    const isActive = group.tasks.some((t) => t._id === id);
                    const timeAgo = group.latestSubmittedAt ? getTimeAgo(group.latestSubmittedAt) : '';
                    return (
                      <button
                        key={group.key}
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
                              ITEM-{pendingTask._id?.substring(0, 8).toUpperCase()}-{pendingTask._id?.slice(-4).toUpperCase()}
                            </div>
                            <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {pendingTask.projectId?.name || 'Project'}
                            </div>
                            <div className={`text-xs truncate ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                              {pendingTask.dataItem?.originalName || pendingTask.dataItem?.filename || pendingTask.dataItem?.path || 'Unknown item'}
                            </div>
                            <div className={`text-xs truncate ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                              {group.tasks.length} annotator • nhấn để xem label từng annotator
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
                  <p>Reject bắt buộc comment. Approve không bắt buộc.</p>
                  <p>Sau khi review, task sẽ bị khóa.</p>

                  {/* {datasetType === 'image' && (
                    <div className="pt-2 border-t border-slate-700 space-y-1">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Object Summary</p>
                      <p className="text-slate-200">Detected Objects: {(task?.labels?.objects || []).length}</p>
                      {imageClassSummary.map(([name, count]) => (
                        <p key={name} className="text-xs text-slate-300">• {name}: {count}</p>
                      ))}
                    </div>
                  )} */}

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

              {/* <div>
                <h3 className="text-xl font-semibold text-white mb-3">Error Checklist ({datasetType.toUpperCase()})</h3>
                <p className="text-xs text-slate-400 mb-3">
                  {datasetType === 'image' && 'Chọn các lỗi về bounding box và object trong ảnh'}
                  {datasetType === 'audio' && 'Chọn các lỗi về segment và timestamp trong audio'}
                  {datasetType === 'text' && 'Chọn các lỗi về entity và span trong văn bản'}
                </p>
                <div className="space-y-3">
                  {issueOptions.map((issue) => {
                    const checked = selectedIssues.includes(issue.id);
                    return (
                      <div key={issue.id} className="rounded-xl border border-slate-700 bg-[#0f172a] p-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedIssues((prev) => isChecked
                                ? [...prev, issue.id]
                                : prev.filter((x) => x !== issue.id));
                            }}
                            className="h-4 w-4 mt-1 rounded border-slate-600 bg-[#0f172a] text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-slate-200 font-medium">{issue.label}</span>
                            {issue.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{issue.description}</p>
                            )}
                          </div>
                        </label>

                        {checked && issue.needsTarget && (
                          <div className="mt-3 ml-7 space-y-2">
                            <p className="text-xs text-slate-400">{issue.targetLabel}</p>
                            <select
                              value={issueTargets[issue.id] || ''}
                              onChange={(e) => setIssueTargets((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              className="w-full rounded-lg bg-[#0f172a] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm px-3 py-2"
                            >
                              <option value="">-- Chọn {issue.targetLabel} --</option>
                              {targetOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {checked && (
                          <div className="mt-3 ml-7">
                            <textarea
                              value={issueComments[issue.id] || ''}
                              onChange={(e) => setIssueComments((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              rows={2}
                              placeholder="Mô tả chi tiết lỗi (tùy chọn)"
                              className="w-full rounded-lg bg-[#0f172a] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm px-3 py-2"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div> */}

              <div>
                <h3 className="text-xl font-semibold text-white mb-3"> Comment</h3>
                <div className="rounded-xl border border-blue-700/40 bg-gradient-to-b from-[#0f172a] to-[#0b1220] p-4 space-y-3 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]">
                  {/* <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-blue-200 block">Overall Feedback</label>
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${reviewComments.trim().length >= 12 ? 'text-emerald-300 border-emerald-600/40 bg-emerald-900/20' : 'text-amber-300 border-amber-600/40 bg-amber-900/20'}`}>
                      {reviewComments.trim().length >= 12 ? 'Đủ nội dung' : 'Nên >= 12 ký tự'}
                    </span>
                  </div> */}
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    rows={5}
                    placeholder={datasetType === 'image'
                      ? 'Ví dụ: gán nhãn sai....'
                      : datasetType === 'audio'
                        ? 'Ví dụ: Segment #2 sai nhãn, Segment #3 lệch timestamp 0.5s.'
                        : 'Ví dụ: Missing entity LOCATION ở cuối câu, span entity #2 sai.'}
                    disabled={isLockedForReview}
                    className="w-full rounded-lg bg-[#0a1020] border border-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 text-slate-100 text-sm px-3 py-3 placeholder:text-slate-400 disabled:opacity-60"
                  />
                  {/* <div className="text-xs text-slate-300 rounded-lg border border-slate-700 bg-[#0b1328] px-3 py-2">
                    {selectedIssueDetails.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-blue-200 font-semibold">Issues selected ({selectedIssueDetails.length})</p>
                        {selectedIssueDetails.map((issue) => (
                          <p key={issue.id}>• {issue.label}{issueTargets[issue.id] ? ` (${issueTargets[issue.id]})` : ''}</p>
                        ))}
                      </div>
                    )}
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Dock */}
      {!isLockedForReview && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl ${darkMode
          ? 'bg-gray-800/95 backdrop-blur-xl border border-gray-700'
          : 'bg-white/95 backdrop-blur-xl border border-gray-200/50'
          }`}>
          {/* <button
            onClick={handleSkip}
            className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            <span className="mr-2"></span> Skip
          </button> */}
          <button
            onClick={handleReject}
            disabled={processing || isLockedForReview || !activeAnnotatorId || selectedAnnotatorCount !== 1}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isOverdue
              ? 'Task đã quá hạn, không thể review'
              : (isReviewed ? 'Task/annotator này đã được đánh giá rồi' : (!activeAnnotatorId ? 'Chọn 1 annotator để chấm' : (selectedAnnotatorCount !== 1 ? 'Chỉ được bật ON đúng 1 annotator' : '')))}
          >
            <span className="mr-2">✕</span> Reject
          </button>
          {/* {canSetPrimary && (
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
          )} */}
          <button
            onClick={handleApprove}
            disabled={processing || isLockedForReview || !activeAnnotatorId || selectedAnnotatorCount !== 1}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isOverdue
              ? 'Task đã quá hạn, không thể review'
              : (isReviewed ? 'Task/annotator này đã được đánh giá rồi' : (!activeAnnotatorId ? 'Chọn 1 annotator để chấm' : (selectedAnnotatorCount !== 1 ? 'Chỉ được bật ON đúng 1 annotator' : '')))}
          >
            <span className="mr-2">✓</span> Approve Task
          </button>
          <div className={`flex items-center gap-2 ml-4 pl-4 border-l ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            {/* <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              AUTO-NEXT
            </span> */}
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