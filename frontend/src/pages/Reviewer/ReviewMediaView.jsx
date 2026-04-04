import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '../../config/api';

const ReviewMediaView = ({ task, annotations = [] }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const getTaskKind = () => {
    const mt = (task?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (task?.dataItem?.filename || task?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt.startsWith('text/')) return 'text';
    if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
    if (/\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
    return 'other';
  };

  const buildFileUrl = (dataItem) => {
    if (!dataItem) return '';
    const baseUrl = API_URL.replace(/\/+$/, '');
    const rawPath = dataItem.path || '';
    const cleanPath = rawPath.replace(/^\/+/, '');
    if (cleanPath) {
      return dataItem.filename
        ? baseUrl + '/' + cleanPath + '/' + dataItem.filename
        : baseUrl + '/' + cleanPath;
    }
    return dataItem.filename ? baseUrl + '/uploads/datasets/' + dataItem.filename : '';
  };

  const getLabelColor = (labelName) => {
    const labelDef = task?.availableLabels?.find((l) => l.name === labelName);
    return labelDef?.color || '#3b82f6';
  };

  const kind = getTaskKind();

  useEffect(() => {
    if (kind !== 'image' || !canvasRef.current || imageSize.width === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scaleX = canvas.width / imageSize.width;
    const scaleY = canvas.height / imageSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const objects = annotations.length > 0 ? annotations : (task?.labels?.objects || []);
    objects.forEach((obj) => {
      const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
      const color = getLabelColor(obj.label);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
      ctx.fillStyle = color;
      const labelText = obj.label || 'Unknown';
      ctx.font = 'bold 12px Inter, sans-serif';
      const textWidth = ctx.measureText(labelText).width + 8;
      ctx.fillRect(x1 * scaleX, y1 * scaleY - 20, Math.max(textWidth, 60), 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x1 * scaleX + 4, y1 * scaleY - 7);
      if (obj.confidence !== undefined) {
        ctx.fillStyle = color;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(Math.round(obj.confidence * 100) + '%', x2 * scaleX - 30, y2 * scaleY + 14);
      }
    });
  }, [annotations, imageSize, kind, task]);

  if (kind === 'image') {
    const imageUrl = buildFileUrl(task?.dataItem);
    return (
      <div ref={containerRef} className="relative w-full">
        <div className="relative overflow-auto rounded-lg border border-gray-700 bg-gray-800">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={task?.dataItem?.filename || 'Review image'}
              className="max-w-full h-auto"
              onLoad={(e) => {
                setImageSize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
                if (canvasRef.current) {
                  canvasRef.current.width = e.target.clientWidth;
                  canvasRef.current.height = e.target.clientHeight;
                }
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.85 }} />
        </div>
        {(task?.labels?.objects || []).length > 0 && (
          <div className="mt-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Annotations ({task.labels.objects.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {task.labels.objects.map((obj, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-1.5">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getLabelColor(obj.label) }} />
                  <span className="text-xs font-medium text-gray-200">{obj.label}</span>
                  <span className="ml-auto text-[10px] text-gray-500 font-mono">
                    {((obj.bbox?.[0]) || 0).toFixed(0)},{((obj.bbox?.[1]) || 0).toFixed(0)},{((obj.bbox?.[2]) || 0).toFixed(0)},{((obj.bbox?.[3]) || 0).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 rounded border border-gray-700/50 bg-gray-800/50 px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500 italic">Read-only review - Labels added by Annotator</span>
        </div>
      </div>
    );
  }

  if (kind === 'text') {
    const textContent = task?.textContent || '';
    const spans = task?.labels?.spans || [];
    const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
    const parts = [];
    let lastIndex = 0;
    sortedSpans.forEach((span) => {
      if (span.start > lastIndex) parts.push({ text: textContent.substring(lastIndex, span.start), isSpan: false });
      const labelInfo = task?.availableLabels?.find((l) => l.name === span.label);
      parts.push({ text: textContent.substring(span.start, span.end), isSpan: true, label: span.label, color: labelInfo?.color || '#3b82f6' });
      lastIndex = span.end;
    });
    if (lastIndex < textContent.length) parts.push({ text: textContent.substring(lastIndex), isSpan: false });

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 max-h-96 overflow-auto">
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {parts.map((part, idx) => {
              if (part.isSpan) {
                return (
                  <mark key={idx} className="px-0.5 rounded" style={{ backgroundColor: part.color + '40', borderBottom: '2px solid ' + part.color }} title={'Label: ' + part.label}>
                    {part.text}
                  </mark>
                );
              }
              return <span key={idx}>{part.text}</span>;
            })}
          </div>
        </div>
        {spans.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Labels ({spans.length})</h4>
            {spans.map((span, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-1.5">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getLabelColor(span.label) }} />
                <span className="text-xs font-medium text-gray-200">{span.label}</span>
                <span className="text-[10px] text-gray-500 ml-auto">[{span.start}-{span.end}]</span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded border border-gray-700/50 bg-gray-800/50 px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500 italic">Read-only review mode</span>
        </div>
      </div>
    );
  }

  if (kind === 'audio') {
    const audioUrl = buildFileUrl(task?.dataItem);
    const segments = task?.labels?.segments || [];
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          {audioUrl ? (
            <audio controls className="w-full h-12" src={audioUrl}>Your browser does not support audio.</audio>
          ) : (
            <div className="text-center text-gray-500 py-4">No audio file available</div>
          )}
        </div>
        {segments.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Segments ({segments.length})</h4>
            {segments.map((seg, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-1.5">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getLabelColor(seg.label) }} />
                <span className="text-xs font-medium text-gray-200">{seg.label}</span>
                <span className="text-[10px] text-gray-500 ml-auto">
                  {typeof seg.start === 'number' ? seg.start.toFixed(1) : seg.start}s -{' '}
                  {typeof seg.end === 'number' ? seg.end.toFixed(1) : seg.end}s
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded border border-gray-700/50 bg-gray-800/50 px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500 italic">Read-only review mode</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 p-8 text-gray-500">
      Unsupported file type for review.
    </div>
  );
};

export default ReviewMediaView;