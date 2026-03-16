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

        return {
          ...group,
          annotatorRows,
          annotatorCount: annotatorRows.length,
          submittedAnnotators,
          reviewedAnnotators,
          notSubmittedAnnotators,
          firstActionableTaskId,
        };
      })
      .sort((a, b) => {
        if (b.submittedAnnotators !== a.submittedAnnotators) return b.submittedAnnotators - a.submittedAnnotators;
        return a.projectName.localeCompare(b.projectName);
      });
  }, [filteredTasks]);

  const selectedBatch = useMemo(() => {
    return groupedBatches.find((g) => g.key === selectedBatchKey) || groupedBatches[0] || null;
  }, [groupedBatches, selectedBatchKey]);

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

  const selectedPendingAnnotators = useMemo(() => {
    if (!selectedBatch?.annotatorRows) return [];
    return selectedBatch.annotatorRows.filter((ann) => selectedAnnotatorIds.includes(ann.annotatorId));
  }, [selectedBatch?.annotatorRows, selectedAnnotatorIds]);

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

  const stats = useMemo(() => {
    const submitted = allTasks.filter((t) => t.status === 'submitted').length;
    const inReview = allTasks.filter((t) => t.status === 'approved' || t.status === 'rejected').length;
    const notSubmitted = allTasks.filter((t) => notSubmittedStatuses.includes(t.status)).length;

    return {
      total: allTasks.length,
      submitted,
      inReview,
      notSubmitted,
    };
  }, [allTasks]);

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
            <h1 className="text-3xl font-semibold text-white">Reviewer Dashboard</h1>
            <p className="text-slate-400 mt-1">Hiển thị project/dataset được giao và trạng thái nộp của từng annotator.</p>
          </div>
          <button
            onClick={fetchAllReviewerTasks}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
            <p className="text-xs uppercase text-slate-400">Total assigned items</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
            <p className="text-xs uppercase text-slate-400">Submitted to reviewer</p>
            <p className="text-2xl font-bold text-emerald-300">{stats.submitted}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
            <p className="text-xs uppercase text-slate-400">Not submitted yet</p>
            <p className="text-2xl font-bold text-amber-300">{stats.notSubmitted}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
            <p className="text-xs uppercase text-slate-400">Already reviewed</p>
            <p className="text-2xl font-bold text-blue-300">{stats.inReview}</p>
          </div>
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
              ) : groupedBatches.map((batch) => (
                <button
                  key={batch.key}
                  onClick={() => setSelectedBatchKey(batch.key)}
                  className={`w-full text-left p-4 border-b border-slate-700/60 hover:bg-slate-700/30 ${selectedBatch?.key === batch.key ? 'bg-slate-700/40' : ''}`}
                >
                  <p className="font-semibold text-slate-100">{batch.projectName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{batch.datasetName} • {batch.type.toUpperCase()}</p>
                  <p className="text-xs mt-2 text-slate-300">
                    Annotators: {batch.annotatorCount} • Đã nộp: {batch.submittedAnnotators} • Chưa nộp: {batch.notSubmittedAnnotators}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#0f172a]">
            <div className="p-4 border-b border-slate-700 space-y-2">
              <h2 className="text-lg font-semibold text-white">{selectedBatch?.projectName || 'Chọn một batch'}</h2>
              <p className="text-sm text-slate-400">{selectedBatch?.datasetName || ''}</p>

              {selectedBatch?.projectId && (
                <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-3 space-y-2">
                  <p className="text-xs text-slate-300">
                    Trạng thái duyệt project: <b className="text-white">{(projectReviewInfo?.review?.status || 'pending').toUpperCase()}</b>
                  </p>
                  <p className="text-xs text-slate-400">
                    Còn cần xử lý: {projectReviewInfo?.snapshot?.actionableLeft ?? '-'} task
                  </p>

                  {projectReviewInfo?.snapshot?.actionableLeft > 0 && (
                    <p className="text-xs text-amber-300">
                      Chưa thể chốt project: vẫn còn task chưa review xong.
                    </p>
                  )}

                  {projectReviewInfo?.review?.status !== 'pending' && (
                    <p className="text-xs text-blue-300">
                      Project đã được chốt là <b>{projectReviewInfo?.review?.status?.toUpperCase()}</b>. Muốn đổi quyết định, hãy đảm bảo đã rà soát lại toàn bộ task.
                    </p>
                  )}

                  <textarea
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    placeholder="Ghi chú quyết định project (tuỳ chọn)"
                    className="w-full min-h-[64px] rounded-lg bg-[#0f172a] border border-slate-700 text-slate-200 px-2 py-1 text-sm"
                    disabled={decisionLoading || (projectReviewInfo?.snapshot?.actionableLeft > 0)}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={decisionLoading || (projectReviewInfo?.snapshot?.actionableLeft > 0) || projectReviewInfo?.review?.status === 'approved'}
                      onClick={() => handleProjectDecision('approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
                    >
                      Duyệt project
                    </button>
                    <button
                      disabled={decisionLoading || (projectReviewInfo?.snapshot?.actionableLeft > 0) || projectReviewInfo?.review?.status === 'rejected'}
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
                          disabled={selectedAnnotatorIds.length === 0}
                          onClick={() => {
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
                                disabled={!hasSubmission || !ann.actionableTaskIds[0]}
                                onClick={() => {
                                  if (!ann.actionableTaskIds[0]) return;
                                  navigate(`/reviewer/tasks/${ann.actionableTaskIds[0]}?projectId=${selectedBatch.projectId}&datasetId=${selectedBatch.datasetId}&annotatorId=${ann.annotatorId}`);
                                }}
                                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-40"
                              >
                                Mở task chờ review
                              </button>
                              <button
                                onClick={() => setSelectedReviewedAnnotatorId(ann.annotatorId)}
                                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
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

                    {filteredReviewedTasks.length === 0 ? (
                      <p className="text-sm text-slate-400">Chưa có task đã review cho batch này.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredReviewedTasks.slice(0, 20).map((task) => (
                          <div key={task._id} className="rounded-xl border border-slate-700 bg-[#0f172a] p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-100">{task.projectId?.name || 'Project'}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{task.datasetId?.name || 'Dataset'} • {task.annotatorId?.fullName || task.annotatorId?.username || 'Annotator'}</p>
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${task.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {task.status === 'approved' ? 'APPROVED' : 'REJECTED'}
                              </span>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => navigate(`/reviewer/tasks/${task._id}?projectId=${task.projectId?._id}&datasetId=${task.datasetId?._id}&annotatorId=${task.annotatorId?._id}`)}
                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs"
                              >
                                Xem lại
                              </button>
                            </div>
                          </div>
                        ))}
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
