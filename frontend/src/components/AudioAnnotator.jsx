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
          className="px-3 py-1.5 bg-indigo-500 text-white rounded disabled:opacity-50"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <span className="text-sm tabular-nums">
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
        className={`w-full bg-gray-100 rounded ${!isReady && 'animate-pulse h-24'}`}
        style={{ cursor: readOnly ? 'default' : 'crosshair' }}
      />

      {!readOnly && labelSet.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm">Nhãn đang chọn:</span>
          <select value={selectedLabel} onChange={(e) => setSelectedLabel(e.target.value)} className="border rounded px-3 py-1 text-sm">
            {labelSet.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">(Kéo chuột trên waveform để tạo đoạn)</span>
        </div>
      )}

      {/* list */}
      <div className="space-y-2 max-h-48 overflow-auto pr-1">
        {segments.length === 0 && <p className="text-sm text-gray-400">Chưa có đoạn nào.</p>}
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center justify-between p-2 bg-gray-50 border rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: getLabelColor(seg.label, 1) }} />
              <span className="text-sm font-medium tabular-nums">
                {fmt(seg.start)}-{fmt(seg.end)}
              </span>
              <span className="text-sm text-gray-600">{seg.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="text-indigo-600 hover:text-indigo-800 text-sm"
                onClick={() => wavesurferRef.current?.play(seg.start, seg.end)}
              >
                ▶
              </button>
              {!readOnly && (
                <button className="text-red-500 hover:text-red-700 text-sm" onClick={() => handleDelete(seg.id)}>
                  ×
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
