import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import ImageAnnotator from '../../components/ImageAnnotator';
import AudioAnnotator from '../../components/AudioAnnotator';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

const WORKSPACE_TOOLS = { SELECT: 'select', BBOX: 'bbox', POLYGON: 'polygon' };

const ToolButton = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center justify-center rounded-lg p-2 transition-all ${
      active ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const SubtopicFilterBar = ({ subtopics, selectedSubtopicId, onSelect }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chủ đề:</span>
    <select
      value={selectedSubtopicId}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
    >
      <option value="__all__">Tất cả</option>
      {subtopics.map((st) => (
        <option key={st.subtopicId || '__none__'} value={st.subtopicId || '__none__'}>
          {st.subtopicName} ({st.doneCount}/{st.total})
        </option>
      ))}
    </select>
  </div>
);

const TopToolbar = ({ tool, setTool, zoom, setZoom, brightness, setBrightness, contrast, setContrast }) => (
  <div className="flex items-center gap-1 flex-wrap">
    <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
      <span className="text-xs text-gray-500 mr-1 font-medium">Vẽ:</span>
      <ToolButton active={tool === WORKSPACE_TOOLS.SELECT} onClick={() => setTool(WORKSPACE_TOOLS.SELECT)} title="Chọn (V)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>
      </ToolButton>
      <ToolButton active={tool === WORKSPACE_TOOLS.BBOX} onClick={() => setTool(WORKSPACE_TOOLS.BBOX)} title="Hình chữ nhật (B)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      </ToolButton>
      <ToolButton active={tool === WORKSPACE_TOOLS.POLYGON} onClick={() => setTool(WORKSPACE_TOOLS.POLYGON)} title="Đa giác (P)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" /></svg>
      </ToolButton>
    </div>

    <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
      <span className="text-xs text-gray-500 mr-1 font-medium">Zoom:</span>
      <ToolButton onClick={() => setZoom(Math.max(0.25, zoom - 0.25))} title="Thu nhỏ (-)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      </ToolButton>
      <span className="text-xs text-gray-300 min-w-[40px] text-center font-mono">{zoom.toFixed(1)}x</span>
      <ToolButton onClick={() => setZoom(Math.min(4, zoom + 0.25))} title="Phóng to (+)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      </ToolButton>
      <ToolButton onClick={() => setZoom(1)} title="Reset zoom">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
      </ToolButton>
    </div>

    <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
      <span className="text-xs text-gray-500 mr-1 font-medium" title="Độ sáng">☀</span>
      <input type="range" min="0.5" max="2" step="0.05" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))}
        className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-600 accent-blue-500" title={`Độ sáng: ${brightness.toFixed(2)}`} />
      <span className="text-xs text-gray-400 min-w-[28px] font-mono">{brightness.toFixed(1)}</span>
    </div>

    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 mr-1 font-medium" title="Độ tương phản">◐</span>
      <input type="range" min="0.5" max="2" step="0.05" value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))}
        className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-600 accent-blue-500" title={`Tương phản: ${contrast.toFixed(2)}`} />
      <span className="text-xs text-gray-400 min-w-[28px] font-mono">{contrast.toFixed(1)}</span>
    </div>
  </div>
);

const AnnotatorWorkspace = () => {
  const { id: taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('__all__');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annotationNote, setAnnotationNote] = useState('');
  const [tool, setTool] = useState(WORKSPACE_TOOLS.SELECT);
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);

  const buildFileUrl = (dataItem) => {
    if (!dataItem) return '';
    const baseUrl = API_URL.replace(/\/+$/, '');
    const rawPath = dataItem.path || '';
    const cleanPath = rawPath.replace(/^\/+/, '');
    if (cleanPath) {
      return `${baseUrl}/${cleanPath}`;
    }
    return dataItem.filename ? `${baseUrl}/uploads/datasets/${dataItem.filename}` : '';
  };

  const getTaskKind = useCallback((t) => {
    const mt = (t?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (t?.dataItem?.originalName || t?.dataItem?.filename || t?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt.startsWith('text/')) return 'text';
    if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
    if (mt === 'video/mp4' && /\.(mp4|m4a)$/i.test(fileName)) return 'audio';
    if (['application/json', 'application/xml', 'text/csv'].includes(mt)) return 'text';
    if (/\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
    return 'other';
  }, []);

  const buildSubtopics = useCallback((tasks) => {
    const map = new Map();
    tasks.forEach((t) => {
      const stId = t.subtopicId?._id?.toString() || t.subtopicId || '__none__';
      const stName = t.subtopicId?.name || 'Default';
      if (!map.has(stId)) {
        map.set(stId, { subtopicId: t.subtopicId?._id || null, subtopicName: stName, total: 0, doneCount: 0 });
      }
      const st = map.get(stId);
      st.total++;
      if (['approved', 'submitted', 'completed'].includes(t.status)) st.doneCount++;
    });
    return Array.from(map.values());
  }, []);

  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/tasks/${taskId}`);
      const taskData = res.data;
      setTask(taskData);

      const projectId = taskData.projectId?._id || taskData.projectId;
      const subtopicId = taskData.subtopicId?._id || taskData.subtopicId;
      const params = new URLSearchParams();
      params.append('projectId', projectId);
      if (subtopicId) params.append('subtopicId', subtopicId);
      const allRes = await axios.get(`${API_URL}/api/tasks/my-tasks?${params.toString()}`);
      const allTaskList = allRes.data;

      setAllTasks(allTaskList);
      setSubtopics(buildSubtopics(allTaskList));

      const idx = allTaskList.findIndex((t) => t._id === taskId);
      setCurrentIndex(idx >= 0 ? idx : 0);

      const initLabels = taskData.labels || {};
      if (initLabels.objects && Array.isArray(initLabels.objects)) {
        setAnnotations(initLabels.objects.map((obj, i) => ({
          id: Date.now() + i, label: obj.label, bbox: obj.bbox || [0, 0, 10, 10],
          confidence: obj.confidence || 1.0, type: 'bbox', answer: obj.answer || null,
        })));
      }
      setAnnotationNote(initLabels.note || '');
    } catch (error) {
      console.error('Error fetching task:', error);
      setMessage('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, [taskId, buildSubtopics]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  useEffect(() => {
    if (allTasks.length > 0) setSubtopics(buildSubtopics(allTasks));
  }, [allTasks, buildSubtopics]);

  const filteredTasks = selectedSubtopicId === '__all__'
    ? allTasks
    : allTasks.filter((t) => {
        const stId = t.subtopicId?._id?.toString() || t.subtopicId;
        return stId === selectedSubtopicId || (selectedSubtopicId === '__none__' && !stId);
      });

  const currentFilteredIndex = filteredTasks.findIndex((t) => t._id === taskId);
  const currentTask = filteredTasks[currentFilteredIndex] || task;
  const isReadOnly = currentTask && ['submitted', 'approved'].includes(currentTask.status);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (saving || isReadOnly) return;
      if (e.key === 'v' || e.key === 'V') setTool(WORKSPACE_TOOLS.SELECT);
      if (e.key === 'b' || e.key === 'B') setTool(WORKSPACE_TOOLS.BBOX);
      if (e.key === 'p' || e.key === 'P') setTool(WORKSPACE_TOOLS.POLYGON);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.25));
      if (e.key === '-') setZoom((z) => Math.max(0.25, z - 0.25));
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'ArrowLeft' && currentFilteredIndex > 0) navigateToTask(filteredTasks[currentFilteredIndex - 1]._id);
      if (e.key === 'ArrowRight' && currentFilteredIndex < filteredTasks.length - 1) navigateToTask(filteredTasks[currentFilteredIndex + 1]._id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, isReadOnly, currentFilteredIndex, filteredTasks]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/tasks/${task._id}/label`, {
        labels: { objects: annotations.map((a) => ({ label: a.label, bbox: a.bbox, confidence: a.confidence, answer: a.answer || null })), note: annotationNote },
        status: 'in_progress',
      });
      setMessage('Đã lưu!');
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage('Lỗi lưu: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  }, [task, annotations, annotationNote]);

  const navigateToTask = async (targetTaskId) => {
    if (!targetTaskId || targetTaskId === taskId) return;
    if (task && task._id !== targetTaskId && !isReadOnly) {
      try {
        await axios.put(`${API_URL}/api/tasks/${task._id}/label`, {
          labels: { objects: annotations.map((a) => ({ label: a.label, bbox: a.bbox, confidence: a.confidence, answer: a.answer || null })), note: annotationNote },
          status: 'in_progress',
        });
      } catch (err) { console.error('Auto-save failed:', err); }
    }
    navigate(`/annotator/workspace/${targetTaskId}`);
  };

  const handleCompleteTask = useCallback(async () => {
    if (!task) return;
    const kind = getTaskKind(task);
    if (kind === 'image' && annotations.length === 0) {
      alert('Vui lòng thêm ít nhất một nhãn trước khi hoàn thành.'); return;
    }
    setSaving(true);
    try {
      await handleSave();
      await axios.post(`${API_URL}/api/tasks/${task._id}/complete`);
      const nextIdx = currentFilteredIndex + 1;
      if (nextIdx < filteredTasks.length) {
        await navigateToTask(filteredTasks[nextIdx]._id);
      } else {
        setShowCompletionDialog(true);
      }
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  }, [task, annotations, handleSave, currentFilteredIndex, filteredTasks, getTaskKind]);

  const handleSubmitBatch = useCallback(async () => {
    if (!task) return;
    const datasetId = task.datasetId?._id || task.datasetId;
    if (!datasetId) return;
    const hasIncomplete = filteredTasks.some((t) => !['approved', 'submitted', 'completed'].includes(t.status));
    if (hasIncomplete) { alert('Vui lòng hoàn thành tất cả task trước khi nộp.'); return; }
    if (!window.confirm('Nộp toàn bộ batch cho reviewer?')) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/tasks/submit-batch`, { datasetId });
      alert('Nộp bài thành công!');
      navigate('/annotator/tasks');
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  }, [task, filteredTasks, navigate]);

  const allCompletedInFiltered = filteredTasks.length > 0 && filteredTasks.every((t) =>
    ['approved', 'submitted', 'completed'].includes(t.status)
  );
  const progress = filteredTasks.length > 0 ? Math.round(((currentFilteredIndex + 1) / filteredTasks.length) * 100) : 0;
  const completedCount = filteredTasks.filter((t) =>
    ['approved', 'submitted', 'completed'].includes(t.status)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/annotator/tasks')}
              className="flex-shrink-0 rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
              ← Quay lại
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-gray-100">{task?.projectId?.name || 'Project'}</h2>
              <p className="text-xs text-gray-400">{task?.datasetId?.name || 'Dataset'} • {currentFilteredIndex + 1}/{filteredTasks.length}</p>
            </div>
          </div>
          {subtopics.length > 1 && (
            <SubtopicFilterBar subtopics={subtopics} selectedSubtopicId={selectedSubtopicId} onSelect={setSelectedSubtopicId} />
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigateToTask(filteredTasks[currentFilteredIndex - 1]?._id)}
              disabled={currentFilteredIndex <= 0 || saving}
              className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">←</button>
            <span className="text-xs font-mono text-gray-400 min-w-[40px] text-center">{currentFilteredIndex + 1}/{filteredTasks.length}</span>
            <button onClick={() => navigateToTask(filteredTasks[currentFilteredIndex + 1]?._id)}
              disabled={currentFilteredIndex >= filteredTasks.length - 1 || saving}
              className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">→</button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-700">
            <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-400 font-mono flex-shrink-0">{completedCount}/{filteredTasks.length} hoàn thành</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-700 bg-gray-800/80 px-4 py-2 flex-shrink-0">
        <TopToolbar tool={tool} setTool={setTool} zoom={zoom} setZoom={setZoom} brightness={brightness} setBrightness={setBrightness} contrast={contrast} setContrast={setContrast} />
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto bg-gray-950 p-4">
          {currentTask && ['submitted', 'approved', 'rejected'].includes(currentTask.status) && (
            <div className={`mb-3 rounded-lg px-4 py-2 text-sm font-semibold border ${
              currentTask.status === 'approved' ? 'bg-emerald-500/10 border-emerald-600 text-emerald-300' :
              currentTask.status === 'rejected' ? 'bg-rose-500/10 border-rose-600 text-rose-300' :
              'bg-amber-500/10 border-amber-600 text-amber-300'
            }`}>
              {currentTask.status === 'approved' ? '✓ Đã duyệt' : currentTask.status === 'rejected' ? '✗ Bị từ chối' : '⏳ Đang chờ duyệt'}
              {currentTask.reviewComments && <span className="ml-2 font-normal opacity-80">— {currentTask.reviewComments}</span>}
            </div>
          )}

          {currentTask && getTaskKind(currentTask) === 'image' && (
            <div className="mx-auto max-w-6xl">
              <ImageAnnotator
                imageUrl={buildFileUrl(currentTask.dataItem)}
                labelSet={currentTask.availableLabels || []}
                questions={currentTask.projectId?.questions || []}
                onAnnotationsChange={(newAnnotations) => setAnnotations(newAnnotations)}
                initialAnnotations={annotations}
                readOnly={isReadOnly}
              />
            </div>
          )}

          {currentTask && getTaskKind(currentTask) === 'audio' && (
            <div className="mx-auto max-w-4xl rounded-xl border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-100">Audio Annotation</h3>
              <AudioAnnotator audioUrl={buildFileUrl(currentTask.dataItem)} labelSet={currentTask.availableLabels || []}
                initialSegments={[]} readOnly={isReadOnly} onChange={() => {}} />
            </div>
          )}

          {currentTask && getTaskKind(currentTask) === 'text' && (
            <div className="mx-auto max-w-4xl rounded-xl border border-gray-700 bg-gray-800 p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-100">Text Annotation</h3>
              <p className="text-sm text-gray-500">Chế độ text annotation đang phát triển.</p>
            </div>
          )}

          {currentTask && getTaskKind(currentTask) === 'other' && (
            <div className="flex items-center justify-center h-full text-gray-500">Không hỗ trợ loại file này.</div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l border-gray-700 bg-gray-800 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-700">
            <h4 className="mb-3 text-sm font-semibold text-gray-300 uppercase tracking-wide">Nhãn có sẵn</h4>
            <div className="space-y-1">
              {(currentTask?.availableLabels || []).map((lbl) => (
                <div key={lbl.name} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-700 transition-colors cursor-pointer">
                  <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: lbl.color || '#3b82f6' }} />
                  <span className="text-sm text-gray-200">{lbl.name}</span>
                  {lbl.shortcut && <span className="ml-auto text-xs text-gray-500 bg-gray-900 rounded px-1">{lbl.shortcut}</span>}
                </div>
              ))}
              {(!currentTask?.availableLabels || currentTask.availableLabels.length === 0) && (
                <p className="text-xs text-gray-500">Không có nhãn nào được gán.</p>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-gray-700">
            <h4 className="mb-3 text-sm font-semibold text-gray-300 uppercase tracking-wide">Ghi chú</h4>
            <textarea value={annotationNote} onChange={(e) => setAnnotationNote(e.target.value)}
              placeholder="Ghi chú cho task này..." disabled={isReadOnly}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50"
              rows={4} />
          </div>

          {currentTask?.subtopicId?.guideline && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="mb-3 text-sm font-semibold text-gray-300 uppercase tracking-wide">Hướng dẫn</h4>
              <div className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {currentTask.subtopicId.guideline}
              </div>
            </div>
          )}

          <div className="p-4 border-b border-gray-700">
            <h4 className="mb-3 text-sm font-semibold text-gray-300 uppercase tracking-wide">Thông tin</h4>
            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex justify-between"><span>File:</span><span className="text-gray-300 truncate max-w-[140px]">{currentTask?.dataItem?.filename || '—'}</span></div>
              <div className="flex justify-between"><span>Status:</span><span className="text-gray-300 capitalize">{currentTask?.status || '—'}</span></div>
              {currentTask?.projectId?.deadline && (
                <div className="flex justify-between"><span>Deadline:</span><span className="text-rose-400">{new Date(currentTask.projectId.deadline).toLocaleString('vi-VN')}</span></div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-2 mt-auto">
            {message && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-600 px-3 py-2 text-xs text-blue-300 text-center">{message}</div>
            )}
            <Button variant="outlined" size="small" onClick={handleSave} disabled={saving || isReadOnly} fullWidth>Đã lưu (Ctrl+S)</Button>
            <Button variant="contained" color="primary" size="small" onClick={handleCompleteTask} disabled={saving || isReadOnly} fullWidth>Hoàn thành & Tiếp</Button>
            {allCompletedInFiltered && (
              <Button variant="contained" color="success" size="small" onClick={handleSubmitBatch} disabled={saving || isReadOnly} fullWidth>Nộp batch</Button>
            )}
          </div>
        </div>
      </div>

      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onClose={() => setShowCompletionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Hoàn thành chủ đề!</DialogTitle>
        <DialogContent>
          <Typography paragraph>Bạn đã hoàn thành tất cả ảnh trong chủ đề hiện tại.</Typography>
          <Typography variant="body2" color="textSecondary">Bạn có muốn chuyển sang chủ đề khác hoặc nộp batch?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowCompletionDialog(false); navigate('/annotator/tasks'); }}>Quay lại danh sách</Button>
          <Button variant="contained" color="success" onClick={() => { setShowCompletionDialog(false); handleSubmitBatch(); }}>Nộp batch ngay</Button>
          {subtopics.length > 1 && (
            <Button variant="contained" color="primary" onClick={() => {
              setShowCompletionDialog(false);
              const nextSt = subtopics.find((st) => (st.subtopicId || '__none__') !== selectedSubtopicId && st.doneCount < st.total);
              if (nextSt) setSelectedSubtopicId(nextSt.subtopicId || '__none__');
            }}>Chuyển chủ đề</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Xác nhận nộp bài</DialogTitle>
        <DialogContent>
          <Typography>Bạn có chắc muốn nộp bài cho reviewer?</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Sau khi nộp, bạn sẽ không thể chỉnh sửa.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubmitConfirm(false)} color="error">Hủy</Button>
          <Button variant="contained" onClick={() => { setShowSubmitConfirm(false); navigate('/annotator/tasks'); }}>Xác nhận</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AnnotatorWorkspace;