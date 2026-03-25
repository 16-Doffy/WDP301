import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';

/**
 * AudioAnnotator component
 * Hiển thị sóng âm, điều khiển nghe và chọn các đoạn thời gian.
 * Props:
 *  - audioUrl: string
 *  - labelSet: [{name,color}]
 *  - initialSegments: [{id,start,end,label}]
 *  - readOnly: boolean
 *  - onChange: function(segments)
 */
const AudioAnnotator = ({ audioUrl, labelSet = [], initialSegments = [], readOnly = false, onChange }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [segments, setSegments] = useState(initialSegments);
  const [selectedLabel, _setSelectedLabel] = useState(labelSet[0]?.name || '');
  const selectedLabelRef = useRef(labelSet[0]?.name || '');
  const setSelectedLabel = (val) => {
    selectedLabelRef.current = val;
    _setSelectedLabel(val);
  };
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, forceRender] = useState({}); // để cập nhật tiến độ thời gian

  // util: màu label
  const getLabelColor = (label, opacity = 0.3) => {
    const info = labelSet.find((l) => l.name === label);
    if (!info) return `rgba(59,130,246,${opacity})`;
    const hex = info.color.replace('#', '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${opacity})`;
  };

  // init wavesurfer
  useEffect(() => {
    if (!waveformRef.current) return;
    if (wavesurferRef.current) wavesurferRef.current.destroy();

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#93c5fd',
      progressColor: '#3b82f6',
      cursorColor: '#111827',
      barWidth: 2,
      barGap: 1,
      height: 100,
      responsive: true,
      plugins: [RegionsPlugin.create({ dragSelection: !readOnly })],
    });
    wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on('ready', () => {
      setIsReady(true);
      initialSegments.forEach((seg) => {
        ws.addRegion({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          color: getLabelColor(seg.label),
          drag: !readOnly,
          resize: !readOnly,
          data: { label: seg.label },
        });
      });
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    // re-render current time every 200ms
    const interval = setInterval(() => forceRender({}), 200);

    // region events
    ws.on('region-click', (reg, e) => {
      e.stopPropagation();
      reg.play();
    });

    ws.on('region-created', (region) => {
      if (!region.data.label) {
        region.update({ color: getLabelColor(selectedLabelRef.current), data: { label: selectedLabelRef.current } });
        const newSeg = { id: region.id, start: region.start, end: region.end, label: selectedLabelRef.current };
        setSegments((prev) => {
          const next = [...prev, newSeg];
          onChange?.(next);
          return next;
        });
      }
    });

    ws.on('region-updated', (region) => {
      setSegments((prev) => {
        const next = prev.map((s) => (s.id === region.id ? { ...s, start: region.start, end: region.end } : s));
        onChange?.(next);
        return next;
      });
    });

    ws.on('region-removed', (region) => {
      setSegments((prev) => {
        const next = prev.filter((s) => s.id !== region.id);
        onChange?.(next);
        return next;
      });
    });

    return () => {
      clearInterval(interval);
      ws.destroy();
    };
  }, [audioUrl, readOnly]);

  const fmt = (t) => {
    const m = Math.floor(t / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const current = wavesurferRef.current?.getCurrentTime() || 0;
  const dur = wavesurferRef.current?.getDuration() || 0;

  const handleDelete = (id) => {
    const reg = wavesurferRef.current?.regions.list[id];
    reg?.remove();
  };

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => wavesurferRef.current?.playPause()}
          disabled={!isReady}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <span className="text-sm tabular-nums font-bold px-2 py-0.5 rounded" style={{ color: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.15)' }}>
          {fmt(current)} / {fmt(dur)}
        </span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={current}
          onChange={(e) => wavesurferRef.current?.seekTo(e.target.value / (dur || 1))}
          className="flex-1 h-1 accent-indigo-500"
        />
      </div>

      {/* waveform */}
      <div
        ref={waveformRef}
        className={`w-full rounded ${!isReady && 'animate-pulse h-24'}`}
        style={{ cursor: readOnly ? 'default' : 'crosshair', backgroundColor: '#1e293b' }}
      />

      {/* Label info bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {labelSet.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Labels:</span>
            <div className="flex gap-1 flex-wrap">
              {labelSet.map((l) => (
                <span
                  key={l.name}
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: getLabelColor(l.name, 0.3), color: getLabelColor(l.name, 1) }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {!readOnly && labelSet.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">Chọn:</span>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {labelSet.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">(Kéo waveform để tạo đoạn)</span>
          </div>
        )}
      </div>

      {/* list */}
      <div className="space-y-2 max-h-48 overflow-auto pr-1">
        {segments.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500">Chưa có đoạn nào. Kéo chuột trên waveform để tạo đoạn.</p>
          </div>
        )}
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getLabelColor(seg.label, 1) }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: getLabelColor(seg.label, 1) }}>
                {fmt(seg.start)} - {fmt(seg.end)}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: getLabelColor(seg.label, 0.25), color: getLabelColor(seg.label, 1) }}>
                {seg.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-indigo-400 hover:text-indigo-300 text-sm px-2 py-0.5 rounded hover:bg-indigo-900/30 transition-colors"
                onClick={() => wavesurferRef.current?.play(seg.start, seg.end)}
              >
                ▶ Nghe
              </button>
              {!readOnly && (
                <button
                  className="text-red-400 hover:text-red-300 text-sm px-2 py-0.5 rounded hover:bg-red-900/30 transition-colors"
                  onClick={() => handleDelete(seg.id)}
                >
                  ✕ Xóa
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AudioAnnotator;
