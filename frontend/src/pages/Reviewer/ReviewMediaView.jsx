import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_URL } from '../../config/api';

export function buildFileUrl(dataItem) {
  if (!dataItem) return '';
  const baseUrl = API_URL.replace(/\/+$/, '');
  const rawPath = dataItem.path || '';
  const cleanPath = rawPath.replace(/^\/+/, '');
  if (cleanPath) {
    return baseUrl + '/' + cleanPath;
  }
  if (dataItem.filename) {
    return baseUrl + '/uploads/datasets/' + dataItem.filename;
  }
  return '';
}

const ReviewMediaView = ({ task, annotations = [] }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const getTaskKind = useCallback(() => {
    const mt = (task?.dataItem?.mimeType || '').toLowerCase();
    const fileName = (task?.dataItem?.filename || task?.dataItem?.path || '').toLowerCase();
    if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) return 'image';
    if (mt.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) return 'audio';
    if (mt.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fileName)) return 'text';
    return 'other';
  }, [task]);

  const getLabelColor = (labelName) => {
    const labelDef = task?.availableLabels?.find((l) => l.name === labelName);
    return labelDef?.color || '#3b82f6';
  };

  const drawAnnotations = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !imgLoaded) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const ctx = canvas.getContext('2d');

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const natW = img.naturalWidth || displayWidth;
    const natH = img.naturalHeight || displayHeight;
    const scaleX = displayWidth / natW;
    const scaleY = displayHeight / natH;

    const objects = annotations.length > 0 ? annotations : (task?.labels?.objects || []);

    const toDisplayBox = (bbox = []) => {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = bbox;
      const maxAbs = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));

      // New annotator format: percentages (0-100)
      const looksLikePercent = maxAbs <= 100;
      if (looksLikePercent) {
        return {
          dx1: (x1 / 100) * displayWidth,
          dy1: (y1 / 100) * displayHeight,
          dw: ((x2 - x1) / 100) * displayWidth,
          dh: ((y2 - y1) / 100) * displayHeight,
        };
      }

      // Legacy format: absolute pixels based on natural image size
      return {
        dx1: x1 * scaleX,
        dy1: y1 * scaleY,
        dw: (x2 - x1) * scaleX,
        dh: (y2 - y1) * scaleY,
      };
    };

    objects.forEach((obj, idx) => {
      const color = getLabelColor(obj.label);
      const { dx1, dy1, dw, dh } = toDisplayBox(obj.bbox || [0, 0, 0, 0]);

      ctx.fillStyle = color + '20';
      ctx.fillRect(dx1, dy1, dw, dh);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(dx1, dy1, dw, dh);

      const labelText = obj.label || 'Label ' + (idx + 1);
      ctx.font = 'bold 12px Inter, sans-serif';
      const textWidth = ctx.measureText(labelText).width + 8;
      ctx.fillStyle = color;
      ctx.fillRect(dx1, Math.max(0, dy1 - 22), Math.max(textWidth, 60), 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, dx1 + 4, dy1 - 7);

      if (obj.confidence !== undefined) {
        ctx.fillStyle = color;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(Math.round(obj.confidence * 100) + '%', dx1 + 4, dy1 + dh + 14);
      }
    });
  }, [annotations, task, imgLoaded]);

  const kind = getTaskKind();

  useEffect(() => {
    if (kind === 'image' && imgLoaded) {
      const timer = setTimeout(drawAnnotations, 50);
      return () => clearTimeout(timer);
    }
  }, [kind, imgLoaded, drawAnnotations]);

  useEffect(() => {
    if (kind !== 'image') return;
    const handleResize = () => { if (imgLoaded) drawAnnotations(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [kind, imgLoaded, drawAnnotations]);

  // Reset state when task changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    setImageSize({ width: 0, height: 0 });
  }, [task?._id]);

  if (kind === 'image') {
    const imageUrl = buildFileUrl(task?.dataItem);
    const objects = annotations.length > 0 ? annotations : (task?.labels?.objects || []);

    return (
      <div ref={containerRef} className="relative w-full space-y-3">
        <div className="relative overflow-auto rounded-lg border border-gray-700 bg-gray-800">
          {imgError ? (
            <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
              <div className="text-4xl mb-3">?</div>
              <p className="text-sm text-gray-400 mb-1">Khong the tai anh</p>
              <p className="text-xs text-gray-600 break-all px-4 text-center max-w-md" title={imageUrl}>
                {imageUrl}
              </p>
            </div>
          ) : (
            <div className="relative inline-block w-full">
              <img
                ref={imgRef}
                src={imageUrl}
                alt={task?.dataItem?.filename || 'Review image'}
                className="max-w-full h-auto block"
                onLoad={(e) => {
                  setImgLoaded(true);
                  setImgError(false);
                  setImageSize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
                }}
                onError={(e) => { setImgError(true); setImgLoaded(false); e.target.style.display = 'none'; }}
                crossOrigin="anonymous"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ opacity: 0.9 }}
              />
            </div>
          )}
        </div>

        {objects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Annotations ({objects.length})
            </h4>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {objects.map((obj, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-2 hover:border-gray-600 transition-colors">
                  <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: getLabelColor(obj.label) }} />
                  <span className="text-sm font-medium text-gray-200">
                    {obj.label || 'Object ' + (idx + 1)}
                  </span>
                  {obj.confidence !== undefined && (
                    <span className="ml-auto text-xs text-gray-500">
                      {Math.round(obj.confidence * 100)}%
                    </span>
                  )}
                  <span className="ml-2 text-[11px] text-gray-600 font-mono">
                    [{((obj.bbox?.[0]) || 0).toFixed(0)}, {((obj.bbox?.[1]) || 0).toFixed(0)}, {((obj.bbox?.[2]) || 0).toFixed(0)}, {((obj.bbox?.[3]) || 0).toFixed(0)}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {objects.length === 0 && (
          <div className="rounded border border-gray-700 bg-gray-800/50 px-3 py-2 text-center">
            <span className="text-xs text-gray-500 italic">Khong co annotation nao tu annotator</span>
          </div>
        )}

        <div className="rounded border border-gray-700/50 bg-gray-800/50 px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500 italic">Che do doc - Annotations duoc them boi Annotator</span>
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
          <span className="text-xs text-gray-500 italic">Che do doc - Annotations duoc them boi Annotator</span>
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
            <audio controls className="w-full h-12" src={audioUrl}>Trinh duyet khong ho tro audio.</audio>
          ) : (
            <div className="text-center text-gray-500 py-4">Khong co file audio</div>
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
          <span className="text-xs text-gray-500 italic">Che do doc - Annotations duoc them boi Annotator</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-800 p-8 text-gray-500 min-h-[200px]">
      <div className="text-3xl mb-2">?</div>
      <p className="text-sm">File khong ho tro preview truc tiep.</p>
      <p className="text-xs mt-1 text-gray-600">mimeType: {task?.dataItem?.mimeType || 'unknown'}</p>
    </div>
  );
};

export default ReviewMediaView;