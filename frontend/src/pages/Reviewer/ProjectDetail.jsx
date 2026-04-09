import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const fmtDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Subtopic review status
const getSubtopicStatus = (sub) => {
  const total = sub.total || 0;
  const approved = sub.approved || 0;
  const rejected = sub.rejected || 0;
  const revised = sub.revised || 0;
  const submitted = sub.submitted || 0;   // mới submit lần đầu, chưa từng bị reject
  const done = approved + rejected + revised; // đã qua ít nhất 1 vòng review

  if (total === 0) return { label: 'Chua co item', color: 'text-gray-500', icon: '○' };

  // Tất cả task đã được xử lý xong
  if (done === total) {
    if (rejected === total) return { label: 'Da reject het', color: 'text-rose-400', icon: '✗' };
    return { label: 'Hoan tat review', color: 'text-emerald-400', icon: '✓' };
  }

  // Annotator đã sửa xong và nộp lại → reviewer cần duyệt lại (ƯU TIÊN CAO NHẤT)
  if (revised > 0) return { label: 'Dang review lai', color: 'text-violet-400', icon: '▶' };

  // Có task bị reject và annotator CHƯA nộp lại → đang chờ annotator sửa
  if (rejected > 0 && submitted === 0) return { label: 'Cho annotator sua', color: 'text-amber-400', icon: '↩' };

  // Có task mới submit, chưa review
  if (submitted > 0) return { label: 'Dang cho review', color: 'text-yellow-400', icon: '⏳' };

  // Đang trong quá trình review
  return { label: 'Dang review', color: 'text-blue-400', icon: '▶' };
};

const SubtopicCard = ({ sub, onStart }) => {
  const total = sub.total || 0;
  const pending = sub.pending || 0;
  const approved = sub.approved || 0;
  const rejected = sub.rejected || 0;
  const reviewed = approved + rejected;
  const status = getSubtopicStatus(sub);
  const pct = total ? Math.round((reviewed / total) * 100) : 0;

  let btnText = 'Vao review';
  let btnColor = 'bg-violet-600 hover:bg-violet-700 text-white';
  if (pending === 0 && reviewed > 0) {
    btnText = 'Xem lai';
    btnColor = 'bg-emerald-600 hover:bg-emerald-700 text-white';
  }

  return (
    <div className="group relative rounded-xl border border-gray-700/60 bg-gray-800/60 p-4 transition-all duration-200 hover:border-violet-500/40 hover:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-100 group-hover:text-violet-300 transition-colors">
            {sub.subtopicName || sub.name || 'Subtopic'}
          </h3>
          {sub.guideline && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{sub.guideline}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
          <span>{status.icon}</span>
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-gray-900/60 p-2 text-center">
          <p className="text-lg font-bold text-gray-200">{total}</p>
          <p className="text-xs text-gray-500">Tong item</p>
        </div>
        <div className="rounded-lg bg-yellow-500/5 p-2 text-center border border-yellow-500/10">
          <p className="text-lg font-bold text-yellow-400">{pending}</p>
          <p className="text-xs text-yellow-500/70">Can review</p>
        </div>
        <div className="rounded-lg bg-gray-900/40 p-2 text-center">
          <p className="text-lg font-bold text-gray-400">{total - pending - reviewed}</p>
          <p className="text-xs text-gray-600">Chua nop</p>
        </div>
      </div>

      {/* Approved / Rejected */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-500/5 p-2 text-center border border-emerald-500/10">
          <p className="text-sm font-bold text-emerald-400">{approved}</p>
          <p className="text-xs text-emerald-500/70">Approved</p>
        </div>
        <div className="rounded-lg bg-rose-500/5 p-2 text-center border border-rose-500/10">
          <p className="text-sm font-bold text-rose-400">{rejected}</p>
          <p className="text-xs text-rose-500/70">Rejected</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Tien do review</span>
          <span className="font-medium text-gray-300">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Action button */}
      {pending > 0 && (
        <button
          onClick={() => onStart(sub)}
          className={`w-full rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all duration-200 ${btnColor}`}
        >
          {btnText}
        </button>
      )}
    </div>
  );
};

const ReviewerProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [subtopics, setSubtopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, reviewed: 0 });
  const [reviewSummary, setReviewSummary] = useState(null);
  const [canFinalize, setCanFinalize] = useState(null);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeComment, setFinalizeComment] = useState('');
  const [finalizeConfirm, setFinalizeConfirm] = useState(null); // 'approve' | 'reject' | null
  const [toast, setToast] = useState(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch project detail
      const projRes = await axios.get(`${API_URL}/api/reviews/projects/${projectId}`);
      setProject(projRes.data);

      // Fetch review stats
      const statsRes = await axios.get(`${API_URL}/api/reviews/projects/${projectId}/stats`);
      setStats(statsRes.data || { total: 0, pending: 0, approved: 0, rejected: 0, reviewed: 0 });

      // Fetch subtopic breakdown
      const subRes = await axios.get(`${API_URL}/api/reviews/projects/${projectId}/subtopics`);
      setSubtopics(subRes.data || []);

      // Fetch review summary for project finalize
      try {
        const summaryRes = await axios.get(`${API_URL}/api/projects/${projectId}/review-summary`, {
          headers: { Authorization: 'Bearer ' + getAuthToken() }
        });
        setReviewSummary(summaryRes.data.stats);
        setCanFinalize(summaryRes.data.canFinalize);
      } catch (e) {
        // reviewer-summary endpoint may not exist, ignore
      }
    } catch (err) {
      // If subtopics endpoint doesn't exist, derive from tasks
      try {
        const projRes = await axios.get(`${API_URL}/api/reviews/projects/${projectId}`);
        setProject(projRes.data);

        const statsRes = await axios.get(`${API_URL}/api/reviews/projects/${projectId}/stats`);
        setStats(statsRes.data || {});
      } catch (e) {
        setError(err.response?.data?.message || e.response?.data?.message || 'Khong tai duoc thong tin project');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleStartReview = (sub) => {
    navigate(`/reviewer/workspace/${projectId}?subtopicId=${sub.subtopicId || sub._id}`);
  };

  const handleStartAllReview = () => {
    navigate(`/reviewer/workspace/${projectId}`);
  };

  const handleFinalize = async (action) => {
    if (!canFinalize?.canFinalize) return;
    setFinalizeLoading(true);
    setToast(null);
    try {
      const endpoint = action === 'approve' ? 'approve' : 'reject';
      const res = await axios.post(
        `${API_URL}/api/projects/${projectId}/${endpoint}`,
        { comment: finalizeComment },
        { headers: { Authorization: 'Bearer ' + getAuthToken() } }
      );
      setToast({ type: 'success', message: res.data.message });
      setFinalizeConfirm(null);
      // Refresh data
      await fetchProject();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Loi he thong';
      setToast({ type: 'error', message: msg });
      if (err.response?.data?.suggestedAction) {
        // Show suggestion to user
        setToast(prev => ({ ...prev, suggestion: err.response.data.suggestedAction }));
      }
    } finally {
      setFinalizeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-violet-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Dang tai thong tin project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="mx-auto w-12 h-12 text-rose-500/60 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-400 mb-4">{error || 'Khong tim thay project nay.'}</p>
          <button
            onClick={() => navigate('/reviewer/tasks')}
            className="rounded-lg bg-violet-600 px-4 py-2 text-white text-sm hover:bg-violet-700 transition"
          >
            Quay lai danh sach project
          </button>
        </div>
      </div>
    );
  }

  const overdue = project.deadline && new Date(project.deadline) < new Date();
  const guideline = project.guidelines || project.guideline || project.projectId?.guidelines || '';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Back nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/reviewer/tasks')}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800/80 px-3 py-1.5 text-sm text-gray-400 border border-gray-700/60 hover:text-gray-200 hover:border-gray-600 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lai
          </button>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-sm text-gray-500 truncate">{project.name}</span>
        </div>

        {/* Project Header */}
        <div className="rounded-2xl border border-gray-700/60 bg-gray-800/80 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-100 mb-1">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                {project.datasetId?.name && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    {project.datasetId.name}
                  </span>
                )}
              </div>
            </div>

            {project.deadline && (
              <div className={`shrink-0 rounded-xl px-4 py-3 border ${
                overdue ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-gray-900/60 border-gray-700/60 text-gray-300'
              }`}>
                <p className="text-xs font-medium mb-0.5">{overdue ? 'Qua han!' : 'Deadline'}</p>
                <p className="text-lg font-bold">{fmtDateTime(project.deadline)}</p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mt-5">
            <div className="rounded-lg bg-gray-900/60 p-3">
              <p className="text-xs text-gray-500">Tong item</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-200">{stats.total || 0}</p>
            </div>
            <div className="rounded-lg bg-yellow-500/5 p-3 border border-yellow-500/10">
              <p className="text-xs text-yellow-500/70">Can review</p>
              <p className="mt-0.5 text-2xl font-bold text-yellow-400">{stats.pending || 0}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/10">
              <p className="text-xs text-emerald-500/70">Approved</p>
              <p className="mt-0.5 text-2xl font-bold text-emerald-400">{stats.approved || 0}</p>
            </div>
            <div className="rounded-lg bg-rose-500/5 p-3 border border-rose-500/10">
              <p className="text-xs text-rose-500/70">Rejected</p>
              <p className="mt-0.5 text-2xl font-bold text-rose-400">{stats.rejected || 0}</p>
            </div>
            <div className="rounded-lg bg-gray-900/60 p-3">
              <p className="text-xs text-gray-500">Da review</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-200">{stats.reviewed || (stats.approved || 0) + (stats.rejected || 0)}</p>
            </div>
          </div>

          {/* Overall progress */}
          {stats.total > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-400 font-medium">Tien do review tong the</span>
                <span className="text-gray-200 font-semibold">
                  {Math.round(((stats.reviewed || (stats.approved + stats.rejected)) / stats.total) * 100)}%
                  ({stats.reviewed || (stats.approved || 0) + (stats.rejected || 0)}/{stats.total} items)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-700/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.reviewed === stats.total ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((stats.reviewed || (stats.approved + stats.rejected)) / stats.total) * 100))}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Guidelines */}
          {guideline && (
            <div className="mt-4 border-t border-gray-700/60 pt-4">
              <button
                onClick={() => setShowGuidelines(!showGuidelines)}
                className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showGuidelines ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Huong dan ghi nhan (Guidelines)
              </button>
              {showGuidelines && (
                <div className="mt-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{guideline}</p>
                </div>
              )}
            </div>
          )}

          {/* PROJECT REVIEW SUMMARY - Chot project */}
          {reviewSummary && (
            <div className="mt-5 border-t border-gray-700/60 pt-5">
              <h3 className="text-sm font-bold text-gray-100 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Tong Ket Review Project
                {canFinalize?.canFinalize && (
                  <span className="ml-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    San sang finalize
                  </span>
                )}
              </h3>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-gray-900/60 p-3 text-center">
                  <p className="text-xs text-gray-500">Tong task</p>
                  <p className="text-xl font-bold text-gray-200">{reviewSummary.totalTasks}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/5 p-3 text-center border border-emerald-500/10">
                  <p className="text-xs text-emerald-500/70">Approved</p>
                  <p className="text-xl font-bold text-emerald-400">{reviewSummary.approvedTasks}</p>
                </div>
                <div className="rounded-lg bg-rose-500/5 p-3 text-center border border-rose-500/10">
                  <p className="text-xs text-rose-500/70">Rejected</p>
                  <p className="text-xl font-bold text-rose-400">{reviewSummary.rejectedTasks}</p>
                </div>
                <div className="rounded-lg bg-gray-900/60 p-3 text-center">
                  <p className="text-xs text-gray-500">Approval Rate</p>
                  <p className={`text-xl font-bold ${reviewSummary.approvalRate >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {reviewSummary.approvalRate}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Tien do review</span>
                  <span className="font-medium text-gray-300">
                    {reviewSummary.reviewedTasks}/{reviewSummary.totalTasks} da review
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-700/60 overflow-hidden flex">
                  {reviewSummary.totalTasks > 0 && (
                    <>
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(reviewSummary.approvedTasks / reviewSummary.totalTasks) * 100}%` }}
                      />
                      <div
                        className="bg-rose-500 h-full"
                        style={{ width: `${(reviewSummary.rejectedTasks / reviewSummary.totalTasks) * 100}%` }}
                      />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Approved</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>Rejected</span>
                  {reviewSummary.submittedTasks > 0 && <span className="text-yellow-400">Dang cho review: {reviewSummary.submittedTasks}</span>}
                  {reviewSummary.waitingReworkTasks > 0 && <span className="text-amber-400">Cho sua lai: {reviewSummary.waitingReworkTasks}</span>}
                  {reviewSummary.pendingTasks > 0 && <span className="text-gray-500">Chua assign: {reviewSummary.pendingTasks}</span>}
                </div>
              </div>

              {/* Finalize controls */}
              {canFinalize?.canFinalize ? (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  {reviewSummary.approvalRate >= 70 ? (
                    <p className="text-sm text-emerald-400 mb-3 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Approval rate {reviewSummary.approvalRate}% - Dat dieu kien approve project
                    </p>
                  ) : (
                    <p className="text-sm text-rose-400 mb-3 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Approval rate {reviewSummary.approvalRate}% - Duoi nguong 70%, can reject project
                    </p>
                  )}

                  {finalizeConfirm ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Ghi chu (optional)</label>
                        <textarea
                          value={finalizeComment}
                          onChange={e => setFinalizeComment(e.target.value)}
                          placeholder="Nhap ghi chu review..."
                          className="w-full rounded-lg bg-gray-900/60 border border-gray-600/50 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFinalizeConfirm(null)}
                          disabled={finalizeLoading}
                          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition"
                        >
                          Huy
                        </button>
                        <button
                          onClick={() => handleFinalize(finalizeConfirm)}
                          disabled={finalizeLoading}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition flex items-center gap-2 ${finalizeConfirm === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                        >
                          {finalizeLoading ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : null}
                          Xac nhan {finalizeConfirm === 'approve' ? 'Approve' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {reviewSummary.approvalRate >= 70 && (
                        <button
                          onClick={() => setFinalizeConfirm('approve')}
                          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve Project
                        </button>
                      )}
                      {reviewSummary.approvalRate < 70 && (
                        <button
                          onClick={() => setFinalizeConfirm('reject')}
                          className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject Project
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : canFinalize ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {canFinalize.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Vui long hoan thanh review tat ca cac task truoc khi finalize project.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Subtopics & Review Queue */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">
              {subtopics.length > 0 ? `Subtopics (${subtopics.length})` : 'Review Queue'}
            </h2>
            {stats.pending > 0 && (
              <button
                onClick={handleStartAllReview}
                className="rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Vao review ({stats.pending} item)
              </button>
            )}
          </div>

          {subtopics.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subtopics.map((sub) => (
                <SubtopicCard
                  key={sub.subtopicId || sub._id}
                  sub={sub}
                  onStart={handleStartReview}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-12 text-center">
              <svg className="mx-auto w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m2 0h5" />
              </svg>
              <p className="text-gray-500">
                {stats.pending > 0
                  ? 'Dang tai subtopics...'
                  : 'Chua co item nao can review.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3 shadow-xl max-w-sm animate-slide-up ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-start gap-2">
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.suggestion && (
                <p className="text-xs mt-0.5 opacity-80">Suggestion: {toast.suggestion}</p>
              )}
            </div>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 text-sm">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerProjectDetail;