import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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

// Task kind detection
const getTaskKind = (t) => {
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
};

const buildFileUrl = (dataItem) => {
  if (!dataItem) return '';
  const baseUrl = API_URL.replace(/\/+$/, '');
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

// Status configuration
const TASK_STATUS = {
  assigned: { label: 'Chua lam', color: 'bg-gray-600', textColor: 'text-gray-300', dotColor: 'bg-gray-400' },
  in_progress: { label: 'Dang lam', color: 'bg-blue-600', textColor: 'text-blue-300', dotColor: 'bg-blue-400' },
  completed: { label: 'Hoan thanh', color: 'bg-yellow-600', textColor: 'text-yellow-300', dotColor: 'bg-yellow-400' },
  submitted: { label: 'Da nop', color: 'bg-orange-600', textColor: 'text-orange-300', dotColor: 'bg-orange-400' },
  approved: { label: 'Da duyet', color: 'bg-emerald-600', textColor: 'text-emerald-300', dotColor: 'bg-emerald-400' },
  rejected: { label: 'Bi tra lai', color: 'bg-rose-600', textColor: 'text-rose-300', dotColor: 'bg-rose-400' },
  revised: { label: 'Dang sua', color: 'bg-amber-600', textColor: 'text-amber-300', dotColor: 'bg-amber-400' },
};

// ===== LEFT PANEL: Task List =====
const TaskListPanel = ({ tasks, currentTaskId, onSelect, subtopicName }) => {
  const statusCounts = tasks.reduce((acc, t) => {
    const s = t.status || 'assigned';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const getStatusConfig = (status) => TASK_STATUS[status] || TASK_STATUS.assigned;

  const priorityOrder = ['rejected', 'revised', 'in_progress', 'assigned', 'completed', 'submitted', 'approved'];
  const sortedTasks = [...tasks].sort((a, b) => {
    const aP = priorityOrder.indexOf(a.status);
    const bP = priorityOrder.indexOf(b.status);
    if (aP !== bP) return aP - bP;
    return 0;
  });

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700 shrink-0">
        <h3 className="text-sm font-bold text-gray-200 mb-1">Danh sach Item</h3>
        <p className="text-xs text-gray-500 truncate">{subtopicName}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(statusCounts).map(([status, count]) => {
            const cfg = getStatusConfig(status);
            return (
              <span key={status} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} ${cfg.textColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedTasks.map((task, idx) => {
          const cfg = getStatusConfig(task.status);
          const isActive = task._id === currentTaskId;
          const filename = task.dataItem?.originalName || task.dataItem?.filename || `Item ${idx + 1}`;
          const kind = getTaskKind(task);
          return (
            <div
              key={task._id}
              onClick={() => onSelect(task._id)}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-l-2 ${
                isActive ? 'bg-blue-600/15 border-blue-500' : 'border-transparent hover:bg-gray-800/60 hover:border-gray-600'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotColor} ${task.status === 'rejected' ? 'animate-pulse' : ''}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-300' : 'text-gray-300 group-hover:text-gray-100'}`}>{filename}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {kind === 'image' && 'Hinh anh'}
                  {kind === 'audio' && 'Audio'}
                  {kind === 'text' && 'Van ban'}
                  {kind === 'other' && 'File'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} ${cfg.textColor}`}>{cfg.label}</span>
            </div>
          );
        })}
        {sortedTasks.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">Khong co item nao trong subtopic nay</div>
        )}
      </div>
    </div>
  );
};

// ===== RIGHT PANEL: Info & Actions =====
const InfoPanel = ({ task, subtopicName, guideline, onSave, onComplete, onSubmit, onReset, saving, savingMessage }) => {
  const [rightTab, setRightTab] = useState('info');
  const labels = task?.availableLabels || [];
  const isReadOnly = task?.status === 'submitted' || task?.status === 'approved';
  const hasFeedback = task?.status === 'rejected' && (task?.reviewComments || task?.rejectionReason);
  const feedback = task?.reviewComments || task?.rejectionReason || '';
  const subtopicGuideline = task?.subtopicId?.guideline || guideline || '';

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex border-b border-gray-700 shrink-0">
        {[{ key: 'info', label: 'Thong tin' }, { key: 'labels', label: 'Nhan' }, { key: 'guide', label: 'Huong dan' }].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRightTab(tab.key)}
            className={`flex-1 px-4 py-3 text-xs font-semibold transition-all border-b-2 ${
              rightTab === tab.key ? 'text-blue-400 border-blue-500 bg-blue-500/5' : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {rightTab === 'info' && (
          <div className="p-4 space-y-4">
            {subtopicName && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subtopic</h4>
                <p className="text-sm font-semibold text-gray-200">{subtopicName}</p>
              </div>
            )}
            {task?.projectId?.name && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project</h4>
                <p className="text-sm font-semibold text-gray-200">{task.projectId.name}</p>
                {task?.projectId?.deadline && (
                  <p className="text-xs text-gray-500 mt-0.5">Deadline: {new Date(task.projectId.deadline).toLocaleString('vi-VN')}</p>
                )}
              </div>
            )}
            {task?.datasetId?.name && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Dataset</h4>
                <p className="text-sm font-semibold text-gray-200">{task.datasetId.name}</p>
              </div>
            )}
            {task?.dataItem && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">File</h4>
                <p className="text-sm text-gray-300 break-all">{task.dataItem.originalName || task.dataItem.filename || 'Khong co ten'}</p>
                {task.dataItem.mimeType && <p className="text-xs text-gray-500 mt-0.5">{task.dataItem.mimeType}</p>}
              </div>
            )}
            {hasFeedback && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-4">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Phan hoi tu Reviewer
                </h4>
                <p className="text-sm text-rose-300 leading-relaxed">{feedback}</p>
                <p className="text-xs text-rose-500/70 mt-2">Vui long doc phan hoi va chinh sua truoc khi nop lai.</p>
              </div>
            )}
            {task?.status && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trang thai</h4>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TASK_STATUS[task.status]?.color || 'bg-gray-600'} ${TASK_STATUS[task.status]?.textColor || 'text-gray-300'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS[task.status]?.dotColor || 'bg-gray-400'}`} />
                  {TASK_STATUS[task.status]?.label || task.status}
                </span>
              </div>
            )}
            {labels.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nhan co san ({labels.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((lbl) => (
                    <span key={lbl.name} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: (lbl.color || '#3b82f6') + '20', color: lbl.color || '#3b82f6', border: `1px solid ${(lbl.color || '#3b82f6')}40` }}>
                      {lbl.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {rightTab === 'labels' && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Danh sach Nhan</h4>
              {labels.length === 0 ? (
                <p className="text-sm text-gray-500">Khong co nhan nao duoc dinh nghia.</p>
              ) : (
                <div className="space-y-2">
                  {labels.map((lbl) => (
                    <div key={lbl.name} className="flex items-start gap-3 rounded-lg border border-gray-700/60 bg-gray-800/40 p-3">
                      <div className="w-4 h-4 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: lbl.color || '#3b82f6' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-200">{lbl.name}</p>
                        {lbl.description && <p className="text-xs text-gray-500 mt-0.5">{lbl.description}</p>}
                        {lbl.shortcut && <p className="text-xs text-gray-600 mt-0.5">Shortcut: {lbl.shortcut}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {rightTab === 'guide' && (
          <div className="p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Huong dan Subtopic</h4>
            {subtopicGuideline ? (
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{subtopicGuideline}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">Khong co huong dan cho subtopic nay.</p>
            )}
            {task?.projectId?.questions && task.projectId.questions.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cau hoi</h4>
                <div className="space-y-2">
                  {task.projectId.questions.map((q, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3">
                      <p className="text-sm font-medium text-gray-200">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-gray-700 p-4 space-y-2 shrink-0 bg-gray-900/80">
        {!isReadOnly && (
          <>
            <button onClick={onComplete} disabled={saving}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-blue-400 border-t-white rounded-full animate-spin" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Danh dau hoan thanh
            </button>
            <button onClick={onSubmit} disabled={saving}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-emerald-400 border-t-white rounded-full animate-spin" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Nop item
            </button>
            <button onClick={onReset} disabled={saving || isReadOnly}
              className="w-full rounded-lg border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 px-4 py-2 text-xs font-medium transition-all disabled:opacity-30">
              Reset nhan
            </button>
          </>
        )}
        {task?.status === 'submitted' && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
            <p className="text-xs text-yellow-400 font-medium">Item dang cho reviewer duyet</p>
          </div>
        )}
        {task?.status === 'approved' && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
            <p className="text-xs text-emerald-400 font-medium">Item da duoc duyet boi reviewer</p>
          </div>
        )}
        <button onClick={() => window.history.back()}
          className="w-full rounded-lg border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 px-4 py-2 text-xs font-medium transition-all flex items-center justify-center gap-2 mt-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay ve Project
        </button>
      </div>
    </div>
  );
};

// ===== MIDDLE PANEL: Annotation Area =====
const AnnotationArea = ({ task, onAnnotationsChange, onLabelsChange, annotations, labels, textSpans, setTextSpans, annotationNote, setAnnotationNote }) => {
  const kind = getTaskKind(task);
  const textContainerRef = useRef(null);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [selectedTextRange, setSelectedTextRange] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const renderTextWithSpans = () => {
    if (!task) return null;
    const textContent = task._textContent || '';
    if (!textContent) return <p className="text-gray-500 text-sm">Khong co noi dung van ban.</p>;
    if (textSpans.length === 0) return <pre className="whitespace-pre-wrap text-gray-300 text-sm">{textContent}</pre>;
    const sortedSpans = [...textSpans].sort((a, b) => a.start - b.start);
    const parts = [];
    let lastIndex = 0;
    sortedSpans.forEach((span) => {
      if (span.start > lastIndex) parts.push({ text: textContent.substring(lastIndex, span.start), isSpan: false });
      const labelInfo = task?.availableLabels?.find((l) => l.name === span.label);
      parts.push({ text: textContent.substring(span.start, span.end), isSpan: true, spanId: span.id, label: span.label, color: labelInfo?.color || '#3b82f6' });
      lastIndex = span.end;
    });
    if (lastIndex < textContent.length) parts.push({ text: textContent.substring(lastIndex), isSpan: false });
    return (
      <pre className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
        {parts.map((part, idx) => {
          if (part.isSpan) return (
            <mark key={`span-${part.spanId}-${idx}`} className="px-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: part.color + '40', borderBottom: `2px solid ${part.color}` }}
              title={`Nhan: ${part.label}`}>{part.text}</mark>
          );
          return <span key={`text-${idx}`}>{part.text}</span>;
        })}
      </pre>
    );
  };

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Dang tai item...</p>
        </div>
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className="flex-1 overflow-auto bg-gray-800 p-4 md:p-6">
        <div className="mx-auto max-w-6xl rounded-xl border border-gray-700 bg-gray-900 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-200">Ghi nhan Hinh anh</h3>
            <span className="text-xs text-gray-500">{task?.dataItem?.filename || 'Image file'}</span>
          </div>
          <ImageAnnotator
            imageUrl={buildFileUrl(task.dataItem)}
            labelSet={task?.availableLabels || []}
            questions={task?.projectId?.questions || []}
            onAnnotationsChange={onAnnotationsChange}
            initialAnnotations={annotations}
            readOnly={task?.status === 'submitted' || task?.status === 'approved'}
          />
        </div>
      </div>
    );
  }

  if (kind === 'text') {
    return (
      <div className="flex-1 overflow-auto bg-gray-800 p-4 md:p-6">
        <div className="mx-auto max-w-5xl rounded-xl border border-gray-700 bg-gray-900 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-200">Ghi nhan Van ban</h3>
            <span className="text-xs text-gray-500">{task?.dataItem?.filename || 'Text file'}</span>
          </div>
          <div className="mb-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-2">
            <p className="text-xs text-blue-400 font-medium">Huong dan: Boi den phan van ban can ghi nhan, sau do chon nhan tu dropdown xuat hien.</p>
          </div>
          <div className="relative">
            <div
              ref={textContainerRef}
              className="border border-gray-700 rounded-lg bg-gray-800 p-4 max-h-96 overflow-auto text-sm text-gray-300 whitespace-pre-wrap leading-relaxed"
              onMouseUp={() => {
                if (task?.status === 'submitted' || task?.status === 'approved') return;
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;
                const range = selection.getRangeAt(0);
                const selectedText = selection.toString().trim();
                if (selectedText.length === 0) { setSelectedTextRange(null); setShowLabelDropdown(false); return; }
                if (!textContainerRef.current) return;
                const preRange = document.createRange();
                preRange.selectNodeContents(textContainerRef.current);
                preRange.setEnd(range.startContainer, range.startOffset);
                const start = preRange.toString().length;
                const end = start + selection.toString().length;
                const overlaps = textSpans.some((span) =>
                  (start >= span.start && start < span.end) || (end > span.start && end <= span.end) || (start <= span.start && end >= span.end)
                );
                if (overlaps) { alert('Phan van ban nay da duoc ghi nhan. Vui long chon phan khac hoac xoa nhan cu truoc.'); selection.removeAllRanges(); return; }
                setSelectedTextRange({ start, end, text: selectedText });
                const rect = range.getBoundingClientRect();
                const containerRect = textContainerRef.current.getBoundingClientRect();
                setDropdownPosition({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top - 10 });
                setShowLabelDropdown(true);
              }}
              style={{ userSelect: 'text' }}
            >
              {renderTextWithSpans()}
            </div>
            {showLabelDropdown && selectedTextRange && task?.availableLabels?.length > 0 && (
              <div className="absolute z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-2 min-w-[200px]"
                style={{ left: `${dropdownPosition.x}px`, top: `${dropdownPosition.y}px`, transform: 'translateX(-50%) translateY(-100%)' }}>
                <p className="text-xs font-bold text-gray-400 mb-2 px-2">Chon nhan:</p>
                <div className="space-y-1">
                  {task.availableLabels.map((lbl) => (
                    <button key={lbl.name}
                      onClick={() => {
                        const newSpan = { id: `span-${Date.now()}`, start: selectedTextRange.start, end: selectedTextRange.end, text: selectedTextRange.text, label: lbl.name, note: '' };
                        setTextSpans([...textSpans, newSpan].sort((a, b) => a.start - b.start));
                        setSelectedTextRange(null); setShowLabelDropdown(false);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                      style={{ borderLeft: `3px solid ${lbl.color || '#3b82f6'}` }}>
                      {lbl.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setSelectedTextRange(null); setShowLabelDropdown(false); window.getSelection()?.removeAllRanges(); }}
                  className="mt-2 w-full text-xs text-gray-500 hover:text-gray-300 text-center py-1">Huy</button>
              </div>
            )}
          </div>
          {textSpans.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phan da ghi nhan ({textSpans.length})</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {textSpans.map((span) => {
                  const labelInfo = task?.availableLabels?.find((l) => l.name === span.label);
                  return (
                    <div key={span.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-800 border border-gray-700/60">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: labelInfo?.color || '#3b82f6' }} />
                      <span className="text-xs font-semibold text-gray-300 shrink-0">{span.label}</span>
                      <span className="text-xs text-gray-500 truncate flex-1">"{span.text}"</span>
                      {task?.status !== 'submitted' && task?.status !== 'approved' && (
                        <button onClick={() => setTextSpans(textSpans.filter((s) => s.id !== span.id))} className="text-rose-400 hover:text-rose-300 text-sm font-bold px-1 shrink-0">x</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Ghi chu (neu co)</label>
            <textarea
              className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              rows={3} placeholder="Nhap ghi chu tong the (neu can)..." value={annotationNote}
              onChange={(e) => setAnnotationNote(e.target.value)}
              disabled={task?.status === 'submitted' || task?.status === 'approved'}
            />
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="flex-1 overflow-auto bg-gray-800 p-4 md:p-6">
        <div className="mx-auto max-w-5xl rounded-xl border border-gray-700 bg-gray-900 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-200">Ghi nhan Audio</h3>
            <span className="text-xs text-gray-500">{task?.dataItem?.filename || 'Audio file'}</span>
          </div>
          <AudioAnnotator
            audioUrl={buildFileUrl(task?.dataItem)}
            labelSet={task?.availableLabels || []}
            initialSegments={labels?.segments || []}
            readOnly={task?.status === 'submitted' || task?.status === 'approved'}
            onChange={(segs) => onLabelsChange({ ...labels, segments: segs })}
          />
          <div className="mt-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Ghi chu</label>
            <textarea
              className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              rows={4} placeholder="Nhap ghi chu..." value={annotationNote}
              onChange={(e) => setAnnotationNote(e.target.value)}
              disabled={task?.status === 'submitted' || task?.status === 'approved'}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-800">
      <p className="text-gray-500 text-sm">Loai file khong duoc ho tro: {kind}</p>
    </div>
  );
};

// ===== MAIN WORKSPACE COMPONENT =====
const Workspace = () => {
  const { subtopicId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTaskId = searchParams.get('taskId');

  // REFS: MUST be declared BEFORE useCallback
  const isMountedRef = useRef(true);
  const currentTaskIdRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [task, setTask] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [labels, setLabels] = useState({});
  const [textSpans, setTextSpans] = useState([]);
  const [annotationNote, setAnnotationNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState('');
  const [subtopicInfo, setSubtopicInfo] = useState({ name: '', guideline: '' });
  const [projectInfo, setProjectInfo] = useState({ name: '', id: '' });
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [textContent, setTextContent] = useState('');

  // Mount lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Keep currentTaskIdRef in sync
  useEffect(() => { currentTaskIdRef.current = currentTaskId; }, [currentTaskId]);

  // Load tasks list
  const loadTasks = useCallback(async () => {
    if (!subtopicId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/tasks/my-tasks`, { params: { subtopicId } });
      const taskList = res.data || [];
      if (!isMountedRef.current) return;
      setTasks(taskList);
      if (taskList.length > 0) {
        const first = taskList[0];
        setSubtopicInfo({ name: first.subtopicId?.name || first.subtopicName || 'Subtopic', guideline: first.subtopicId?.guideline || first.guideline || '' });
        setProjectInfo({ name: first.projectId?.name || '', id: first.projectId?._id || '' });
      }
      if (initialTaskId) {
        setCurrentTaskId(initialTaskId);
      } else if (taskList.length > 0) {
        const priorityOrder = ['rejected', 'revised', 'in_progress', 'assigned', 'completed', 'submitted'];
        const next = taskList.find((t) => priorityOrder.includes(t.status));
        setCurrentTaskId(next?._id || taskList[0]._id);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [subtopicId, initialTaskId]);

  // Load task detail
  const loadTaskDetail = useCallback(async (taskId) => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/tasks/${taskId}`);
      const taskData = res.data;
      if (!isMountedRef.current) return;
      setTask(taskData);
      const initialLabels = taskData.labels || {};
      setLabels(initialLabels);
      const kind = getTaskKind(taskData);

      if (kind === 'text') {
        try {
          const textRes = await axios.get(buildFileUrl(taskData.dataItem), { responseType: 'text' });
          if (isMountedRef.current) { setTextContent(textRes.data || ''); taskData._textContent = textRes.data || ''; }
        } catch { if (isMountedRef.current) setTextContent(''); }
        if (isMountedRef.current) {
          if (initialLabels?.spans && Array.isArray(initialLabels.spans)) {
            setTextSpans(initialLabels.spans.map((span, idx) => ({ ...span, id: span.id || `span-${idx}` })));
          } else { setTextSpans([]); }
          setAnnotationNote(initialLabels?.note || '');
        }
      } else {
        if (isMountedRef.current) { setTextSpans([]); setAnnotationNote(initialLabels?.note || ''); }
      }

      if (isMountedRef.current) {
        if (kind === 'image' && initialLabels?.objects && Array.isArray(initialLabels.objects)) {
          setAnnotations(initialLabels.objects.map((obj, idx) => ({
            id: Date.now() + idx, label: obj.label, bbox: obj.bbox || [0, 0, 10, 10],
            confidence: obj.confidence || 1.0, type: 'bbox', answer: obj.answer || null,
          })));
        } else { setAnnotations([]); }
      }
    } catch (err) {
      console.error('Error loading task detail:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  // Load tasks on mount/subtopicId change
  useEffect(() => {
    setCurrentTaskId(null);
    setTask(null);
    loadTasks();
  }, [loadTasks]);

  // Load task detail when currentTaskId changes
  useEffect(() => {
    if (currentTaskId) loadTaskDetail(currentTaskId);
  }, [currentTaskId, loadTaskDetail]);

  // Poll for status updates when submitted
  useEffect(() => {
    if (!task || task.status !== 'submitted') return;
    const interval = setInterval(() => {
      if (isMountedRef.current && currentTaskIdRef.current) loadTaskDetail(currentTaskIdRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, [task?.status, loadTaskDetail]);

  // Handlers
  const handleAnnotationsChange = useCallback((newAnnotations) => { setAnnotations(newAnnotations); }, []);
  const handleLabelsChange = useCallback((newLabels) => { setLabels(newLabels); }, []);

  // Auto-save: clear previous timer and set new one (2s debounce)
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!task || task.status === 'submitted' || task.status === 'approved') return;
    autoSaveTimerRef.current = setTimeout(() => { handleSave(); }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [annotations, textSpans, annotationNote]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    try {
      const kind = getTaskKind(task);
      let labelsPayload = {};
      if (kind === 'image') labelsPayload = { objects: annotations.map((ann) => ({ label: ann.label, bbox: ann.bbox, confidence: ann.confidence, answer: ann.answer || null })) };
      else if (kind === 'text') labelsPayload = { spans: textSpans.map(({ id, ...rest }) => rest), note: annotationNote?.trim() || '' };
      else if (kind === 'audio') labelsPayload = { segments: labels.segments || [], note: annotationNote?.trim() || '' };
      else labelsPayload = { note: annotationNote?.trim() || '', label: labels.label || '' };
      await axios.put(`${API_URL}/api/tasks/${task._id}/label`, { labels: labelsPayload });
      setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: 'in_progress' } : t));
    } catch { /* silent auto-save */ }
  }, [task, annotations, labels, textSpans, annotationNote]);

  const handleComplete = useCallback(async () => {
    if (!task) return;
    const kind = getTaskKind(task);
    if (kind === 'image' && annotations.length === 0) { alert('Vui long them it nhat mot nhan truoc khi hoan thanh.'); return; }
    if (kind === 'text' && textSpans.length === 0 && !annotationNote?.trim()) { alert('Vui long ghi nhan it nhat mot phan hoac them ghi chu.'); return; }
    if (kind === 'audio' && !(labels.segments?.length) && !annotationNote?.trim()) { alert('Vui long ghi nhan it nhat mot doan.'); return; }
    setSaving(true);
    try {
      await handleSave();
      await axios.post(`${API_URL}/api/tasks/${task._id}/complete`);
      setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: 'completed' } : t));
      setTask((prev) => prev ? { ...prev, status: 'completed' } : null);
      setSavingMessage('Da danh dau hoan thanh!');
      setTimeout(() => setSavingMessage(''), 3000);
    } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  }, [task, annotations, labels, textSpans, annotationNote, handleSave]);

  const handleSubmit = useCallback(async () => { if (!task) return; setShowSubmitConfirm(true); }, [task]);

  const handleConfirmSubmit = useCallback(async () => {
    if (!task) return;
    setShowSubmitConfirm(false); setSaving(true);
    try {
      await handleSave();
      await axios.post(`${API_URL}/api/tasks/${task._id}/submit`);
      setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: 'submitted' } : t));
      setTask((prev) => prev ? { ...prev, status: 'submitted' } : null);
      setSavingMessage('Da nop thanh cong!');
      setTimeout(() => setSavingMessage(''), 3000);
    } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  }, [task, handleSave]);

  const handleReset = useCallback(() => {
    if (!task) return;
    const kind = getTaskKind(task);
    if (kind === 'image') setAnnotations([]);
    if (kind === 'text') { setTextSpans([]); setAnnotationNote(''); }
    if (kind === 'audio') setLabels({});
    handleSave();
  }, [task, handleSave]);

  const handleTaskSelect = useCallback((taskId) => {
    setCurrentTaskId(taskId);
    navigate(`/annotator/workspace/${subtopicId}?taskId=${taskId}`, { replace: true });
  }, [subtopicId, navigate]);

  const handleNavigateTask = useCallback((direction) => {
    const currentIdx = tasks.findIndex((t) => t._id === currentTaskId);
    if (direction === 'prev' && currentIdx > 0) handleTaskSelect(tasks[currentIdx - 1]._id);
    else if (direction === 'next' && currentIdx < tasks.length - 1) handleTaskSelect(tasks[currentIdx + 1]._id);
  }, [tasks, currentTaskId, handleTaskSelect]);

  // Keyboard shortcuts
  useEffect(() => {
    if (loading) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (!saving && task?.status !== 'submitted' && task?.status !== 'approved') handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!saving && task?.status !== 'submitted' && task?.status !== 'approved') handleSubmit(); }
      if (e.key === 'ArrowLeft') handleNavigateTask('prev');
      if (e.key === 'ArrowRight') handleNavigateTask('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, saving, task?.status, handleSave, handleSubmit, handleNavigateTask]);

  const currentIdx = tasks.findIndex((t) => t._id === currentTaskId);
  const completedCount = tasks.filter((t) => ['submitted', 'approved'].includes(t.status)).length;
  const pct = tasks.length > 0 ? Math.round(((currentIdx + 1) / tasks.length) * 100) : 0;
  const taskWithContent = task ? { ...task, _textContent: textContent } : null;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <div className="w-72 shrink-0">
        <TaskListPanel tasks={tasks} currentTaskId={currentTaskId} onSelect={handleTaskSelect} subtopicName={subtopicInfo.name} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="shrink-0 border-b border-gray-700 bg-gray-900/80 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-200 truncate">{subtopicInfo.name} — Item {currentIdx + 1}/{tasks.length}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Da hoan thanh: {completedCount}/{tasks.length} items</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleNavigateTask('prev')} disabled={currentIdx <= 0}
                className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-gray-500 font-mono w-12 text-center">{currentIdx + 1}/{tasks.length}</span>
              <button onClick={() => handleNavigateTask('next')} disabled={currentIdx >= tasks.length - 1}
                className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="hidden sm:block w-32 shrink-0">
              <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          {task && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TASK_STATUS[task.status]?.color || 'bg-gray-600'} ${TASK_STATUS[task.status]?.textColor || 'text-gray-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS[task.status]?.dotColor || 'bg-gray-400'}`} />
                {TASK_STATUS[task.status]?.label || task.status}
              </span>
              {task?.status === 'rejected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/30">Co phan hoi tu reviewer</span>
              )}
              {task?.status === 'approved' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">Da duyet</span>
              )}
              {task?.status === 'submitted' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400 border border-yellow-500/30">Dang cho review</span>
              )}
            </div>
          )}
        </div>
        <AnnotationArea task={taskWithContent} onAnnotationsChange={handleAnnotationsChange} onLabelsChange={handleLabelsChange}
          annotations={annotations} labels={labels} textSpans={textSpans} setTextSpans={setTextSpans}
          annotationNote={annotationNote} setAnnotationNote={setAnnotationNote} />
      </div>
      <div className="w-80 shrink-0">
        <InfoPanel task={task} subtopicName={subtopicInfo.name} guideline={subtopicInfo.guideline}
          onSave={handleSave} onComplete={handleComplete} onSubmit={handleSubmit} onReset={handleReset}
          saving={saving} savingMessage={savingMessage} />
      </div>
      <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Xac nhan nop bai</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#94a3b8' }} gutterBottom>Ban co chac chan muon nop item nay de review?</Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>Sau khi nop, ban se khong the chinh sua nua cho den khi duoc reviewer xu ly.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowSubmitConfirm(false)} sx={{ color: '#94a3b8' }}>Huy</Button>
          <Button onClick={handleConfirmSubmit} variant="contained" disabled={saving} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' } }}>
            {saving ? 'Dang nop...' : 'Xac nhan nop'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Workspace;
