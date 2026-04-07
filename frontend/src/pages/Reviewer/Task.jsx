import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ReviewMediaView from './ReviewMediaView';
import ConsensusStatus from './ConsensusStatus';
import VotingPanel from './VotingPanel';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token');
const sameId = (a, b) => String(a || '') === String(b || '');

const ReviewerTask = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('media');
  const [textContent, setTextContent] = useState('');
  const [enabledAnns, setEnabledAnns] = useState([]);

  // Read annotator IDs from URL on mount
  const annIdsFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('anns') || '').split(',').filter(Boolean);
  }, []);

  const getTaskKind = (t) => {
    const mt = (t?.dataItem?.mimeType || '').toLowerCase();
    const fn = (t?.dataItem?.filename || t?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fn)) return 'image';
    if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fn)) return 'audio';
    if (mt.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fn)) return 'text';
    return 'other';
  };

  useEffect(() => {
    setLoading(true);
    setMessage('');
    setTextContent('');
    setEnabledAnns(annIdsFromUrl);
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${id}`);
      const taskData = response.data;
      setTask(taskData);

      if (taskData.datasetId) {
        try {
          const batchRes = await axios.get(`${API_URL}/api/reviews/pending`);
          const pending = batchRes.data || [];
          const sameDs = pending.filter(
            (t) => sameId(t.datasetId?._id || t.datasetId, taskData.datasetId?._id || taskData.datasetId)
          );
          if (sameDs.length > 0) {
            setQueue(sameDs);
            setQueueIndex(sameDs.findIndex((t) => sameId(t._id, id)));
          }
        } catch (_) {}
      }

      const kind = getTaskKind(taskData);
      if (kind === 'text' && taskData.dataItem?.path) {
        try {
          const baseUrl = API_URL.replace(/\/+$/, '');
          const path = taskData.dataItem.path || '';
          const cleanPath = path.replace(/^\/+/, '');
          const url = taskData.dataItem.filename ? baseUrl + '/' + cleanPath + '/' + taskData.dataItem.filename : baseUrl + '/' + cleanPath;
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

  const getMyVote = useCallback((t) => {
    if (!user || !t) return null;
    const r = t.reviewers?.find((rev) => sameId(rev.reviewerId?._id || rev.reviewerId, user?._id || user?.id));
    return r?.status || null;
  }, [user]);

  // All annotators in queue
  const allAnns = useMemo(() => {
    const map = {};
    queue.forEach((t) => {
      const aid = String(t.annotatorId?._id || t.annotatorId || '');
      if (!map[aid]) map[aid] = { id: aid, name: t.annotatorId?.fullName || t.annotatorId?.username || 'Annotator', tasks: [] };
      map[aid].tasks.push(t);
    });
    return Object.values(map);
  }, [queue]);

  // Filter queue to only enabled annotators
  const enabledAnnTasks = useMemo(() => {
    return queue.filter((t) => enabledAnns.includes(String(t.annotatorId?._id || t.annotatorId || '')));
  }, [queue, enabledAnns]);

  // Aggregate labels from enabled annotators for current task
  const aggregatedLabels = useMemo(() => {
    const objects = [];
    const spans = [];
    const segments = [];
    enabledAnnTasks.forEach((t) => {
      const lbls = t.labels || {};
      if (lbls.objects) lbls.objects.forEach((o) => objects.push({ ...o, taskId: t._id }));
      if (lbls.spans) lbls.spans.forEach((s) => spans.push({ ...s, taskId: t._id }));
      if (lbls.segments) lbls.segments.forEach((s) => segments.push({ ...s, taskId: t._id }));
    });
    return { objects, spans, segments };
  }, [enabledAnnTasks]);

  // Voting rules
  const currentVote = task ? getMyVote(task) : null;
  const canVote = enabledAnns.length === 1 && task?.status === 'submitted' && !currentVote;
  const multiAnnsBlocked = enabledAnns.length > 1;

  const handleApprove = useCallback(async ({ reviewComments }) => {
    if (!canVote) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/approve`, { reviewComments });
      const updatedTask = res.data;
      setTask(updatedTask);
      setMessage('Vote recorded. Task status: ' + updatedTask.status);
      setTimeout(() => setMessage(''), 3000);
      if (updatedTask.status !== 'submitted') moveToNext();
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  }, [canVote, id]);

  const handleReject = useCallback(async ({ reviewComments, errorCategory }) => {
    if (!canVote) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/reject`, { reviewComments, errorCategory });
      const updatedTask = res.data;
      setTask(updatedTask);
      setMessage('Vote recorded. Task status: ' + updatedTask.status);
      setTimeout(() => setMessage(''), 3000);
      if (updatedTask.status !== 'submitted') moveToNext();
    } catch (error) {
      const errors = error.response?.data?.errors;
      setMessage('Error: ' + (errors && errors.length > 0 ? errors.map((e) => e.msg).join(', ') : (error.response?.data?.message || error.message)));
    } finally {
      setProcessing(false);
    }
  }, [canVote, id]);

  const moveToNext = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = queue.findIndex((t, i) => i > queueIndex && t.status === 'submitted' && !getMyVote(t)?.match(/approved|rejected/));
    if (nextIdx >= 0) {
      const next = queue[nextIdx];
      navigate(`/reviewer/tasks/${next._id}?anns=${annIdsFromUrl.join(',')}`);
    }
  }, [queue, queueIndex, getMyVote, annIdsFromUrl]);

  const navigateQueue = (taskId) => {
    navigate(`/reviewer/tasks/${taskId}?anns=${annIdsFromUrl.join(',')}`);
  };

  const toggleAnn = useCallback((aid) => {
    setEnabledAnns((prev) => {
      if (prev.includes(aid)) {
        if (prev.length === 1) return prev;
        return prev.filter((a) => a !== aid);
      }
      return [...prev, aid];
    });
  }, []);

  const taskWithText = textContent ? { ...task, textContent } : task;
  const reviewers = task?.reviewers || [];
  const totalReviewers = reviewers.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-gray-400">
        <p>Khong tim thay task</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-gray-200">
      {/* Left panel */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-100">{task?.projectId?.name || 'Review Task'}</h2>
              <p className="mt-0.5 text-sm text-gray-400">{task?.datasetId?.name || 'Dataset'} | {task?.dataItem?.originalName || task?.dataItem?.filename || 'File'}</p>
              <p className="mt-0.5 text-xs text-gray-500">Annotator: {task?.annotatorId?.fullName || task?.annotatorId?.username || 'N/A'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : task?.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{task?.status?.toUpperCase()}</span>
              <button onClick={() => navigate('/reviewer/tasks')} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700">Back to List</button>
            </div>
          </div>

          {/* Batch nav */}
          {queue.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1"><div className="h-1.5 w-full rounded-full bg-gray-700"><div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${((queueIndex + 1) / queue.length) * 100}%` }} /></div></div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{queueIndex + 1} / {queue.length}</span>
              <button onClick={() => queueIndex > 0 && navigateQueue(queue[queueIndex - 1]._id)} disabled={queueIndex <= 0} className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-30">Prev</button>
              <button onClick={() => queueIndex < queue.length - 1 && navigateQueue(queue[queueIndex + 1]._id)} disabled={queueIndex >= queue.length - 1} className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-30">Next</button>
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
          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">{message}</div>
        )}

        {/* Annotator toggles */}
        {allAnns.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 p-3">
            <span className="text-xs font-semibold text-gray-400">Annotators:</span>
            {allAnns.map((ann) => {
              const isEnabled = enabledAnns.includes(ann.id);
              const isCurrent = sameId(ann.id, task?.annotatorId?._id || task?.annotatorId || '');
              return (
                <button key={ann.id} onClick={() => toggleAnn(ann.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isEnabled ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'}`}>
                  <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-blue-400' : 'bg-gray-600'}`} />
                  {ann.name}{isCurrent ? ' (current)' : ''} ({ann.tasks.length})
                </button>
              );
            })}
            {multiAnnsBlocked && <span className="ml-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">Chi bat 1 annotator de cham bai</span>}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-gray-700">
          {['media', 'consensus', 'history'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
              {tab === 'media' ? 'Media & Annotations' : tab === 'consensus' ? 'Vote Progress' : 'Review History'}
            </button>
          ))}
        </div>

        {/* Media */}
        {activeTab === 'media' && (
          <ReviewMediaView task={taskWithText} annotations={aggregatedLabels.objects || task?.labels?.objects || []} />
        )}

        {/* Consensus */}
        {activeTab === 'consensus' && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <ConsensusStatus reviewers={reviewers} task={{ ...task, currentUserId: user?._id || user?.id }} />
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-200">Annotator Annotations</h3>
              {(aggregatedLabels.objects || []).length > 0 ? (
                <div className="space-y-2">
                  {aggregatedLabels.objects.map((obj, idx) => (
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
              ) : <p className="text-sm text-gray-500">No annotations found.</p>}
            </div>
            {task?.reviewComments && (
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-200">Final Review Comment</h3>
                <p className="text-sm text-gray-300">{task.reviewComments}</p>
                {task?.errorCategory && <span className="mt-2 inline-block rounded bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400">{task.errorCategory}</span>}
              </div>
            )}
            {task?.reviewNotes && task.reviewNotes.length > 0 && (
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-200">Review Notes History</h3>
                <div className="space-y-2">
                  {task.reviewNotes.map((note, idx) => (
                    <div key={idx} className="rounded border border-gray-700 bg-gray-900 px-3 py-2">
                      <p className="text-sm text-gray-300">{note.note || note.comment || JSON.stringify(note)}</p>
                      <p className="mt-1 text-xs text-gray-500">{note.createdAt ? new Date(note.createdAt).toLocaleString('vi-VN') : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-80 flex-shrink-0 border-l border-gray-700 bg-gray-800 p-4 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Review Actions</h3>
          <p className="mt-0.5 text-xs text-gray-500">{totalReviewers} reviewer(s) assigned</p>
          {allAnns.length > 0 && <p className="mt-0.5 text-xs text-gray-500">{enabledAnns.length} annotator(s) active</p>}
        </div>

        {multiAnnsBlocked ? (
          <div className="mb-4 rounded-lg border border-amber-700/30 bg-amber-500/5 p-3 text-sm text-amber-300">
            Chi duoc approve/reject khi chi bat <strong>duy nhat 1 annotator</strong> de so sanh label.
          </div>
        ) : (
          <VotingPanel
            task={task}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={processing}
            hasVoted={!!currentVote}
            currentUserVote={currentVote}
          />
        )}

        {/* Label summary */}
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Labels ({aggregatedLabels.objects?.length || 0})</h4>
          {(aggregatedLabels.objects || []).length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {aggregatedLabels.objects.map((obj, i) => {
                const lbl = task.availableLabels?.find((l) => l.name === obj.label);
                return (
                  <div key={i} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lbl?.color || '#3b82f6' }} />
                    <span className="text-xs text-gray-200">{obj.label}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-gray-500">Khong co label</p>}
        </div>

        {/* Quick summary */}
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-gray-400">Total annotations</span><span className="font-medium text-gray-200">{aggregatedLabels.objects?.length || 0}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-400">Labels used</span><span className="font-medium text-gray-200">{(new Set((aggregatedLabels.objects || []).map((o) => o.label))).size}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-400">Your vote</span><span className={`font-medium ${currentVote === 'approved' ? 'text-emerald-400' : currentVote === 'rejected' ? 'text-rose-400' : 'text-gray-400'}`}>{currentVote || 'pending'}</span></div>
          </div>
        </div>

        {/* Label legend */}
        {task?.availableLabels && task.availableLabels.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
            <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Label Legend</h4>
            <div className="space-y-1">
              {task.availableLabels.map((l) => (
                <div key={l.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color || '#3b82f6' }} />
                  <span className="text-xs text-gray-300">{l.name}</span>
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
