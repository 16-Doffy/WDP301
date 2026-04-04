import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ReviewMediaView from './ReviewMediaView';
import { useAuth } from '../../context/AuthContext';

const getAuthToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');
const sameId = (a, b) => String(a || '') === String(b || '');

const statusColor = (s) => {
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'rejected') return 'bg-rose-500/10 text-rose-400';
  return 'bg-amber-500/10 text-amber-400';
};

const ReviewerTask = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('media');

  // Active annotator IDs from URL param (comma-separated)
  const activeAnnIds = useMemo(() => {
    const raw = searchParams.get('anns') || '';
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const [enabledAnns, setEnabledAnns] = useState([]);
  useEffect(() => { setEnabledAnns(activeAnnIds); }, [activeAnnIds]);

  const sameId = (a, b) => String(a || '') === String(b || '');

  useEffect(() => {
    setLoading(true);
    setMsg('');
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks/${id}`);
      setTask(res.data);
      if (res.data.datasetId) {
        try {
          const pending = await axios.get(`${API_URL}/api/reviews/pending`);
          const all = pending.data?.pending || [];
          const sameDs = all.filter((t) => sameId(t.datasetId?._id || t.datasetId, res.data.datasetId?._id || res.data.datasetId));
          const myQueue = sameDs.filter((t) => {
            if (t._id === id) return true;
            const aid = String(t.annotatorId?._id || t.annotatorId || '');
            return activeAnnIds.includes(aid);
          }).sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
          setQueue(myQueue);
          setQueueIndex(myQueue.findIndex((t) => sameId(t._id, id)));
        } catch (_) {}
      }
    } catch (e) {
      setMsg('Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const getMyVote = useCallback((t) => {
    if (!user) return null;
    const r = t.reviewers?.find((rv) => sameId(rv.reviewerId?._id || rv.reviewerId, user?._id || user?.id));
    return r?.status || null;
  }, [user]);

  const currentVote = getMyVote(task);

  // Can only approve/reject when exactly 1 annotator is enabled
  const canVote = enabledAnns.length === 1 && task?.status === 'submitted' && !currentVote;
  const multiAnnsBlocked = enabledAnns.length > 1;

  const handleApprove = useCallback(async () => {
    if (!canVote) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/approve`, { reviewComments: '' });
      setTask(res.data);
      setMsg('Da approve!');
      setTimeout(() => setMsg(''), 3000);
      const next = queue.find((t, i) => i > queueIndex && getMyVote(t) === null && t.status === 'submitted');
      if (next) navigate(`/reviewer/tasks/${next._id}?anns=${activeAnnIds.join(',')}`);
    } catch (e) { setMsg('Loi: ' + (e.response?.data?.message || e.message)); }
    finally { setProcessing(false); }
  }, [canVote, id, queue, queueIndex, getMyVote, activeAnnIds]);

  const handleReject = useCallback(async () => {
    if (!canVote) return;
    const comment = prompt('Nhap ly do reject (optional):') || '';
    setProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/api/reviews/${id}/reject`, { reviewComments: comment, errorCategory: '' });
      setTask(res.data);
      setMsg('Da reject!');
      setTimeout(() => setMsg(''), 3000);
      const next = queue.find((t, i) => i > queueIndex && getMyVote(t) === null && t.status === 'submitted');
      if (next) navigate(`/reviewer/tasks/${next._id}?anns=${activeAnnIds.join(',')}`);
    } catch (e) { setMsg('Loi: ' + (e.response?.data?.message || e.message)); }
    finally { setProcessing(false); }
  }, [canVote, id, queue, queueIndex, getMyVote, activeAnnIds]);

  const navigateQueue = (idx) => {
    if (idx < 0 || idx >= queue.length) return;
    const t = queue[idx];
    navigate(`/reviewer/tasks/${t._id}?anns=${activeAnnIds.join(',')}`);
  };

  // Toggle annotator on/off
  const toggleAnn = (aid) => {
    setEnabledAnns((prev) => {
      if (prev.includes(aid)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((a) => a !== aid);
      }
      return [...prev, aid];
    });
  };

  // Annotator info from queue
  const allAnns = useMemo(() => {
    const map = {};
    queue.forEach((t) => {
      const aid = String(t.annotatorId?._id || t.annotatorId || '');
      if (!map[aid]) map[aid] = { id: aid, name: t.annotatorId?.fullName || t.annotatorId?.username || 'Annotator ' + aid.slice(-4), tasks: [] };
      map[aid].tasks.push(t);
    });
    return Object.values(map);
  }, [queue]);

  const enabledAnnTasks = useMemo(() => {
    return queue.filter((t) => enabledAnns.includes(String(t.annotatorId?._id || t.annotatorId || '')));
  }, [queue, enabledAnns]);

  // Aggregate labels from all enabled annotators (for current task and other tasks in queue)
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-900"><div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" /></div>;

  if (!task) return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-gray-400">Khong tim thay task</div>;

  const getTaskKind = (t) => {
    const mt = (t?.dataItem?.mimeType || '').toLowerCase();
    const fn = (t?.dataItem?.filename || t?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fn)) return 'image';
    if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fn)) return 'audio';
    if (mt.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fn)) return 'text';
    return 'other';
  };

  const kind = getTaskKind(task);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-gray-200">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reviewer/tasks')} className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600">Quay lai</button>
          <div>
            <h2 className="text-base font-bold text-gray-100">{task.projectId?.name || 'Review'}</h2>
            <p className="text-xs text-gray-400">{task.datasetId?.name || ''} | {task.dataItem?.originalName || task.dataItem?.filename || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusColor(task.status)}`}>{task.status}</span>
          <span className="text-xs text-gray-400">{queueIndex + 1} / {queue.length}</span>
          <button onClick={() => navigateQueue(queueIndex - 1)} disabled={queueIndex <= 0} className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-30">Prev</button>
          <button onClick={() => navigateQueue(queueIndex + 1)} disabled={queueIndex >= queue.length - 1} className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* Annotator toggles */}
      {allAnns.length > 0 && (
        <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-800/50 px-4 py-2 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-400 shrink-0">Annotators:</span>
          {allAnns.map((ann) => {
            const isEnabled = enabledAnns.includes(ann.id);
            const isCurrentAnnotator = sameId(ann.id, task.annotatorId?._id || task.annotatorId || '');
            return (
              <button key={ann.id} onClick={() => toggleAnn(ann.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition shrink-0 ${isEnabled ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-blue-400' : 'bg-gray-600'}`} />
                {ann.name} {isCurrentAnnotator ? '(current)' : ''} ({ann.tasks.length})
              </button>
            );
          })}
          {multiAnnsBlocked && (
            <span className="ml-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">Chi bat 1 annotator de cham bai</span>
          )}
        </div>
      )}

      {/* Message */}
      {msg && <div className="bg-amber-500/10 border-b border-amber-700/50 px-4 py-2 text-sm text-amber-300">{msg}</div>}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Media + annotations */}
        <div className="flex-1 overflow-auto p-4">
          {/* Guidelines */}
          {task.projectId?.guidelines && (
            <div className="mb-4 rounded-lg border border-blue-700/30 bg-blue-500/5 p-3">
              <h3 className="mb-1 text-xs font-semibold text-blue-400 uppercase tracking-wider">Guidelines</h3>
              <p className="text-sm text-gray-300">{task.projectId.guidelines}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-gray-700">
            {[['media', 'Media & Annotations'], ['queue', `Queue (${enabledAnnTasks.length})`]].map(([k, label]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`px-4 py-2 text-sm font-medium capitalize transition ${activeTab === k ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>{label}</button>
            ))}
          </div>

          {/* Media */}
          {activeTab === 'media' && (
            <ReviewMediaView task={task} annotations={aggregatedLabels.objects || task?.labels?.objects || []} labelSets={task?.availableLabels} />
          )}

          {/* Queue */}
          {activeTab === 'queue' && (
            <div className="space-y-2">
              {enabledAnnTasks.map((t) => {
                const isMe = sameId(t._id, task._id);
                const vote = getMyVote(t);
                const ann = allAnns.find((a) => sameId(a.id, t.annotatorId?._id || t.annotatorId || ''));
                return (
                  <div key={t._id} onClick={() => !isMe && navigate(`/reviewer/tasks/${t._id}?anns=${activeAnnIds.join(',')}`)}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${isMe ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-300">{ann?.name || '?'}</div>
                      <div className="text-sm text-gray-400">{t.dataItem?.originalName || t.dataItem?.filename || 'Task'}</div>
                      {t._id === task._id && <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">Current</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${vote === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : vote === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-700 text-gray-400'}`}>{vote || 'pending'}</span>
                      {isMe && <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor(t.status)}`}>{t.status}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Vote panel */}
        <div className="w-72 flex-shrink-0 border-l border-gray-700 bg-gray-800 p-4 overflow-y-auto space-y-4">
          {/* Voting */}
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Review Actions</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {enabledAnns.length} annotator{enabledAnns.length !== 1 ? 's' : ''} active
            </p>
          </div>

          {multiAnnsBlocked ? (
            <div className="rounded-lg border border-amber-700/30 bg-amber-500/5 p-3 text-sm text-amber-300">
              Chi duoc approve/reject khi chi bat <strong>duy nhat 1 annotator</strong> de so sanh label.
            </div>
          ) : !canVote ? (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-400">
              {task.status !== 'submitted' ? 'Task da duoc review.' : currentVote ? 'Ban da vote: ' + currentVote : 'Khong co annotator nao duoc chon.'}
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={handleApprove} disabled={processing}
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                Approve (A)
              </button>
              <button onClick={handleReject} disabled={processing}
                className="w-full rounded-lg bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition">
                Reject (R)
              </button>
              <p className="text-center text-xs text-gray-500">Press A to Approve, R to Reject</p>
            </div>
          )}

          {/* Current annotator label summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
            <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Labels ({aggregatedLabels.objects?.length || 0})</h4>
            {(aggregatedLabels.objects || []).length === 0 ? (
              <p className="text-xs text-gray-500">Khong co label</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(aggregatedLabels.objects || []).map((obj, i) => {
                  const lbl = task.availableLabels?.find((l) => l.name === obj.label);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: lbl?.color || '#3b82f6' }} />
                      <span className="text-xs text-gray-200">{obj.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
            <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Summary</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Total labels</span><span className="text-gray-200">{aggregatedLabels.objects?.length || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Unique labels</span><span className="text-gray-200">{(new Set((aggregatedLabels.objects || []).map((o) => o.label))).size}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Your vote</span><span className={currentVote === 'approved' ? 'text-emerald-400' : currentVote === 'rejected' ? 'text-rose-400' : 'text-gray-400'}>{currentVote || 'pending'}</span></div>
            </div>
          </div>

          {/* Label legend */}
          {task.availableLabels && task.availableLabels.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
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
    </div>
  );
};

export default ReviewerTask;