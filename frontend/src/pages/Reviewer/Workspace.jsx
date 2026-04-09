import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const buildFileUrl = (dataItem) => {
  if (!dataItem) return '';
  const baseUrl = API_URL.replace(/\/+$/, '');
  const directUrl = dataItem?.url || dataItem?.imageUrl || '';
  if (directUrl && /^https?:\/\//i.test(directUrl)) return directUrl;
  const filename = dataItem?.originalName || dataItem?.filename || '';
  const rawPath = (dataItem?.path || directUrl || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (rawPath) {
    const uploadsIdx = rawPath.indexOf('uploads/');
    const relativePath = uploadsIdx !== -1 ? rawPath.substring(uploadsIdx) : rawPath;
    const parts = relativePath.split('/');
    const last = parts[parts.length - 1];
    const hasExt = /\.\w{1,10}$/i.test(last);
    if (hasExt) return `${baseUrl}/${relativePath}`;
    return filename ? `${baseUrl}/${relativePath}/${filename}` : `${baseUrl}/${relativePath}`;
  }
  return filename ? `${baseUrl}/uploads/datasets/${filename}` : '';
};

const getTaskKind = (t) => {
  const mt = (t?.dataItem?.mimeType || '').toLowerCase();
  const fn = (t?.dataItem?.filename || t?.dataItem?.path || '').toLowerCase();
  if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fn)) return 'image';
  if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(fn)) return 'audio';
  if (mt.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fn)) return 'text';
  return 'other';
};

const ITEM_STATUS = {
  pending_review: { label: 'Cho review', dot: 'bg-yellow-400' },
  partially_reviewed: { label: 'Mot phan', dot: 'bg-orange-400' },
  fully_reviewed: { label: 'Da review xong', dot: 'bg-emerald-400' },
  waiting_rework: { label: 'Cho sua lai', dot: 'bg-amber-400' },
  finalized: { label: 'Da finalize', dot: 'bg-purple-400' },
};

const SUBMISSION_STATUS = {
  pending: { label: 'Cho review', color: 'bg-yellow-600' },
  approved: { label: 'Approved', color: 'bg-emerald-600' },
  rejected: { label: 'Rejected', color: 'bg-rose-600' },
};

const FEEDBACK_CATEGORIES = [
  { value: 'incorrect_label', label: 'Nhan sai' },
  { value: 'missing_label', label: 'Thieu nhan' },
  { value: 'poor_quality', label: 'Chat luong thap' },
  { value: 'does_not_follow_guidelines', label: 'Khong dung guideline' },
  { value: 'other', label: 'Khac' },
];

const stringToColor = (str) => {
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getAnnotatorStatus = (task) => {
  if (task.status === 'approved') return 'approved';
  if (task.status === 'rejected') return 'rejected';
  return 'pending';
};

const updateItemStatus = (item) => {
  const subs = item.submissions || [];
  const approved = subs.filter(s => s.status === 'approved').length;
  const rejected = subs.filter(s => s.status === 'rejected').length;
  const pending = subs.filter(s => s.status === 'pending').length;
  const reviewed = approved + rejected;
  if (reviewed === 0) { item.status = 'pending_review'; }
  else if (reviewed === subs.length) { item.status = rejected > 0 && pending === 0 ? 'waiting_rework' : 'fully_reviewed'; }
  else { item.status = 'partially_reviewed'; }
};

// Panel hien thi Review Queue khi da loc theo subtopic (chi hien items cua subtopic do)
const ReviewQueueFlatPanel = ({ items, currentItemId, onSelect }) => (
  <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
    <div className="p-3 border-b border-gray-700 shrink-0">
      <h3 className="text-sm font-bold text-gray-200">Review Queue</h3>
      <p className="text-xs text-gray-500 mt-0.5">
        {items.length} item &mdash; {items.filter(i => i.status === 'pending_review' || i.status === 'partially_reviewed').length} can review
      </p>
    </div>
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => {
        const cfg = ITEM_STATUS[item.status] || ITEM_STATUS.pending_review;
        const isActive = item.itemId === currentItemId;
        return (
          <div key={item.itemId} onClick={() => onSelect(item)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-l-2 ${
              isActive ? 'bg-violet-600/15 border-violet-500' : 'border-transparent hover:bg-gray-800/60 hover:border-gray-600'
            }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${item.status === 'waiting_rework' ? 'animate-pulse' : ''}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${isActive ? 'text-violet-300' : 'text-gray-300'}`}>
                {item.filename || item.itemId?.slice(-8) || 'Item'}
              </p>
              <p className="text-[10px] text-gray-500">{item.submissions?.length || 0} subs</p>
            </div>
            <div className="flex -space-x-1">
              {(item.submissions || []).slice(0, 4).map((sub) => (
                <span key={sub.submissionId}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 text-white border border-gray-900"
                  style={{ backgroundColor: sub.color || '#3b82f6' }}>
                  {(sub.annotatorName || '?')[0].toUpperCase()}
                </span>
              ))}
              {(item.submissions?.length || 0) > 4 && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-gray-700 text-gray-400 border border-gray-900">
                  +{item.submissions.length - 4}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {items.length === 0 && <div className="p-4 text-center text-gray-500 text-xs">Khong co item</div>}
    </div>
  </div>
);

// Panel Review Queue khi xem FULL (khong loc subtopic): group theo subtopic, click expand moi hien items
const ReviewQueueGroupedPanel = ({ items, currentItemId, onSelect }) => {
  const [expandedSubtopics, setExpandedSubtopics] = useState({});

  // Group items by subtopic
  const grouped = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const subId = item.subtopicId || '__none__';
      const subName = item.subtopicName || 'Khong phan loai';
      if (!groups[subId]) {
        groups[subId] = { subtopicId: subId, subtopicName: subName, items: [], expanded: !!expandedSubtopics[subId] };
      }
      groups[subId].items.push(item);
    });
    return Object.values(groups);
  }, [items, expandedSubtopics]);

  const toggleSubtopic = (subId) => {
    setExpandedSubtopics(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  const totalPending = items.filter(i => i.status === 'pending_review' || i.status === 'partially_reviewed').length;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      <div className="p-3 border-b border-gray-700 shrink-0">
        <h3 className="text-sm font-bold text-gray-200">Review Queue</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {items.length} item &mdash; {totalPending} can review
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">Khong co item</div>
        ) : grouped.map((group) => {
          const pendingInGroup = group.items.filter(i => i.status === 'pending_review' || i.status === 'partially_reviewed').length;
          return (
            <div key={group.subtopicId}>
              {/* Subtopic header - click de expand/collapse */}
              <div
                onClick={() => toggleSubtopic(group.subtopicId)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-l-2 border-transparent hover:bg-gray-800/60 hover:border-gray-600 ${
                  group.expanded ? 'border-violet-500 bg-violet-600/10' : ''
                }`}
              >
                <svg
                  className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${group.expanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold truncate ${group.expanded ? 'text-violet-300' : 'text-gray-200'}`}>
                    {group.subtopicName}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {group.items.length} item &mdash; {pendingInGroup} can review
                  </p>
                </div>
                {pendingInGroup > 0 && (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                )}
              </div>

              {/* Items ben trong subtopic - chi hien khi expand */}
              {group.expanded && (
                <div className="ml-4 border-l border-gray-700/50">
                  {group.items.map((item) => {
                    const cfg = ITEM_STATUS[item.status] || ITEM_STATUS.pending_review;
                    const isActive = item.itemId === currentItemId;
                    return (
                      <div key={item.itemId} onClick={() => onSelect(item)}
                        className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border-l-2 ${
                          isActive ? 'bg-violet-600/15 border-violet-500' : 'border-transparent hover:bg-gray-800/60 hover:border-gray-600'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-medium truncate ${isActive ? 'text-violet-300' : 'text-gray-300'}`}>
                            {item.filename || item.itemId?.slice(-8) || 'Item'}
                          </p>
                        </div>
                        <div className="flex -space-x-0.5">
                          {(item.submissions || []).slice(0, 3).map((sub) => (
                            <span key={sub.submissionId}
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 text-white border border-gray-900"
                              style={{ backgroundColor: sub.color || '#3b82f6' }}>
                              {(sub.annotatorName || '?')[0].toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== IMAGE PANEL =====
// Bbox from ImageAnnotator: percentage coords [x1,y1,x2,y2] (0-100)
// availableLabels: array of { name, color, ... } from project/labelset
const ImageViewPanel = ({ item, visibleAnnotators, activeAnnotatorId, availableLabels }) => {
  const imgRef = useRef(null);
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setImgNat({ w: 0, h: 0 });
  }, [item?.imageUrl]);

  const handleLoad = (e) => {
    const img = e.target;
    setImgNat({ w: img.naturalWidth, h: img.naturalHeight });
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  // Tra cuu mau cua label class tu availableLabels
  const getLabelColor = (labelName) => {
    if (!availableLabels || !labelName) return '#888888';
    const found = availableLabels.find(l => l.name === labelName);
    return found?.color || '#888888';
  };

  // Quy doi bbox percentage -> pixel theo natural dimensions
  const toPixel = (bbox) => {
    if (!bbox || bbox.length < 4 || imgNat.w === 0 || imgNat.h === 0) return null;
    const [x1, y1, x2, y2] = bbox;
    return {
      px: (x1 / 100) * imgNat.w,
      py: (y1 / 100) * imgNat.h,
      pw: ((x2 - x1) / 100) * imgNat.w,
      ph: ((y2 - y1) / 100) * imgNat.h,
    };
  };

  if (!item?.imageUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <p className="text-gray-500 text-xs">Khong co URL anh</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-800 p-3 flex items-center justify-center">
      <div className="relative inline-block">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/80 rounded-lg min-w-[200px] min-h-[200px]">
            <div className="h-8 w-8 border-3 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-900/90 rounded-lg min-w-[200px] min-h-[200px]">
            <p className="text-rose-400 text-xs font-semibold">Khong tai duoc anh</p>
          </div>
        )}

        <img
          ref={imgRef}
          key={item.imageUrl}
          src={item.imageUrl}
          alt={item.filename || 'Review item'}
          className="max-w-full rounded-lg border border-gray-700 block"
          style={{ maxHeight: '75vh', width: 'auto', height: 'auto', display: 'block' }}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* SVG Overlay - dung mau label goc tu availableLabels */}
        {isLoaded && imgNat.w > 0 && imgRef.current && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: imgRef.current.clientWidth,
              height: imgRef.current.clientHeight,
              overflow: 'visible',
            }}
            viewBox={`0 0 ${imgNat.w} ${imgNat.h}`}
            preserveAspectRatio="none"
          >
            {(item.submissions || []).map((sub) => {
              if (!visibleAnnotators.includes(sub.annotatorId)) return null;
              if (!sub.labels?.objects) return null;
              const isActive = sub.annotatorId === activeAnnotatorId;
              const alpha = isActive ? 0.3 : 0.15;
              const strokeW = isActive ? 3 : 2;

              return sub.labels.objects.map((obj, idx) => {
                const px = toPixel(obj.bbox);
                if (!px) return null;
                const labelText = obj.label || `Obj ${idx + 1}`;
                // Lay mau cua label class tu availableLabels (cung mau nhu luc annotator ve)
                const color = getLabelColor(obj.label);
                const tagH = 22;
                const tagW = Math.min(Math.max(px.pw, 30), 200);
                return (
                  <g key={`${sub.submissionId}-${idx}`}>
                    <rect
                      x={px.px} y={px.py} width={px.pw} height={px.ph}
                      fill={color} fillOpacity={alpha}
                      stroke={color} strokeWidth={strokeW}
                    />
                    <rect
                      x={px.px} y={Math.max(0, px.py - tagH)} width={tagW} height={tagH}
                      fill={color} fillOpacity={0.95} rx={2}
                    />
                    <text
                      x={px.px + 5} y={Math.max(15, px.py - 5)}
                      fill="white" fontSize={15} fontWeight="bold" fontFamily="sans-serif"
                    >
                      {labelText.length > 25 ? labelText.substring(0, 22) + '...' : labelText}
                    </text>
                  </g>
                );
              });
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

const ReviewPanel = ({ item, activeSubmission, submissions, visibleAnnotators, onAnnotatorToggle, onAnnotatorSelect, feedback, setFeedback, errorCategory, setErrorCategory, onApprove, onReject, onNextAnnotator, saving, isReadOnly }) => {
  const [rightTab, setRightTab] = useState('review');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllOverlay, setShowAllOverlay] = useState(true);

  const filteredSubs = submissions.filter(sub =>
    !searchQuery.trim() || (sub.annotatorName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleAll = () => {
    const newVal = !showAllOverlay;
    setShowAllOverlay(newVal);
    if (newVal) submissions.forEach(s => { if (!visibleAnnotators.includes(s.annotatorId)) onAnnotatorToggle(s.annotatorId); });
    else [...visibleAnnotators].forEach(id => onAnnotatorToggle(id));
  };

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 border-l border-gray-700">
        <p className="text-gray-500 text-xs">Chon item</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex border-b border-gray-700 shrink-0">
        {[{ key: 'review', label: 'Review' }, { key: 'info', label: 'Thong tin' }, { key: 'guide', label: 'Huong dan' }].map((tab) => (
          <button key={tab.key} onClick={() => setRightTab(tab.key)}
            className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-all border-b-2 ${
              rightTab === tab.key ? 'text-violet-400 border-violet-500 bg-violet-500/5' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rightTab === 'review' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">Annotator ({submissions.length})</h4>
                <button onClick={handleToggleAll}
                  className={`ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all border ${
                    showAllOverlay ? 'bg-violet-600/20 border-violet-500/40 text-violet-400' : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}>
                  {showAllOverlay ? 'â˜‘' : 'â˜'} All overlay
                </button>
              </div>

              <div className="relative mb-2">
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search annotator..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-800 text-[11px] text-gray-300 pl-7 pr-2 py-1 placeholder-gray-600 focus:outline-none focus:border-violet-500/50" />
              </div>

              <div className="space-y-0.5 max-h-[28vh] overflow-y-auto">
                {filteredSubs.map((sub) => {
                  const sc = SUBMISSION_STATUS[sub.status] || SUBMISSION_STATUS.pending;
                  const isActive = sub.annotatorId === activeSubmission?.annotatorId;
                  const isVisible = visibleAnnotators.includes(sub.annotatorId);
                  return (
                    <div key={sub.submissionId} onClick={() => onAnnotatorSelect(sub)}
                      className={`group flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-all border ${
                        isActive ? 'bg-violet-600/15 border-violet-500/50' : 'border-transparent hover:bg-gray-800/60'
                      }`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || '#3b82f6' }} />
                      <span className={`text-[11px] font-medium truncate flex-1 ${isActive ? 'text-violet-300' : 'text-gray-300 group-hover:text-gray-100'}`}>
                        {sub.annotatorName || 'Annotator'}
                      </span>
                      <span className={`shrink-0 rounded-full px-1 py-0.5 text-[9px] font-semibold ${sc.color} text-white`}>{sc.label}</span>
                      <label onClick={(e) => e.stopPropagation()} className="shrink-0 cursor-pointer" title="Hien thi overlay">
                        <input type="checkbox" checked={isVisible} onChange={() => onAnnotatorToggle(sub.annotatorId)}
                          className="w-3 h-3 rounded accent-violet-500 cursor-pointer" />
                      </label>
                    </div>
                  );
                })}
                {filteredSubs.length === 0 && <p className="text-[11px] text-gray-500 text-center py-2">Khong tim thay</p>}
              </div>
            </div>

            {activeSubmission && (
              <div className="p-2 space-y-2 flex-shrink-0">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/60 border border-gray-700/50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeSubmission.color || '#3b82f6' }} />
                  <span className="text-[11px] font-bold text-gray-200 flex-1 truncate">{activeSubmission.annotatorName}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${SUBMISSION_STATUS[activeSubmission.status]?.color || 'bg-gray-600'} text-white`}>
                    {SUBMISSION_STATUS[activeSubmission.status]?.label || activeSubmission.status}
                  </span>
                </div>

                {activeSubmission.feedback && (
                  <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2">
                    <p className="text-[9px] font-bold text-rose-400 mb-0.5">Feedback cu:</p>
                    <p className="text-[10px] text-rose-300 italic leading-snug">"{activeSubmission.feedback}"</p>
                  </div>
                )}

                {!isReadOnly && activeSubmission.status !== 'approved' && activeSubmission.status !== 'rejected' && (
                  <>
                    <select value={errorCategory} onChange={(e) => setErrorCategory(e.target.value)}
                      className="w-full rounded border border-gray-700 bg-gray-800 text-[11px] text-gray-300 px-2 py-1.5 focus:outline-none focus:border-violet-500/50">
                      <option value="">-- Loai loi (neu reject) --</option>
                      {FEEDBACK_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>

                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Nhap feedback..." rows={2}
                      className="w-full rounded border border-gray-700 bg-gray-800 text-[11px] text-gray-200 px-2 py-1.5 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none" />

                    <div className="flex gap-1.5">
                      <button onClick={() => onApprove(activeSubmission)} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 transition-all">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Approve
                      </button>
                      <button onClick={() => onReject(activeSubmission)} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1 rounded bg-rose-600 hover:bg-rose-700 text-white px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 transition-all">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        Reject
                      </button>
                    </div>

                    {submissions.filter(s => s.status === 'pending').length > 1 && (
                      <button onClick={onNextAnnotator} disabled={saving}
                        className="w-full rounded border border-gray-700 hover:border-gray-600 text-gray-500 hover:text-gray-300 px-2 py-1 text-[10px] font-medium transition-all disabled:opacity-50">
                        Chuyen annotator tiep
                      </button>
                    )}
                  </>
                )}

                {activeSubmission.status === 'approved' && (
                  <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                    <p className="text-[11px] text-emerald-400 font-semibold">Da approved</p>
                  </div>
                )}
                {activeSubmission.status === 'rejected' && (
                  <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2 text-center">
                    <p className="text-[11px] text-rose-400 font-semibold">Da rejected</p>
                  </div>
                )}
              </div>
            )}

            {!activeSubmission && (
              <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-[11px] text-gray-500">Chon annotator de review</p>
              </div>
            )}
          </div>
        )}

        {rightTab === 'info' && (
          <div className="p-2 space-y-2">
            {item.projectName && <div><p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Project</p><p className="text-[11px] text-gray-200">{item.projectName}</p></div>}
            {item.subtopicName && <div><p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Subtopic</p><p className="text-[11px] text-gray-300">{item.subtopicName}</p></div>}
            <div><p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">File</p><p className="text-[11px] text-gray-300 break-all">{item.filename || 'Unknown'}</p></div>
          </div>
        )}

        {rightTab === 'guide' && (
          <div className="p-2">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Guideline</p>
            {item.guideline ? <p className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">{item.guideline}</p>
              : <p className="text-[11px] text-gray-500 italic">Khong co guideline.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewerWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subtopicFilter = searchParams.get('subtopicId');

  const [items, setItems] = useState([]);
  const [currentItemId, setCurrentItemId] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorCategory, setErrorCategory] = useState('');
  const [visibleAnnotators, setVisibleAnnotators] = useState([]);
  const [activeAnnotatorId, setActiveAnnotatorId] = useState(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = {};
      if (subtopicFilter) params.subtopicId = subtopicFilter;
      const res = await axios.get(`${API_URL}/api/reviews/pending`, { params });
      const taskList = res.data || [];

      const itemMap = new Map();
      taskList.forEach((task) => {
        const itemKey = task.dataItem?.filename || task.dataItem?.path || task._id;
        const color = stringToColor(task.annotatorId?._id || task.annotatorId || task._id);

        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            itemId: itemKey,
            filename: task.dataItem?.filename || 'Unknown',
            imageUrl: buildFileUrl(task.dataItem),
            kind: getTaskKind(task),
            status: 'pending_review',
            projectName: task.projectId?.name || '',
            projectId: task.projectId?._id,
            subtopicName: task.subtopicId?.name || task.subtopicName || '',
            subtopicId: task.subtopicId?._id,
            guideline: task.projectId?.guidelines || '',
            availableLabels: task.availableLabels || task.projectId?.availableLabels || task.labelsetId?.labels || [],
            submissions: [],
          });
        }

        const item = itemMap.get(itemKey);
        item.submissions.push({
          submissionId: task._id,
          annotatorId: task.annotatorId?._id || task.annotatorId,
          annotatorName: task.annotatorId?.fullName || task.annotatorId?.username || 'Annotator',
          status: getAnnotatorStatus(task),
          labels: task.labels || {},
          feedback: task.reviewComments || '',
          color,
          task,
        });
        updateItemStatus(item);
      });

      const itemList2 = Array.from(itemMap.values());
      itemList2.sort((a, b) => {
        const order = { pending_review: 0, partially_reviewed: 1, waiting_rework: 2, fully_reviewed: 3, finalized: 4 };
        return (order[a.status] || 5) - (order[b.status] || 5);
      });

      setItems(itemList2);

      if (itemList2.length > 0 && !currentItemId) {
        const first = itemList2[0];
        setCurrentItemId(first.itemId);
        setCurrentItem(first);
        const firstPend = first.submissions.find(s => s.status === 'pending');
        if (firstPend) { setActiveAnnotatorId(firstPend.annotatorId); setVisibleAnnotators([firstPend.annotatorId]); }
      }
    } catch (err) {
      setFetchError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, subtopicFilter, currentItemId]);

  // Fetch a single reviewed task by ID (used when navigating from History page)
  const fetchReviewedTask = useCallback(async (taskId) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(`${API_URL}/api/reviews/task/${taskId}`, {
        headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('token') || localStorage.getItem('token')) }
      });
      const task = res.data;
      if (!task) { setFetchError('Task not found'); setLoading(false); return; }

      const itemKey = task.dataItem?.filename || task.dataItem?.path || task._id;
      const color = stringToColor(task.annotatorId?._id || task.annotatorId || task._id);

      const item = {
        itemId: itemKey,
        filename: task.dataItem?.filename || 'Unknown',
        imageUrl: buildFileUrl(task.dataItem),
        kind: getTaskKind(task),
        status: task.status === 'approved' ? 'fully_reviewed' : (task.status === 'rejected' ? 'waiting_rework' : 'pending_review'),
        projectName: task.projectId?.name || '',
        projectId: task.projectId?._id,
        subtopicName: task.subtopicId?.name || '',
        subtopicId: task.subtopicId?._id,
        guideline: task.projectId?.guidelines || '',
        availableLabels: task.availableLabels || task.projectId?.availableLabels || [],
        submissions: [{
          submissionId: task._id,
          annotatorId: task.annotatorId?._id || task.annotatorId,
          annotatorName: task.annotatorId?.fullName || task.annotatorId?.username || 'Annotator',
          status: getAnnotatorStatus(task),
          labels: task.labels || {},
          feedback: task.reviewComments || '',
          color,
          task,
        }],
      };
      updateItemStatus(item);

      setItems([item]);
      setCurrentItemId(item.itemId);
      setCurrentItem(item);
      setActiveAnnotatorId(task.annotatorId?._id || task.annotatorId);
      setVisibleAnnotators([task.annotatorId?._id || task.annotatorId]);
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Không tải được task');
    } finally {
      setLoading(false);
    }
  }, []);

  const taskIdFromUrl = searchParams.get('taskId');

  useEffect(() => {
    if (taskIdFromUrl) {
      fetchReviewedTask(taskIdFromUrl);
    } else {
      fetchQueue();
    }
  }, [taskIdFromUrl, fetchQueue, fetchReviewedTask]);

  const handleItemSelect = (item) => {
    setCurrentItemId(item.itemId);
    setCurrentItem(item);
    setFeedback('');
    setErrorCategory('');
    const firstPend = item.submissions.find(s => s.status === 'pending');
    if (firstPend) { setActiveAnnotatorId(firstPend.annotatorId); setVisibleAnnotators([firstPend.annotatorId]); }
    else { setActiveAnnotatorId(null); setVisibleAnnotators([]); }
  };

  const handleAnnotatorSelect = (sub) => { setActiveAnnotatorId(sub.annotatorId); setFeedback(sub.feedback || ''); setErrorCategory(''); };
  const handleAnnotatorToggle = (annotatorId) => { setVisibleAnnotators(prev => prev.includes(annotatorId) ? prev.filter(id => id !== annotatorId) : [...prev, annotatorId]); };

  const doUpdateItem = useCallback((updatedSub, newStatus, newFeedback) => {
    setItems(prev => prev.map(item => {
      const updatedSubs = item.submissions.map(s => s.submissionId === updatedSub.submissionId ? { ...s, status: newStatus, feedback: newFeedback } : s);
      const updatedItem = { ...item, submissions: updatedSubs };
      updateItemStatus(updatedItem);
      return updatedItem;
    }));
    if (currentItem?.itemId) {
      const updatedSubs = currentItem.submissions.map(s => s.submissionId === updatedSub.submissionId ? { ...s, status: newStatus, feedback: newFeedback } : s);
      const updatedItem = { ...currentItem, submissions: updatedSubs };
      updateItemStatus(updatedItem);
      setCurrentItem(updatedItem);
    }
  }, [currentItem]);

  const handleApprove = async (submission) => {
    if (!submission?.task) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/reviews/${submission.submissionId}/approve`, { reviewComments: feedback });
      doUpdateItem(submission, 'approved', '');
      setFeedback(''); setErrorCategory('');
      setSavingMsg('Approved!');
      setTimeout(() => setSavingMsg(''), 3000);
    } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const handleReject = (submission) => { if (!feedback.trim()) { alert('Vui long nhap feedback khi reject.'); return; } setShowRejectConfirm(true); };

  const confirmReject = async (submission) => {
    setShowRejectConfirm(false);
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/reviews/${submission.submissionId}/reject`, { reviewComments: feedback, errorCategory: errorCategory || 'other' });
      doUpdateItem(submission, 'rejected', feedback);
      setFeedback(''); setErrorCategory('');
      setSavingMsg('Rejected!');
      setTimeout(() => setSavingMsg(''), 3000);
    } catch (err) { alert('Loi: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const handleNextAnnotator = () => {
    if (!currentItem) return;
    const pending = currentItem.submissions.filter(s => s.status === 'pending');
    if (pending.length === 0) return;
    const idx = pending.findIndex(s => s.annotatorId === activeAnnotatorId);
    const next = pending[(idx + 1) % pending.length];
    handleAnnotatorSelect(next);
    setVisibleAnnotators([next.annotatorId]);
  };

  const activeSubmission = currentItem?.submissions?.find(s => s.annotatorId === activeAnnotatorId);
  const pendingCount = items.filter(i => i.status === 'pending_review' || i.status === 'partially_reviewed').length;
  const reviewedCount = items.filter(i => i.status === 'fully_reviewed' || i.status === 'finalized').length;

  const isFilteredMode = !!subtopicFilter;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-10 w-10 border-3 border-gray-700 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-400 text-xs">Dang tai...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center max-w-xs p-4">
          <p className="text-rose-400 text-xs font-semibold mb-2">{fetchError}</p>
          <button onClick={fetchQueue} className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white">Thu lai</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <div className="w-60 shrink-0">
        {isFilteredMode ? (
          <ReviewQueueFlatPanel items={items} currentItemId={currentItemId} onSelect={handleItemSelect} />
        ) : (
          <ReviewQueueGroupedPanel items={items} currentItemId={currentItemId} onSelect={handleItemSelect} />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="shrink-0 border-b border-gray-700 bg-gray-900/80 px-3 py-2">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()}
              className="flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold text-gray-200 truncate">{currentItem?.filename || 'Chon item'}</h2>
              <p className="text-[10px] text-gray-500">{items.length} item &mdash; {pendingCount} can review &mdash; {reviewedCount} da xong</p>
            </div>
            {currentItem && (
              <div className="flex items-center gap-1 shrink-0">
                {currentItem.submissions?.map((sub) => (
                  <button key={sub.annotatorId}
                    onClick={() => { handleAnnotatorSelect(sub); handleAnnotatorToggle(sub.annotatorId); }}
                    className="w-5 h-5 rounded-full border-2 border-gray-900 flex items-center justify-center text-[9px] font-bold text-white transition-all hover:scale-110"
                    style={{ backgroundColor: sub.color || '#3b82f6', opacity: visibleAnnotators.includes(sub.annotatorId) ? 1 : 0.4 }}
                    title={`${sub.annotatorName} (${visibleAnnotators.includes(sub.annotatorId) ? 'hien' : 'an'})`}>
                    {(sub.annotatorName || '?')[0].toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {savingMsg && <span className="text-[10px] text-violet-400 font-medium">{savingMsg}</span>}
          </div>
        </div>

        {currentItem ? (
          currentItem.kind === 'image' ? (
            <ImageViewPanel
              item={currentItem}
              availableLabels={currentItem?.availableLabels}
              visibleAnnotators={visibleAnnotators}
              activeAnnotatorId={activeAnnotatorId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-800">
              <p className="text-gray-500 text-xs">"{currentItem.kind}" chua ho tro</p>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-800">
            <p className="text-gray-500 text-xs">Chon item tu danh sach</p>
          </div>
        )}
      </div>

      <div className="w-72 shrink-0">
        <ReviewPanel
          item={currentItem} activeSubmission={activeSubmission} submissions={currentItem?.submissions || []}
          visibleAnnotators={visibleAnnotators}
          onAnnotatorToggle={handleAnnotatorToggle} onAnnotatorSelect={handleAnnotatorSelect}
          feedback={feedback} setFeedback={setFeedback}
          errorCategory={errorCategory} setErrorCategory={setErrorCategory}
          onApprove={handleApprove} onReject={handleReject}
          onNextAnnotator={handleNextAnnotator}
          saving={saving}
          isReadOnly={activeSubmission?.status === 'approved' || activeSubmission?.status === 'rejected'}
        />
      </div>

      <Dialog open={showRejectConfirm} onClose={() => setShowRejectConfirm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontSize: '14px', fontWeight: 700 }}>Xac nhan Reject</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '12px' }}>
            Annotator se nhan thong bao va can sua lai bai.
          </Typography>
          {feedback && <div className="mt-2 rounded bg-rose-500/10 border border-rose-500/20 p-2"><p className="text-[11px] text-rose-300">"{feedback}"</p></div>}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setShowRejectConfirm(false)} size="small" sx={{ color: '#94a3b8', fontSize: '11px' }}>Huy</Button>
          <Button onClick={() => confirmReject(activeSubmission)} variant="contained" size="small" disabled={saving} sx={{ bgcolor: '#dc2626', fontSize: '11px' }}>
            {saving ? '...' : 'Xac nhan'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ReviewerWorkspace;