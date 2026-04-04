import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ReviewMediaView from './ReviewMediaView';
import ConsensusStatus from './ConsensusStatus';
import VotingPanel from './VotingPanel';
import { useAuth } from '../../context/AuthContext';

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [batchTasks, setBatchTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'consensus' | 'history'
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    setLoading(true);
    setMessage('');
    setTextContent('');
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      const taskData = response.data;
      setTask(taskData);

      // Load batch (same dataset tasks)
      if (taskData.datasetId) {
        try {
          const batchRes = await axios.get(`${API_URL}/api/reviews/pending`);
          const pending = batchRes.data || [];
          const batch = pending.filter(
            (t) => (t.datasetId?._id || t.datasetId) === (taskData.datasetId?._id || taskData.datasetId)
          );
          if (batch.length > 0) {
            setBatchTasks(batch);
          }
        } catch (_) {}
      }

      // Load text content for text tasks
      const kind = getTaskKind(taskData);
      if (kind === 'text' && taskData.dataItem?.path) {
        try {
          const baseUrl = API_URL.replace(/\/+$/, '');
          const path = taskData.dataItem.path || '';
          const cleanPath = path.replace(/^\/+/, '');
          const url = taskData.dataItem.filename
            ? baseUrl + '/' + cleanPath + '/' + taskData.dataItem.filename
            : baseUrl + '/' + cleanPath;
          const textRes = await axios.get(url, { responseType: 'text' });
          setTextContent(textRes.data || '');
        } catch (_) {}
      }
    } catch (error) {
      setMessage('Error loading task: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getTaskKind = (t) => {
    const mt = (t?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (t?.dataItem?.filename || t?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
    if (mt.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
    return 'other';
  };

  const getCurrentUserReviewer = useCallback(() => {
    if (!task?.reviewers || !user) return null;
    return task.reviewers.find(
      (r) => (r.reviewerId?._id || r.reviewerId?.toString()) === (user._id || user.id?.toString())
    );
  }, [task, user]);

  const currentVote = getCurrentUserReviewer()?.status || null;
  const hasVoted = currentVote === 'approved' || currentVote === 'rejected';

  const handleApprove = useCallback(async ({ reviewComments }) => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/approve`, { reviewComments });
      const updatedTask = res.data;
      setTask(updatedTask);
      setMessage('Vote recorded. Task status: ' + updatedTask.status);
      setTimeout(() => setMessage(''), 3000);
      if (updatedTask.status !== 'submitted') {
        moveToNext();
      }
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleReject = useCallback(async ({ reviewComments, errorCategory }) => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/reject`, {
        reviewComments,
        errorCategory,
      });
      const updatedTask = res.data;
      setTask(updatedTask);
      setMessage('Vote recorded. Task status: ' + updatedTask.status);
      setTimeout(() => setMessage(''), 3000);
      if (updatedTask.status !== 'submitted') {
        moveToNext();
      }
    } catch (error) {
      const errors = error.response?.data?.errors;
      if (errors && errors.length > 0) {
        setMessage('Error: ' + errors.map((e) => e.msg).join(', '));
      } else {
        setMessage('Error: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const moveToNext = useCallback(() => {
    if (batchTasks.length === 0) return;
    const nextIdx = batchTasks.findIndex(
      (t, i) =>
        i > currentTaskIndex &&
        t.status === 'submitted' &&
        !t.reviewers?.find(
          (r) => (r.reviewerId?._id || r.reviewerId?.toString()) === (user?._id || user?.id?.toString())
        )?.status?.match(/approved|rejected/)
    );
    if (nextIdx >= 0) {
      navigate(`/reviewer/tasks/${batchTasks[nextIdx]._id}`);
    } else {
      const firstPending = batchTasks.findIndex((t) => t.status === 'submitted');
      if (firstPending >= 0) {
        navigate(`/reviewer/tasks/${batchTasks[firstPending]._id}`);
      }
    }
  }, [batchTasks, currentTaskIndex, navigate, user]);

  const navigateToTask = (taskId) => {
    if (task && task._id !== taskId && task.status === 'submitted' && !hasVoted) {
      // Cannot auto-save here since reviewer is read-only
    }
    navigate(`/reviewer/tasks/${taskId}`);
  };

  const navigateToPrevious = () => {
    if (currentTaskIndex > 0) navigateToTask(batchTasks[currentTaskIndex - 1]._id);
  };

  const navigateToNext = () => {
    if (currentTaskIndex < batchTasks.length - 1) navigateToTask(batchTasks[currentTaskIndex + 1]._id);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (processing || hasVoted || task?.status !== 'submitted') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove({ reviewComments: '' });
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Open reject dialog via VotingPanel - trigger via ref or state
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
  }, [processing, hasVoted, task?.status, handleApprove, currentTaskIndex, batchTasks.length]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  const taskWithText = textContent ? { ...task, textContent } : task;
  const reviewers = task?.reviewers || [];
  const totalReviewers = reviewers.length;

  return (
    <div className="flex min-h-screen bg-slate-900 text-gray-200">
      {/* Left panel - Media view */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-100">
                {task?.projectId?.name || 'Review Task'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-400">
                {task?.datasetId?.name || 'Dataset'} |{' '}
                {task?.dataItem?.originalName || task?.dataItem?.filename || 'File'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Annotator: {task?.annotatorId?.fullName || task?.annotatorId?.username || 'N/A'}
              </p>
              {task?.projectId?.deadline && (
                <p className={`mt-0.5 text-xs font-medium ${new Date(task.projectId.deadline) < new Date() ? 'text-rose-400' : 'text-gray-500'}`}>
                  Deadline: {new Date(task.projectId.deadline).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                task?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                task?.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                {task?.status?.toUpperCase()}
              </span>
              <button
                onClick={() => navigate('/reviewer/tasks')}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700"
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Batch navigation */}
          {batchTasks.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${((currentTaskIndex + 1) / batchTasks.length) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {currentTaskIndex + 1} / {batchTasks.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={navigateToPrevious}
                  disabled={currentTaskIndex <= 0}
                  className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  onClick={navigateToNext}
                  disabled={currentTaskIndex >= batchTasks.length - 1}
                  className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Guidelines */}
        {task?.projectId?.guidelines && (
          <div className="mb-4 rounded-lg border border-blue-700/30 bg-blue-500/5 p-3">
            <h3 className="mb-1 text-xs font-semibold text-blue-400 uppercase tracking-wider">Guidelines</h3>
            <p className="text-sm text-gray-300">{task.projectId.guidelines}</p>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            {message}
          </div>
        )}

        {/* Tab navigation */}
        <div className="mb-4 flex gap-1 border-b border-gray-700">
          {['media', 'consensus', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'media' ? 'Media & Annotations' : tab === 'consensus' ? 'Vote Progress' : 'Review History'}
            </button>
          ))}
        </div>

        {/* Media & Annotations */}
        {activeTab === 'media' && (
          <ReviewMediaView task={taskWithText} annotations={task?.labels?.objects || []} />
        )}

        {/* Vote Progress */}
        {activeTab === 'consensus' && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <ConsensusStatus reviewers={reviewers} task={{ ...task, currentUserId: user?._id || user?.id }} />
          </div>
        )}

        {/* Review History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Annotator labels summary */}
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-200">Annotator Annotations</h3>
              {task?.labels?.objects && task.labels.objects.length > 0 ? (
                <div className="space-y-2">
                  {task.labels.objects.map((obj, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border border-gray-700 bg-gray-900 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: task?.availableLabels?.find((l) => l.name === obj.label)?.color || '#3b82f6' }} />
                        <span className="text-sm text-gray-200">{obj.label}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        [{((obj.bbox?.[0]) || 0).toFixed(0)}, {((obj.bbox?.[1]) || 0).toFixed(0)}, {((obj.bbox?.[2]) || 0).toFixed(0)}, {((obj.bbox?.[3]) || 0).toFixed(0)}]
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No annotations found.</p>
              )}
            </div>

            {/* Review comments (if finalized) */}
            {task?.reviewComments && (
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-200">Final Review Comment</h3>
                <p className="text-sm text-gray-300">{task.reviewComments}</p>
                {task?.errorCategory && (
                  <span className="mt-2 inline-block rounded bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400">
                    {task.errorCategory}
                  </span>
                )}
              </div>
            )}

            {/* Previous revision history */}
            {task?.reviewNotes && task.reviewNotes.length > 0 && (
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-200">Review Notes History</h3>
                <div className="space-y-2">
                  {task.reviewNotes.map((note, idx) => (
                    <div key={idx} className="rounded border border-gray-700 bg-gray-900 px-3 py-2">
                      <p className="text-sm text-gray-300">{note.note || note.comment || JSON.stringify(note)}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {note.createdAt ? new Date(note.createdAt).toLocaleString('vi-VN') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar - Voting panel */}
      <div className="w-80 flex-shrink-0 border-l border-gray-700 bg-gray-800 p-4 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Review Actions</h3>
          <p className="mt-0.5 text-xs text-gray-500">{totalReviewers} reviewer(s) assigned</p>
        </div>

        <VotingPanel
          task={task}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={processing}
          hasVoted={hasVoted}
          currentUserVote={currentVote}
        />

        {/* Quick consensus summary */}
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total annotations</span>
              <span className="font-medium text-gray-200">
                {task?.labels?.objects?.length || task?.labels?.spans?.length || task?.labels?.segments?.length || 0}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Labels used</span>
              <span className="font-medium text-gray-200">
                {[...new Set((task?.labels?.objects || []).map((o) => o.label))].length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Reviewers voted</span>
              <span className="font-medium text-gray-200">
                {reviewers.filter((r) => r.status !== 'pending').length}/{totalReviewers}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Status</span>
              <span className={`font-medium ${task?.status === 'approved' ? 'text-emerald-400' : task?.status === 'rejected' ? 'text-rose-400' : 'text-amber-400'}`}>
                {task?.status}
              </span>
            </div>
          </div>
        </div>

        {/* Label legend */}
        {task?.availableLabels && task.availableLabels.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900 p-4">
            <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Label Legend</h4>
            <div className="space-y-1.5">
              {task.availableLabels.map((label, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: label.color || '#3b82f6' }} />
                  <span className="truncate text-xs text-gray-300">{label.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerTask;