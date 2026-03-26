import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const detectType = (task) => {
  const mime = (task?.dataItem?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || task?.dataItem?.text) return 'text';
  return 'other';
};

const notSubmittedStatuses = ['assigned', 'in_progress', 'completed', 'revised'];

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

const PROJECT_APPROVE_THRESHOLD = 0.7;
const PROJECT_REJECT_THRESHOLD = 0.3;
const NEAR_DEADLINE_HOURS = 48;

const getProjectTimelineStatus = ({ deadline, reviewStatus }) => {
  const normalizedReview = (reviewStatus || 'pending').toLowerCase();

  if (normalizedReview === 'approved') {
    return {
      key: 'approved',
      label: 'ĐÃ APPROVE',
      tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    };
  }

  if (normalizedReview === 'rejected') {
    return {
      key: 'rejected',
      label: 'ĐÃ REJECT',
      tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    };
  }

  if (deadline) {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();

    if (diffMs < 0) {
      return {
        key: 'overdue',
        label: 'QUÁ HẠN',
        tone: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      };
    }

    const nearDeadlineMs = NEAR_DEADLINE_HOURS * 60 * 60 * 1000;
    if (diffMs <= nearDeadlineMs) {
      return {
        key: 'near_deadline',
        label: 'CẬN DEADLINE',
        tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      };
    }
  }

  return {
    key: 'on_time',
    label: 'CÒN HẠN',
    tone: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };
};

const ReviewerDashboard = () => {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedBatchKey, setSelectedBatchKey] = useState('');
  const [projectReviewInfo, setProjectReviewInfo] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [reviewedTasks, setReviewedTasks] = useState([]);
  const [selectedReviewedAnnotatorId, setSelectedReviewedAnnotatorId] = useState('');
  const [selectedAnnotatorIds, setSelectedAnnotatorIds] = useState([]);
  const [expandedReviewedItemId, setExpandedReviewedItemId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllReviewerTasks();
  }, []);

  const fetchAllReviewerTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/reviews/overview`);
      setAllTasks(response.data.tasks || []);
      const reviewedRes = await axios.get(`${API_URL}/api/reviews/reviewed`);
      setReviewedTasks(reviewedRes.data || []);
    } catch (error) {
      console.error('Error fetching reviewer overview:', error);
      setAllTasks([]);
      setReviewedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => (selectedType === 'all' ? true : detectType(task) === selectedType));
  }, [allTasks, selectedType]);

  const groupedBatches = useMemo(() => {
    const groups = {};

    filteredTasks.forEach((task) => {
      const projectId = task?.projectId?._id || 'unknown-project';
      const datasetId = task?.datasetId?._id || 'unknown-dataset';
      const type = detectType(task);
      const key = `${projectId}::${datasetId}::${type}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          projectId,
          projectName: task?.projectId?.name || 'Unknown Project',
          datasetId,
          datasetName: task?.datasetId?.name || 'Unknown Dataset',
          type,
          tasks: [],
          annotators: {},
        };
      }

      groups[key].tasks.push(task);

      const annotatorId = task?.annotatorId?._id || 'unknown-annotator';
      const annotatorName = task?.annotatorId?.fullName || task?.annotatorId?.username || 'Unknown Annotator';

      if (!groups[key].annotators[annotatorId]) {
        groups[key].annotators[annotatorId] = {
          annotatorId,
          annotatorName,
          totalTasks: 0,
          submittedTasks: 0,
          reviewedTasks: 0,
          notSubmittedTasks: 0,
          actionableTaskIds: [],
          latestSubmittedAt: null,
        };
      }

      const ann = groups[key].annotators[annotatorId];
      ann.totalTasks += 1;

      if (task?.status === 'submitted') {
        ann.submittedTasks += 1;
        ann.actionableTaskIds.push(task._id);
        const submittedAt = task?.submittedAt ? new Date(task.submittedAt) : null;
        if (submittedAt && (!ann.latestSubmittedAt || submittedAt > ann.latestSubmittedAt)) {
          ann.latestSubmittedAt = submittedAt;
        }
      } else if (task?.status === 'approved' || task?.status === 'rejected') {
        ann.reviewedTasks += 1;
      } else if (notSubmittedStatuses.includes(task?.status)) {
        ann.notSubmittedTasks += 1;
      }
    });

    return Object.values(groups)
      .map((group) => {
        const annotatorRows = Object.values(group.annotators).sort((a, b) => {
          if (b.submittedTasks !== a.submittedTasks) return b.submittedTasks - a.submittedTasks;
          return a.annotatorName.localeCompare(b.annotatorName);
        });

        const submittedAnnotators = annotatorRows.filter((a) => a.submittedTasks > 0).length;
        const reviewedAnnotators = annotatorRows.filter((a) => a.reviewedTasks > 0).length;
        const notSubmittedAnnotators = annotatorRows.filter((a) => a.submittedTasks === 0 && a.reviewedTasks === 0).length;
        const firstActionableTaskId = annotatorRows.find((a) => a.actionableTaskIds.length > 0)?.actionableTaskIds?.[0] || null;

        const projectDeadline = group.tasks
          .map((t) => t?.projectId?.deadline)
          .find(Boolean) || null;

        const projectDecisionStatus = group.tasks
          .map((t) => t?.projectId?.projectReview?.status)
          .find((s) => s === 'approved' || s === 'rejected') || 'pending';

        const timelineStatus = getProjectTimelineStatus({
          deadline: projectDeadline,
          reviewStatus: projectDecisionStatus,
        });

        return {
          ...group,
          annotatorRows,
          annotatorCount: annotatorRows.length,
          submittedAnnotators,
          reviewedAnnotators,
          notSubmittedAnnotators,
          firstActionableTaskId,
          projectDeadline,
          projectDecisionStatus,
          timelineStatus,
        };
      })
      .sort((a, b) => {
        const statusPriority = {
          near_deadline: 0,
          on_time: 1,
          approved: 2,
          rejected: 2,
          overdue: 3,
        };

        const aPriority = statusPriority[a.timelineStatus?.key] ?? 99;
        const bPriority = statusPriority[b.timelineStatus?.key] ?? 99;
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Nhóm còn hạn/cận deadline/quá hạn: ưu tiên deadline gần nhất trước
        if (['near_deadline', 'on_time', 'overdue'].includes(a.timelineStatus?.key) && ['near_deadline', 'on_time', 'overdue'].includes(b.timelineStatus?.key)) {
          const aDeadline = a.projectDeadline ? new Date(a.projectDeadline).getTime() : Number.POSITIVE_INFINITY;
          const bDeadline = b.projectDeadline ? new Date(b.projectDeadline).getTime() : Number.POSITIVE_INFINITY;
          if (aDeadline !== bDeadline) return aDeadline - bDeadline;
        }

        if (b.submittedAnnotators !== a.submittedAnnotators) return b.submittedAnnotators - a.submittedAnnotators;
        return a.projectName.localeCompare(b.projectName);
      });
  }, [filteredTasks]);

  const selectedBatch = useMemo(() => {
    return groupedBatches.find((g) => g.key === selectedBatchKey) || groupedBatches[0] || null;
  }, [groupedBatches, selectedBatchKey]);

  const selectedBatchTimelineStatus = useMemo(() => {
    if (!selectedBatch) return null;
    return getProjectTimelineStatus({
      deadline: selectedBatch.projectDeadline,
      reviewStatus: selectedBatch.projectDecisionStatus,
    });
  }, [selectedBatch]);

  const isSelectedBatchOverdue = selectedBatchTimelineStatus?.key === 'overdue';

  useEffect(() => {
    if (!selectedBatch?.annotatorRows) return;
    setSelectedAnnotatorIds([]);
  }, [selectedBatch?.key]);

  const filteredReviewedTasks = useMemo(() => {
    if (!selectedBatch?.projectId || !selectedBatch?.datasetId) return [];
    return reviewedTasks.filter((task) => {
      const projId = task.projectId?._id || task.projectId;
      const dsId = task.datasetId?._id || task.datasetId;
      const annId = task.annotatorId?._id || task.annotatorId;
      const matchesBatch = projId?.toString?.() === selectedBatch.projectId?.toString?.() &&
        dsId?.toString?.() === selectedBatch.datasetId?.toString?.();
      const matchesAnnotator = selectedReviewedAnnotatorId
        ? annId?.toString?.() === selectedReviewedAnnotatorId.toString()
        : true;
      return matchesBatch && matchesAnnotator;
    });
  }, [reviewedTasks, selectedBatch?.projectId, selectedBatch?.datasetId, selectedReviewedAnnotatorId]);

  const reviewedItems = useMemo(() => {
    const map = new Map();
    filteredReviewedTasks.forEach((task) => {
      const dataItem = task?.dataItem || task?.datasetItemId || task?.itemId || {};
      const itemId = dataItem?._id
        || dataItem?.imageUrl
        || dataItem?.path
        || dataItem?.filename
        || task?.datasetItemId?._id
        || task?.datasetItemId
        || task?.itemId?._id
        || task?.itemId
        || task?.dataItemId
        || task?._id;
      if (!itemId) return;
      const existing = map.get(itemId.toString());
      if (!existing) {
        map.set(itemId.toString(), {
          itemId: itemId.toString(),
          dataItem,
          tasks: [task],
          projectName: task.projectId?.name || 'Project',
          datasetName: task.datasetId?.name || 'Dataset',
        });
      } else {
        existing.tasks.push(task);
      }
    });
    return Array.from(map.values());
  }, [filteredReviewedTasks]);

  const selectedPendingAnnotators = useMemo(() => {
    if (!selectedBatch?.annotatorRows) return [];
    return selectedBatch.annotatorRows.filter((ann) => selectedAnnotatorIds.includes(ann.annotatorId));
  }, [selectedBatch?.annotatorRows, selectedAnnotatorIds]);

  const projectReviewStats = useMemo(() => {
    if (!selectedBatch?.projectId || !selectedBatch?.datasetId) {
      return {
        totalReviewed: 0,
        approvedCount: 0,
        rejectedCount: 0,
        approvedRate: 0,
        rejectedRate: 0,
      };
    }

    const projectReviewed = reviewedTasks.filter((task) => {
      const projId = task.projectId?._id || task.projectId;
      const dsId = task.datasetId?._id || task.datasetId;
      return projId?.toString?.() === selectedBatch.projectId?.toString?.()
        && dsId?.toString?.() === selectedBatch.datasetId?.toString?.();
    });

    const approvedCount = projectReviewed.filter((t) => t.status === 'approved').length;
    const rejectedCount = projectReviewed.filter((t) => t.status === 'rejected').length;
    const totalReviewed = projectReviewed.length;
    const approvedRate = totalReviewed > 0 ? approvedCount / totalReviewed : 0;
    const rejectedRate = totalReviewed > 0 ? rejectedCount / totalReviewed : 0;

    return {
      totalReviewed,
      approvedCount,
      rejectedCount,
      approvedRate,
      rejectedRate,
    };
  }, [reviewedTasks, selectedBatch?.projectId, selectedBatch?.datasetId]);

  const projectMajority = useMemo(() => {
    if (projectReviewStats.totalReviewed === 0) {
      return { status: 'pending', label: 'Chưa đủ dữ liệu', tone: 'bg-slate-700 text-slate-200' };
    }
    if (projectReviewStats.approvedRate >= PROJECT_APPROVE_THRESHOLD) {
      return { status: 'approved', label: 'Khuyến Nghị: APPROVED', tone: 'bg-emerald-500/20 text-emerald-300' };
    }
    if (projectReviewStats.rejectedRate >= PROJECT_REJECT_THRESHOLD) {
      return { status: 'rejected', label: 'Khuyến Nghị: REJECTED', tone: 'bg-rose-500/20 text-rose-300' };
    }
    return { status: 'review', label: 'Cần rà soát thêm', tone: 'bg-amber-500/20 text-amber-300' };
  }, [projectReviewStats]);

  useEffect(() => {
    const fetchProjectReview = async () => {
      if (!selectedBatch?.projectId) {
        setProjectReviewInfo(null);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/projects/${selectedBatch.projectId}`);
        setProjectReviewInfo({
          review: res.data?.project?.projectReview || null,
          snapshot: res.data?.projectReviewSnapshot || null,
        });
      } catch {
        setProjectReviewInfo(null);
      }
    };
    fetchProjectReview();
  }, [selectedBatch?.projectId]);

  const handleProjectDecision = async (status) => {
    if (!selectedBatch?.projectId) return;

    if (projectReviewInfo?.snapshot?.actionableLeft > 0) {
      alert('Chưa thể chốt project vì vẫn còn task chưa review xong.');
      return;
    }

    if (status === 'approved' && projectReviewStats.approvedRate < PROJECT_APPROVE_THRESHOLD) {
      alert('Chưa đủ tỷ lệ đồng thuận để duyệt project theo số đông.');
      return;
    }

    if (status === 'rejected' && projectReviewStats.rejectedRate < PROJECT_REJECT_THRESHOLD) {
      alert('Chưa đủ tỷ lệ đồng thuận để từ chối project theo số đông.');
      return;
    }

    try {
      setDecisionLoading(true);
      await axios.post(`${API_URL}/api/projects/${selectedBatch.projectId}/review-decision`, {
        status,
        comment: decisionComment,
      });
      alert(`Đã cập nhật project: ${status === 'approved' ? 'DUYỆT' : 'TỪ CHỐI'}`);
      setDecisionComment('');
      fetchAllReviewerTasks();
      const res = await axios.get(`${API_URL}/api/projects/${selectedBatch.projectId}`);
      setProjectReviewInfo({
        review: res.data?.project?.projectReview || null,
        snapshot: res.data?.projectReviewSnapshot || null,
      });
    } catch (error) {
      alert(error?.response?.data?.message || 'Không thể cập nhật quyết định project');
    } finally {
      setDecisionLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px] bg-[#0f172a]">
        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 md:p-10 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-white">Review Tasks</h1>
            <p className="text-slate-400 mt-1">Hiển thị project/dataset được giao và trạng thái nộp của từng annotator.</p>
          </div>
          <button
            onClick={fetchAllReviewerTasks}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
          >
            Refresh
          </button>
        </div>


        <div className="flex gap-2 flex-wrap">
          {['all', 'image', 'audio', 'text'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-full text-xs border ${selectedType === t
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-[#1e293b] border-slate-600 text-slate-300'
                }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="lg:col-span-1 bg-[#1e293b] border-r border-slate-700">
            <div className="p-4 border-b border-slate-700 text-sm font-semibold text-slate-200">Project / Dataset được giao</div>
            <div className="max-h-[640px] overflow-auto">
              {groupedBatches.length === 0 ? (
                <div className="p-6 text-sm text-slate-400">Không có batch nào.</div>
              ) : groupedBatches.map((batch) => {
                const timelineStatus = getProjectTimelineStatus({
                  deadline: batch.projectDeadline,
                  reviewStatus: batch.projectDecisionStatus,
                });

                return (
                  <button
                    key={batch.key}
                    onClick={() => setSelectedBatchKey(batch.key)}
                    className={`w-full text-left p-4 border-b border-slate-700/60 hover:bg-slate-700/30 ${selectedBatch?.key === batch.key ? 'bg-slate-700/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-100">{batch.projectName}</p>
                      <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${timelineStatus.tone}`}>
                        {timelineStatus.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{batch.datasetName} • {batch.type.toUpperCase()}</p>
                    <p className="text-xs mt-2 text-slate-300">
                      Annotators: {batch.annotatorCount} • Đã nộp: {batch.submittedAnnotators} • Chưa nộp: {batch.notSubmittedAnnotators}
                    </p>
                    {batch.projectDeadline && (
                      <p className="text-[11px] mt-1 text-slate-400">
                        Deadline: {new Date(batch.projectDeadline).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#0f172a]">
            <div className="p-4 border-b border-slate-700 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-white">{selectedBatch?.projectName || 'Chọn một batch'}</h2>
                {selectedBatchTimelineStatus && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${selectedBatchTimelineStatus.tone}`}>
                    {selectedBatchTimelineStatus.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">{selectedBatch?.datasetName || ''}</p>

              {selectedBatch?.projectId && (
                <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-slate-300">
                      Trạng thái duyệt project: <b className="text-white">{(projectReviewInfo?.review?.status || 'pending').toUpperCase()}</b>
                    </p>
                    {selectedBatchTimelineStatus && (
                      <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${selectedBatchTimelineStatus.tone}`}>
                        {selectedBatchTimelineStatus.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Còn cần xử lý: {projectReviewInfo?.snapshot?.actionableLeft ?? '-'} task
                  </p>
                  {selectedBatch?.projectDeadline && (
                    <p className="text-xs text-slate-400">
                      Deadline project: {new Date(selectedBatch.projectDeadline).toLocaleString('vi-VN')}
                    </p>
                  )}

                  {projectReviewInfo?.snapshot?.actionableLeft > 0 && (
                    <p className="text-xs text-amber-300">
                      Chưa thể chốt project: vẫn còn task chưa review xong.
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full font-semibold ${projectMajority.tone}`}>
                      {projectMajority.label}
                    </span>
                    <span className="text-slate-400">
                      Approved: {(projectReviewStats.approvedRate * 100).toFixed(1)}% • Rejected: {(projectReviewStats.rejectedRate * 100).toFixed(1)}%
                    </span>
                  </div>

                  {projectReviewInfo?.review?.status !== 'pending' && (
                    <p className="text-xs text-blue-300">
                      Project đã được chốt là <b>{projectReviewInfo?.review?.status?.toUpperCase()}</b>. 
                    </p>
                  )}

                  <textarea
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    placeholder="Ghi chú quyết định project (tuỳ chọn)"
                    className="w-full min-h-[64px] rounded-lg bg-[#0f172a] border border-slate-700 text-slate-200 px-2 py-1 text-sm"
                    disabled={decisionLoading || (projectReviewInfo?.snapshot?.actionableLeft > 0) || projectReviewInfo?.review?.status !== 'pending'}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={decisionLoading
                        || (projectReviewInfo?.snapshot?.actionableLeft > 0)
                        || projectReviewInfo?.review?.status === 'approved'
                        || projectReviewStats.approvedRate < PROJECT_APPROVE_THRESHOLD}
                      onClick={() => handleProjectDecision('approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
                    >
                      Duyệt project
                    </button>
                    <button
                      disabled={decisionLoading
                        || (projectReviewInfo?.snapshot?.actionableLeft > 0)
                        || projectReviewInfo?.review?.status === 'rejected'
                        || projectReviewStats.rejectedRate < PROJECT_REJECT_THRESHOLD}
                      onClick={() => handleProjectDecision('rejected')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm disabled:opacity-40"
                    >
                      Từ chối project
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 max-h-[640px] overflow-auto">
              {!selectedBatch ? (
                <p className="text-slate-400">Không có dữ liệu annotator.</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-700 bg-[#1e293b] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-100">Task chờ review</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const selectable = selectedBatch.annotatorRows.map((a) => a.annotatorId);
                            setSelectedAnnotatorIds(selectable);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          onClick={() => setSelectedAnnotatorIds([])}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                        >
                          Bỏ chọn
                        </button>
                        <button
                          disabled={selectedAnnotatorIds.length === 0 || isSelectedBatchOverdue}
                          onClick={() => {
                            if (isSelectedBatchOverdue) {
                              alert('Project đã quá hạn, không thể mở task để review.');
                              return;
                            }
                            const chosen = selectedPendingAnnotators
                              .find((ann) => ann.actionableTaskIds[0])
                              ?.actionableTaskIds?.[0];
                            if (!chosen) {
                              alert('Không có task chờ review trong nhóm đã chọn.');
                              return;
                            }
                            const annotatorQuery = selectedAnnotatorIds.join(',');
                            navigate(`/reviewer/tasks/${chosen}?projectId=${selectedBatch.projectId}&datasetId=${selectedBatch.datasetId}&annotatorIds=${annotatorQuery}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-40"
                        >
                          Mở task chờ review tổng
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {selectedBatch.annotatorRows.map((ann) => {
                        const hasSubmission = ann.submittedTasks > 0;
                        const hasReviewed = ann.reviewedTasks > 0;
                        const statusText = hasSubmission ? 'ĐANG CHỜ REVIEW' : (hasReviewed ? 'ĐÃ REVIEW XONG' : 'CHƯA NỘP');
                        const statusClass = hasSubmission
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : hasReviewed
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300';

                        const isSelected = selectedAnnotatorIds.includes(ann.annotatorId);
                        return (
                          <div key={ann.annotatorId} className="rounded-xl border border-slate-700 bg-[#0f172a] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedAnnotatorIds((prev) => (
                                      checked
                                        ? [...prev, ann.annotatorId]
                                        : prev.filter((id) => id !== ann.annotatorId)
                                    ));
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-[#0f172a] text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <p className="font-semibold text-slate-100">{ann.annotatorName}</p>
                                  <p className="text-xs text-slate-400 mt-1">Tổng item: {ann.totalTasks}</p>
                                </div>
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusClass}`}>
                                {statusText}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                              <div className="rounded-lg border border-slate-700 bg-[#1e293b] p-2 text-slate-300">Chờ review: <b>{ann.submittedTasks}</b></div>
                              <div className="rounded-lg border border-slate-700 bg-[#1e293b] p-2 text-slate-300">Đã review: <b>{ann.reviewedTasks}</b></div>
                              <div className="rounded-lg border border-slate-700 bg-[#1e293b] p-2 text-slate-300">Chưa nộp: <b>{ann.notSubmittedTasks}</b></div>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                disabled={!hasSubmission || !ann.actionableTaskIds[0] || isSelectedBatchOverdue}
                                onClick={() => {
                                  if (isSelectedBatchOverdue) {
                                    alert('Project đã quá hạn, không thể mở task để review.');
                                    return;
                                  }
                                  if (!ann.actionableTaskIds[0]) return;
                                  navigate(`/reviewer/tasks/${ann.actionableTaskIds[0]}?projectId=${selectedBatch.projectId}&datasetId=${selectedBatch.datasetId}&annotatorId=${ann.annotatorId}`);
                                }}
                                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-40"
                              >
                                Mở task chờ review
                              </button>
                              <button
                                disabled={!hasReviewed}
                                onClick={() => setSelectedReviewedAnnotatorId(ann.annotatorId)}
                                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-40"
                              >
                                Xem lại review
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-[#1e293b] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-100">Task đã review (theo project/dataset đang chọn)</h3>
                    </div>

                    {reviewedItems.length === 0 ? (
                      <p className="text-sm text-slate-400">Chưa có task đã review cho batch này.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {reviewedItems.map((item) => {
                          const thumbUrl = item?.dataItem?.mimeType?.startsWith('image/')
                            ? buildFileUrl(item.dataItem)
                            : '';
                          const isExpanded = expandedReviewedItemId === item.itemId;
                          return (
                            <div key={item.itemId} className="rounded-xl border border-slate-700 bg-[#0f172a] p-2">
                              <button
                                type="button"
                                onClick={() => setExpandedReviewedItemId(isExpanded ? '' : item.itemId)}
                                className="w-full text-left"
                              >
                                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                                  {thumbUrl ? (
                                    <img
                                      src={thumbUrl}
                                      alt="Item thumbnail"
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                                      No image
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-200 truncate">{item.projectName}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{item.datasetName}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 font-semibold">
                                      {item.tasks.length} annotator
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="mt-2 space-y-2">
                                  {item.tasks.map((task) => (
                                    <div key={task._id} className="rounded-lg border border-slate-700 bg-[#0b1220] p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs text-slate-300 truncate">{task.annotatorId?.fullName || task.annotatorId?.username || 'Annotator'}</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${task.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                          {task.status === 'approved' ? 'APPROVED' : 'REJECTED'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => navigate(`/reviewer/tasks/${task._id}?projectId=${task.projectId?._id}&datasetId=${task.datasetId?._id}&annotatorId=${task.annotatorId?._id}&reviewOnly=1`)}
                                        className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs"
                                      >
                                        Xem chi tiết
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
