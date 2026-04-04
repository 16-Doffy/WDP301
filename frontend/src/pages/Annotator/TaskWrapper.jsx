import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';

export const getTaskKind = (task) => {
  if (!task) return 'other';
  const mt = (task.dataItem?.mimeType || '').toLowerCase();
  const fileName = (task.dataItem?.originalName || task.dataItem?.filename || task.dataItem?.path || '').toLowerCase();
  if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
  if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
  if (mt.startsWith('text/') || ['application/json', 'application/xml', 'text/csv'].includes(mt) || /\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
  return 'other';
};

export const buildFileUrl = (dataItem) => {
  if (!dataItem) return '';
  const base = API_URL.replace(/\/+$/, '');
  const clean = (dataItem.path || '').replace(/^\/+/, '');
  if (clean) return dataItem.filename ? base + '/' + clean + '/' + dataItem.filename : base + '/' + clean;
  return dataItem.filename ? base + '/uploads/datasets/' + dataItem.filename : '';
};

const AnnotationSidebar = ({ labels, note, onNoteChange, onLabelDelete, readOnly }) => {
  const objects = labels?.objects || [];
  const textSpans = labels?.spans || [];
  const audioSegments = labels?.segments || [];
  const hasAnnotations = objects.length > 0 || textSpans.length > 0 || audioSegments.length > 0;
  return (
    <div className="w-72 border-l border-gray-700 bg-gray-800 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700"><h3 className="text-sm font-semibold text-gray-300">Annotations</h3></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {objects.length > 0 && (<div><p className="text-xs text-gray-500 mb-1">BBoxes ({objects.length})</p>{objects.map((obj, idx) => (<div key={idx} className="flex items-center justify-between rounded bg-gray-700/50 px-2 py-1 mb-1"><span className="text-xs text-gray-200">{obj.label || 'No label'}</span>{!readOnly && <button onClick={() => onLabelDelete('object', idx)} className="text-rose-400 hover:text-rose-300 text-xs">x</button>}</div>))}</div>)}
        {textSpans.length > 0 && (<div><p className="text-xs text-gray-500 mb-1">Text Spans ({textSpans.length})</p>{textSpans.map((span, idx) => (<div key={idx} className="flex items-center justify-between rounded bg-gray-700/50 px-2 py-1 mb-1"><span className="text-xs text-gray-200">"{span.text?.slice(0, 20)}..." - {span.label}</span>{!readOnly && <button onClick={() => onLabelDelete('span', idx)} className="text-rose-400 hover:text-rose-300 text-xs">x</button>}</div>))}</div>)}
        {audioSegments.length > 0 && (<div><p className="text-xs text-gray-500 mb-1">Segments ({audioSegments.length})</p>{audioSegments.map((seg, idx) => (<div key={idx} className="flex items-center justify-between rounded bg-gray-700/50 px-2 py-1 mb-1"><span className="text-xs text-gray-200">{seg.label || 'No label'} [{seg.start?.toFixed(1)}s]</span>{!readOnly && <button onClick={() => onLabelDelete('segment', idx)} className="text-rose-400 hover:text-rose-300 text-xs">x</button>}</div>))}</div>)}
        {!hasAnnotations && <p className="text-xs text-gray-500 text-center py-4">Chua co annotation nao</p>}
      </div>
      <div className="border-t border-gray-700 p-3">
        <label className="text-xs text-gray-500 mb-1 block">Ghi chu</label>
        <textarea className="w-full rounded border border-gray-600 bg-gray-900 text-gray-200 p-2 text-xs resize-none focus:outline-none focus:border-blue-500" rows={3} value={note || ''} onChange={(e) => onNoteChange(e.target.value)} placeholder="Nhap ghi chu..." disabled={readOnly} />
      </div>
    </div>
  );
};

const TaskWrapper = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSubmitBatchDialog, setShowSubmitBatchDialog] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [note, setNote] = useState('');
  const [textSpans, setTextSpans] = useState([]);
  const [audioSegments, setAudioSegments] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState('');

  const isReadOnly = task?.status === 'submitted' || task?.status === 'approved';
  const kind = getTaskKind(task);

  useEffect(() => { fetchTask(); }, [id]);

  useEffect(() => {
    if (loading || isReadOnly) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, isReadOnly, id]);

  const fetchTask = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + '/api/tasks/' + id);
      const fetchedTask = res.data;
      setTask(fetchedTask);
      const lbls = fetchedTask.labels || {};
      if (lbls.objects) setAnnotations(lbls.objects.map((o, i) => ({ ...o, _idx: i })));
      if (lbls.spans) setTextSpans(lbls.spans);
      if (lbls.segments) setAudioSegments(lbls.segments);
      setNote(lbls.note || '');
      const subtopicId = fetchedTask.subtopicId?._id || fetchedTask.subtopicId;
      const datasetId = fetchedTask.datasetId?._id || fetchedTask.datasetId;
      const tasksRes = await axios.get(API_URL + '/api/tasks/my-tasks', { params: subtopicId ? { subtopicId } : { datasetId } });
      setTasks(tasksRes.data || []);
    } catch (err) { console.error("fetchTask error:", err); if (err.response?.status === 403) { setMessage("Ban khong co quyen xem task nay."); } else if (err.response?.status === 404) { setMessage("Task khong ton tai."); } else { setMessage("Loi tai task: " + (err.response?.data?.message || err.message)); } } finally { setLoading(false); }
  };

  const buildLabelsPayload = () => {
    if (kind === 'image') return { objects: annotations.map(({ _idx, ...rest }) => rest), note: note.trim() };
    if (kind === 'text') return { spans: textSpans, note: note.trim() };
    if (kind === 'audio') return { segments: audioSegments, note: note.trim() };
    return { note: note.trim() };
  };

  const handleSave = useCallback(async () => {
    if (isReadOnly) return;
    setSaving(true); setMessage('');
    try { await axios.put(API_URL + '/api/tasks/' + id + '/label', { labels: buildLabelsPayload(), status: 'in_progress' }); setMessage('Da luu!'); setTimeout(() => setMessage(''), 3000); } catch (err) { setMessage('Loi luu'); } finally { setSaving(false); }
  }, [id, annotations, note, textSpans, audioSegments, kind, isReadOnly]);

  const handleComplete = async () => {
    if (isReadOnly) return;
    const hasAnnotation = annotations.length > 0 || textSpans.length > 0 || audioSegments.length > 0 || note.trim();
    if (!hasAnnotation) { alert('Vui long tao it nhat 1 annotation'); return; }
    setSaving(true);
    try { await handleSave(); await axios.post(API_URL + '/api/tasks/' + id + '/complete'); const currentIdx = tasks.findIndex((t) => t._id === id); const nextTask = tasks.find((t, i) => i > currentIdx && t.status !== 'approved' && t.status !== 'submitted'); if (nextTask) navigate('/annotator/workspace/' + nextTask._id); else setShowSubmitBatchDialog(true); } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); } finally { setSaving(false); }
  };

  const handleSubmitBatch = async () => {
    try { await axios.post(API_URL + '/api/tasks/submit-batch', { datasetId: task.datasetId?._id || task.datasetId }); alert('Nop bai thanh cong!'); navigate('/annotator/tasks'); } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
  };

  const handleLabelDelete = (type, idx) => {
    if (type === 'object') setAnnotations((p) => p.filter((_, i) => i !== idx));
    else if (type === 'span') setTextSpans((p) => p.filter((_, i) => i !== idx));
    else if (type === 'segment') setAudioSegments((p) => p.filter((_, i) => i !== idx));
  };

  const currentIdx = tasks.findIndex((t) => t._id === id);
  const prevTask = currentIdx > 0 ? tasks[currentIdx - 1] : null;
  const nextTask = currentIdx < tasks.length - 1 ? tasks[currentIdx + 1] : null;
  const allDone = tasks.length > 0 && tasks.every((t) => t.status === 'approved' || t.status === 'submitted');
  const labels = { objects: annotations, spans: textSpans, segments: audioSegments, note };
  const availableLabels = task?.availableLabels || [];

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-900"><CircularProgress /></div>;
  if (!task) return (<div className="flex min-h-screen items-center justify-center bg-slate-900"><div className="text-center"><div className="text-4xl mb-4">⚠️</div><p className="text-red-400 text-lg mb-4">{message || "Khong tim thay task"}</p><button onClick={() => navigate("/annotator/tasks")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Quay lai Dashboard</button></div></div>);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-gray-200">
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/annotator/tasks')} className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 transition">Quay lai</button>
          <div>
            <h1 className="text-base font-semibold text-gray-100">{task.projectId?.name || 'Project'}</h1>
            <p className="text-xs text-gray-400">{task.subtopicId?.name || task.datasetId?.name || 'Subtopic'} | Task {currentIdx + 1}/{tasks.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prevTask && <Button size="small" variant="outlined" onClick={() => navigate('/annotator/workspace/' + prevTask._id)}>Prev</Button>}
          {nextTask && <Button size="small" variant="outlined" onClick={() => navigate('/annotator/workspace/' + nextTask._id)}>Next</Button>}
          {message && <span className="text-sm text-emerald-400">{message}</span>}
          <Button size="small" variant="outlined" onClick={handleSave} disabled={saving || isReadOnly}>Luu</Button>
          {!isReadOnly && <Button size="small" variant="contained" color="primary" onClick={handleComplete} disabled={saving}>Hoan thanh</Button>}
          {allDone && <Button size="small" variant="contained" color="success" onClick={() => setShowSubmitBatchDialog(true)}>Nop bai</Button>}
        </div>
      </div>
      {task.status === 'approved' && <div className="bg-emerald-500/10 border-b border-emerald-700/50 px-4 py-2 text-emerald-400 text-sm font-medium">Da duoc duyet</div>}
      {task.status === 'submitted' && <div className="bg-amber-500/10 border-b border-amber-700/50 px-4 py-2 text-amber-400 text-sm font-medium">Dang cho review</div>}
      {task.status === 'rejected' && <div className="bg-rose-500/10 border-b border-rose-700/50 px-4 py-2 text-rose-400 text-sm font-medium">Bi tu choi - {task.reviewComments}</div>}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto bg-gray-900 p-4">
          {kind === 'image' && <ImageCanvas task={task} annotations={annotations} onChange={setAnnotations} availableLabels={availableLabels} selectedLabel={selectedLabel} onSelectLabel={setSelectedLabel} readOnly={isReadOnly} />}
          {kind === 'audio' && <AudioPlayer task={task} segments={audioSegments} onChange={setAudioSegments} availableLabels={availableLabels} selectedLabel={selectedLabel} onSelectLabel={setSelectedLabel} readOnly={isReadOnly} />}
          {kind === 'text' && <TextAnnotator task={task} spans={textSpans} onChange={setTextSpans} availableLabels={availableLabels} selectedLabel={selectedLabel} onSelectLabel={setSelectedLabel} readOnly={isReadOnly} />}
          {kind === 'other' && <div className="flex items-center justify-center h-full text-gray-500"><p>Loai task khong ho tro</p></div>}
        </div>
        <AnnotationSidebar labels={labels} note={note} onNoteChange={setNote} onLabelDelete={handleLabelDelete} readOnly={isReadOnly} />
      </div>

      <Dialog open={showSubmitBatchDialog} onClose={() => setShowSubmitBatchDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tat ca task da xong!</DialogTitle>
        <DialogContent><Typography>Ban da hoan thanh tat ca task. Hay nop bai de reviewer cham diem.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowSubmitBatchDialog(false); navigate('/annotator/tasks'); }}>Quay lai</Button>
          <Button onClick={handleSubmitBatch} variant="contained" color="success" disabled={saving}>{saving ? 'Dang nop...' : 'Nop bai ngay'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// --- Annotation sub-components ---
const ImageCanvas = ({ task, annotations, onChange, availableLabels, selectedLabel, onSelectLabel, readOnly }) => {
  const fileUrl = buildFileUrl(task?.dataItem);
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-gray-400 mb-2">ImageCanvas - ve bbox tren anh</p>
      {fileUrl && <img src={fileUrl} alt="task" className="max-w-full border border-gray-700 rounded max-h-[60vh] object-contain" />}
      <div className="flex flex-wrap gap-2 mt-3">{availableLabels.map((l) => (<button key={l.name} onClick={() => onSelectLabel(l.name)} className={'px-3 py-1 rounded text-xs font-medium border transition ' + (selectedLabel === l.name ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100')} style={{ borderColor: l.color || '#3b82f6', color: l.color || '#3b82f6', backgroundColor: selectedLabel === l.name ? l.color + '20' : 'transparent' }}>{l.name}</button>))}</div>
      <p className="text-xs text-gray-500 mt-2">Annotations: {annotations.length}</p>
    </div>
  );
};

const AudioPlayer = ({ task, segments, onChange, availableLabels, selectedLabel, onSelectLabel, readOnly }) => {
  const fileUrl = buildFileUrl(task?.dataItem);
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-gray-400 mb-2">AudioPlayer - phan tich am thanh (wavesurfer can implement)</p>
      {fileUrl && <audio controls src={fileUrl} className="mt-4 max-w-lg" />}
      <div className="flex flex-wrap gap-2 mt-3">{availableLabels.map((l) => (<button key={l.name} onClick={() => onSelectLabel(l.name)} className={'px-3 py-1 rounded text-xs font-medium border ' + (selectedLabel === l.name ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100')} style={{ borderColor: l.color, color: l.color, backgroundColor: selectedLabel === l.name ? l.color + '20' : 'transparent' }}>{l.name}</button>))}</div>
      <p className="text-xs text-gray-500 mt-2">Segments: {segments.length}</p>
    </div>
  );
};

const TextAnnotator = ({ task, spans, onChange, availableLabels, selectedLabel, onSelectLabel, readOnly }) => {
  const [content, setContent] = useState('');
  useEffect(() => { if (task?.dataItem?.path) { axios.get(buildFileUrl(task.dataItem), { responseType: 'text' }).then((r) => setContent(r.data)).catch(() => setContent('')); } }, [task]);
  const handleMouseUp = () => {
    if (readOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return;
    const range = selection.getRangeAt(0);
    const container = document.getElementById('text-content');
    if (!container) return;
    const pre = document.createRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + selection.toString().length;
    const label = availableLabels[0]?.name || selectedLabel || 'label';
    onChange([...spans, { start, end, text: selection.toString(), label }]);
    selection.removeAllRanges();
  };
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-gray-400 mb-2">TextAnnotator - boi den text de danh nhan</p>
      <div id="text-content" className="border border-gray-700 rounded p-4 whitespace-pre-wrap leading-relaxed select-text max-h-96 overflow-auto" style={{ backgroundColor: '#111827' }} onMouseUp={handleMouseUp}>{content || 'Dang tai noi dung...'}</div>
      <div className="flex flex-wrap gap-2 mt-3">{availableLabels.map((l) => (<button key={l.name} onClick={() => onSelectLabel(l.name)} className={'px-3 py-1 rounded text-xs font-medium border ' + (selectedLabel === l.name ? 'ring-2 ring-blue-500' : '')} style={{ borderColor: l.color, color: l.color, backgroundColor: selectedLabel === l.name ? l.color + '20' : 'transparent' }}>{l.name}</button>))}</div>
      <p className="text-xs text-gray-500 mt-2">Spans: {spans.length}</p>
    </div>
  );
};

export default TaskWrapper;
