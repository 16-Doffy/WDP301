import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Chip, Divider, Stack, Typography, CircularProgress } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import axios from 'axios';
import ImageViewer from '../../components/ImageViewer';
import AudioAnnotator from '../../components/AudioAnnotator';
import { API_URL } from '../../config/api';

const getFullImageUrl = (dataItem) => {
  const baseUrl = API_URL.replace(/\/+$/, '');

  const directUrl = dataItem?.url || dataItem?.imageUrl || '';
  if (typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl)) return directUrl;

  const rawPath = (dataItem?.path || directUrl || '').replace(/\\/g, '/');
  const cleanPath = rawPath.replace(/^\/+/, '');

  if (cleanPath) {
    if (dataItem?.filename && cleanPath.endsWith(dataItem.filename)) {
      return `${baseUrl}/${cleanPath}`;
    }
    return dataItem?.filename ? `${baseUrl}/${cleanPath}/${dataItem.filename}` : `${baseUrl}/${cleanPath}`;
  }

  return dataItem?.filename ? `${baseUrl}/uploads/datasets/${dataItem.filename}` : '';
};

const normalizeLabelSet = (labelSet) => {
  if (!Array.isArray(labelSet)) return [];
  return labelSet.map((label) => {
    if (typeof label === 'string') return { name: label };
    if (label && typeof label === 'object') return { name: label.name || label.label || 'Unknown', color: label.color };
    return { name: 'Unknown' };
  });
};

const hasColorInfo = (labelSet) => Array.isArray(labelSet) && labelSet.some((l) => l && typeof l === 'object' && Boolean(l.color));

const pickBestLabelSet = (...candidates) => {
  const valid = candidates.filter((c) => Array.isArray(c) && c.length > 0);
  if (!valid.length) return [];
  return valid.find((c) => hasColorInfo(c)) || valid[0];
};

const isTextItem = (it) => {
  const mime = (it?.mimeType || it?.dataItem?.mimeType || '').toLowerCase();
  const fileName = (it?.filename || it?.dataItem?.filename || it?.path || it?.dataItem?.path || '').toLowerCase();
  return mime.startsWith('text/') || /\.(txt|csv|json|xml)$/i.test(fileName);
};

// Tạo màu ngẫu nhiên cho annotator
const annotatorColors = {};
const annotatorColorList = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const getAnnotatorColor = (annotatorName) => {
  if (!annotatorName) return annotatorColorList[0];
  if (!annotatorColors[annotatorName]) {
    const index = Object.keys(annotatorColors).length % annotatorColorList.length;
    annotatorColors[annotatorName] = annotatorColorList[index];
  }
  return annotatorColors[annotatorName];
};

const normalizeLabelName = (value = '') => value.toString().trim().toLowerCase();

const getLabelColor = (labelSet = [], label, fallback = '#3b82f6') => {
  if (!Array.isArray(labelSet) || !labelSet.length) return fallback;
  const target = normalizeLabelName(label);
  const found = labelSet.find((l) => normalizeLabelName(l?.name) === target);
  return found?.color || fallback;
};

const toRgba = (hexColor = '#3b82f6', alpha = 0.25) => {
  const hex = (hexColor || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(59,130,246,${alpha})`;
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const DatasetItemDetail = () => {
  const navigate = useNavigate();
  const audioPlayerRef = useRef(null);
  const location = useLocation();
  const { datasetId } = useParams();
  const itemId = useMemo(() => {
    const raw = (location.pathname.split(`/manager/datasets/${datasetId}/items/`)[1] || '').trim();
    return raw;
  }, [location.pathname, datasetId]);
  const state = location.state || {};

  const [resolvedItem, setResolvedItem] = useState(state.item || null);
  const [resolvedDatasetName, setResolvedDatasetName] = useState(state.datasetName || 'Dataset');
  const [resolvedLabelSet, setResolvedLabelSet] = useState(
    normalizeLabelSet(
      pickBestLabelSet(
        state.labelSet,
        state.item?.labelSet,
        state.item?.projectId?.labelSet,
        state.item?.datasetId?.projectId?.labelSet,
      )
    )
  );
  const [loading, setLoading] = useState(false);

  const item = resolvedItem;
  const datasetName = resolvedDatasetName;
  const labelSet = resolvedLabelSet;
  const imageUrl = useMemo(() => getFullImageUrl(item?.dataItem || item), [item]);

  useEffect(() => {
    if (!resolvedItem) return;
    if (!isTextItem(resolvedItem)) return;

    const hasText = Boolean(resolvedItem?.text || resolvedItem?.dataItem?.text);
    if (hasText) return;

    const fetchText = async () => {
      try {
        const textUrl = getFullImageUrl(resolvedItem?.dataItem || resolvedItem);
        if (!textUrl) return;
        const textResp = await axios.get(textUrl, { responseType: 'text' });
        const loadedText = typeof textResp.data === 'string' ? textResp.data : '';
        if (!loadedText) return;

        setResolvedItem((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            text: loadedText,
            dataItem: {
              ...(prev.dataItem || {}),
              text: loadedText,
            },
          };
        });
      } catch (e) {
        console.error('Error fetching text content for detail item:', e);
      }
    };

    fetchText();
  }, [resolvedItem]);

  const annotations = (item?.annotations || []);
  const primaryAnnotations = annotations.filter((a) => a.primaryForItem);
  const approvedAnnotations = annotations.filter((a) => a.status === 'approved');
  // Luôn ưu tiên hiển thị tất cả annotator đã approved (không chỉ primary)
  const displayAnnotations = approvedAnnotations.length > 0
    ? approvedAnnotations
    : annotations;
  const reviewerDisplayName = useMemo(() => {
    const looksLikeObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

    const directReviewer = item?.reviewerId;
    if (directReviewer?.fullName) return directReviewer.fullName;
    if (directReviewer?.username) return directReviewer.username;
    if (directReviewer?.name) return directReviewer.name;
    if (typeof directReviewer === 'string' && directReviewer.trim() && !looksLikeObjectId(directReviewer)) return directReviewer;

    const reviewedBy = item?.reviewedBy;
    if (reviewedBy?.fullName) return reviewedBy.fullName;
    if (reviewedBy?.username) return reviewedBy.username;
    if (typeof reviewedBy === 'string' && reviewedBy.trim() && !looksLikeObjectId(reviewedBy)) return reviewedBy;

    if (Array.isArray(item?.annotations) && item.annotations.length > 0) {
      const annWithReviewer = item.annotations.find((a) => a?.reviewerId?.fullName || a?.reviewerId?.username);
      if (annWithReviewer?.reviewerId?.fullName) return annWithReviewer.reviewerId.fullName;
      if (annWithReviewer?.reviewerId?.username) return annWithReviewer.reviewerId.username;
    }

    if (Array.isArray(item?.reviewers) && item.reviewers.length > 0) {
      const picked = item.reviewers.find((r) => r?.status === 'approved' || r?.status === 'rejected') || item.reviewers[0];
      const rid = picked?.reviewerId || picked?.reviewedBy;
      if (rid?.fullName) return rid.fullName;
      if (rid?.username) return rid.username;
      if (typeof rid === 'string' && rid.trim() && !looksLikeObjectId(rid)) return rid;
    }

    return 'Unknown';
  }, [item]);

  const normalizedAnnotations = displayAnnotations.map((ann, idx) => ({
    ...ann,
    id: (ann.annotatorId?._id || ann.annotatorId || ann.annotator || `annotator-${idx}`)?.toString?.(),
    name: ann.annotator || ann.annotatorId?.fullName || ann.annotatorId?.username || 'Unknown annotator',
    labels: ann.labels || {},
  }));

  const [visibleAnnotators, setVisibleAnnotators] = useState({});

  useEffect(() => {
    if (!normalizedAnnotations.length) return;
    setVisibleAnnotators((prev) => {
      const next = {};
      normalizedAnnotations.forEach((a) => {
        next[a.id] = prev[a.id] ?? true;
      });
      return next;
    });
  }, [normalizedAnnotations]);

  // Determine the actual data type
  const dataType = item?.type || 
    (item?.mimeType?.startsWith('image/') ? 'image' : 
     item?.mimeType?.startsWith('audio/') ? 'audio' : 
     item?.mimeType?.startsWith('text/') || item?.dataItem?.mimeType?.startsWith('text/') || item?.text || item?.dataItem?.text ? 'text' : 'image');

  const mergedObjects = useMemo(() => {
    if (!item) return [];

    // Handle text data type
    if (dataType === 'text') {
      return normalizedAnnotations.flatMap((ann, annIdx) => {
        const spans = ann?.labels?.spans || ann?.labels?.sentences || [];
        return spans.map((span, idx) => ({
          id: `span_${annIdx}_${idx}`,
          text: span.text || span.sentence || '',
          label: span.label || 'Unknown',
          start: span.start,
          end: span.end,
          sourceAnnotator: ann.name,
          sourceAnnotatorId: ann.id,
        }));
      });
    }

    // Handle audio data type
    if (dataType === 'audio') {
      return normalizedAnnotations.flatMap((ann, annIdx) => {
        const segments = ann?.labels?.segments || [];
        return segments.map((seg, idx) => ({
          id: `segment_${annIdx}_${idx}`,
          start: seg.start ?? seg.startTime ?? 0,
          end: seg.end ?? seg.endTime ?? 0,
          label: seg.label || 'unknown',
          note: seg.note || '',
          sourceAnnotator: ann.name,
          sourceAnnotatorId: ann.id,
        }));
      });
    }

    // Handle image data type - only use annotators currently represented in normalizedAnnotations
    // to avoid leaking non-approved labels.
    return normalizedAnnotations.flatMap((ann, annIdx) => {
      const annName = ann.name || 'Unknown';
      const annId = ann.id;
      const isPrimary = Boolean(ann.primaryForItem);
      const annColor = getAnnotatorColor(annName);
      return (ann.labels?.objects || []).map((obj, objIdx) => ({
        ...obj,
        id: `${annName}-${annIdx}-${objIdx}`,
        label: `${obj.label || 'Unknown'}`,
        originalLabel: obj.label,
        sourceAnnotator: annName,
        sourceAnnotatorId: annId,
        isPrimary,
        color: annColor,
      }));
    });
  }, [item, dataType, normalizedAnnotations]);

  const visibleMergedObjects = useMemo(() => {
    if (!mergedObjects.length) return [];
    // Strict filter: only explicit ON annotators are shown.
    return mergedObjects.filter((obj) => visibleAnnotators[obj.sourceAnnotatorId] === true);
  }, [mergedObjects, visibleAnnotators]);

  // Get unique labels based on data type (theo annotator đang bật)
  const uniqueLabels = useMemo(() => {
    if (!item) return [];

    if (dataType === 'text' || dataType === 'audio') {
      return Array.from(new Set(visibleMergedObjects.map((obj) => obj.label).filter(Boolean)));
    }

    // For image: get unique labels (just the label name without annotator)
    return Array.from(new Set(visibleMergedObjects.map((obj) => obj.originalLabel || obj.label).filter(Boolean)));
  }, [item, visibleMergedObjects, dataType]);

  // Base labels without annotator name
  const baseLabels = useMemo(() => {
    if (!item) return [];

    if (dataType === 'text' || dataType === 'audio') {
      return Array.from(new Set(visibleMergedObjects.map((obj) => obj.label?.split(' • ')[0]).filter(Boolean)));
    }

    // For image: just use original labels
    return Array.from(new Set(
      visibleMergedObjects.map((obj) => obj.originalLabel || obj.label).filter(Boolean)
    ));
  }, [item, visibleMergedObjects, dataType]);

  useEffect(() => {
    if (resolvedItem || !datasetId) return;
    const fetchItem = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const resp = await axios.get(`${API_URL}/api/datasets/${datasetId}/items`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        let items = resp.data?.items || [];
        const decodedId = itemId ? decodeURIComponent(itemId) : '';
        let found = items.find((it) => it.id?.toString?.() === decodedId || it.path === decodedId || it.imageUrl === decodedId);
        
        // If text content is missing, try to fetch it
        if (found && !found.text && (found.mimeType === 'text/plain' || found.filename?.endsWith('.txt'))) {
          try {
            const textUrl = getFullImageUrl(found);
            if (textUrl) {
              const textResp = await axios.get(textUrl, { responseType: 'text' });
              found = { ...found, text: textResp.data };
            }
          } catch (textErr) {
            console.error('Error fetching text content:', textErr);
          }
        }
        
        if (found) {
          setResolvedItem(found);
          setResolvedDatasetName(resp.data?.datasetName || resolvedDatasetName);

          const resolvedLabels = pickBestLabelSet(
            // ưu tiên nguồn có color trước
            found?.projectId?.labelSet,
            resp.data?.projectId?.labelSet,
            resp.data?.dataset?.projectId?.labelSet,
            found?.datasetId?.projectId?.labelSet,
            // sau đó mới fallback về labelSet item/dataset
            found?.labelSet,
            resp.data?.labelSet,
            resp.data?.dataset?.labelSet,
            resolvedLabelSet,
          );

          setResolvedLabelSet(normalizeLabelSet(resolvedLabels));
        }
      } catch (err) {
        console.error('Error fetching item detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [resolvedItem, datasetId, itemId, resolvedDatasetName, resolvedLabelSet]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: '#0f172a' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/manager/datasets')}
          sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}
        >
          Back to Datasets
        </Button>
        <Typography variant="h5" fontWeight={800} sx={{ color: '#e2e8f0' }}>
          {datasetName} • Item Detail
        </Typography>
      </Stack>

      {!item ? (
        <Box sx={{ p: 4, borderRadius: 3, bgcolor: '#1e293b', border: '1px solid #334155' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Typography sx={{ color: '#94a3b8' }}>
                Không có dữ liệu item để hiển thị. Vui lòng quay lại và chọn item từ tab Items.
              </Typography>
              <Typography sx={{ color: '#64748b', mt: 1 }}>
                Dataset ID: {datasetId}
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
          <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0' }}>
                {dataType === 'audio' ? 'Audio + Nhãn' : dataType === 'text' ? 'Text + Nhãn' : 'Ảnh gốc + Nhãn'}
              </Typography>
              {normalizedAnnotations.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
                  {normalizedAnnotations.map((ann) => {
                    const isPrimary = primaryAnnotations.some((a) => (a.annotator || a.annotatorId?.fullName || a.annotatorId?.username) === ann.name);
                    const annColor = getAnnotatorColor(ann.name);
                    const isVisible = visibleAnnotators[ann.id] === true;
                    return (
                      <Chip
                        key={ann.id}
                        label={`${isVisible ? 'ON' : 'OFF'} • ${isPrimary ? `★ ${ann.name}` : ann.name}`}
                        size="small"
                        onClick={() => setVisibleAnnotators((prev) => ({ ...prev, [ann.id]: !isVisible }))}
                        sx={{
                          bgcolor: isVisible ? `${annColor}30` : 'rgba(71,85,105,0.3)',
                          color: isVisible ? annColor : '#94a3b8',
                          fontWeight: 700,
                          border: isPrimary ? `2px solid ${annColor}` : `1px solid ${isVisible ? `${annColor}80` : '#64748b'}`,
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
            </Stack>

            <Box
              sx={{
                width: '100%',
                minHeight: 320,
                borderRadius: 2,
                bgcolor: '#0b1220',
                border: '1px solid #1f2937',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {dataType === 'audio' ? (
                imageUrl ? (
                  <Box sx={{ p: 2, width: '100%' }}>
                    <Typography sx={{ color: '#94a3b8', mb: 1.5, textAlign: 'center', fontWeight: 600 }}>Waveform + Segments</Typography>

                    <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 2 }}>
                      <AudioAnnotator
                        audioUrl={imageUrl}
                        labelSet={labelSet}
                        initialSegments={visibleMergedObjects.map((seg) => ({
                          id: seg.id,
                          start: Number(seg.start || 0),
                          end: Number(seg.end || 0),
                          label: seg.label,
                          color: getLabelColor(labelSet, seg.label, '#3b82f6'),
                          annotator: seg.sourceAnnotator,
                        }))}
                        readOnly
                      />
                      {(!imageUrl || !/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(imageUrl)) && (
                        <Typography sx={{ color: '#64748b', mt: 1, fontSize: '0.8rem' }}>
                          URL audio có thể chưa đúng định dạng. Link hiện tại: {imageUrl || 'N/A'}
                        </Typography>
                      )}
                    </Box>

                    <audio ref={audioPlayerRef} src={imageUrl} preload="metadata" style={{ display: 'none' }} />

                    <Typography sx={{ color: '#64748b', mt: 2, fontSize: '0.875rem', textAlign: 'center' }}>
                      {item?.dataItem?.filename || item?.filename || 'Unknown audio file'}
                    </Typography>

                    {visibleMergedObjects.length > 0 && (
                      <Box sx={{ mt: 3, textAlign: 'left' }}>
                        <Typography sx={{ color: '#94a3b8', mb: 1, fontWeight: 600 }}>Segments theo annotator:</Typography>
                        <Stack spacing={1}>
                          {visibleMergedObjects.map((seg) => {
                            const annColor = getAnnotatorColor(seg.sourceAnnotator);
                            const lblColor = getLabelColor(labelSet, seg.label, '#3b82f6');
                            return (
                              <Box key={seg.id} sx={{ p: 1.2, border: '1px solid #334155', borderRadius: 1, bgcolor: '#0f172a' }}>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="space-between">
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: lblColor }} />
                                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                                      [{Number(seg.start || 0).toFixed(1)}s - {Number(seg.end || 0).toFixed(1)}s] {seg.label}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={seg.sourceAnnotator}
                                      sx={{
                                        height: 22,
                                        bgcolor: `${annColor}30`,
                                        color: annColor,
                                        border: `1px solid ${annColor}80`,
                                        fontWeight: 700,
                                      }}
                                    />
                                  </Stack>

                                  <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderColor: `${lblColor}88`,
                                      color: lblColor,
                                      minWidth: 76,
                                      textTransform: 'none',
                                      fontWeight: 700,
                                    }}
                                    onClick={() => {
                                      const audioEl = audioPlayerRef.current;
                                      if (!audioEl) return;
                                      const start = Number(seg.start || 0);
                                      const end = Number(seg.end || 0);
                                      audioEl.currentTime = start;
                                      audioEl.play();
                                      const clear = () => {
                                        audioEl.removeEventListener('timeupdate', onTimeUpdate);
                                      };
                                      const onTimeUpdate = () => {
                                        if (audioEl.currentTime >= end) {
                                          audioEl.pause();
                                          clear();
                                        }
                                      };
                                      audioEl.addEventListener('timeupdate', onTimeUpdate);
                                    }}
                                  >
                                    ▶ Play đoạn
                                  </Button>
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography sx={{ color: '#94a3b8' }}>Không có audio để hiển thị.</Typography>
                )
              ) : dataType === 'text' ? (
                <Box sx={{ p: 3, width: '100%', maxHeight: '70vh', overflow: 'auto' }}>
                  <Typography sx={{ color: '#94a3b8', mb: 2, fontWeight: 600 }}>
                    Text Content:
                  </Typography>

                  {(() => {
                    const rawText = item?.dataItem?.text || item?.text || item?.content || item?.preview || '';
                    if (!rawText) {
                      return (
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}>
                          Không có dữ liệu để hiển thị.
                        </Box>
                      );
                    }

                    const spans = visibleMergedObjects
                      .filter((s) => Number.isFinite(Number(s.start)) && Number.isFinite(Number(s.end)))
                      .map((s) => {
                        const start = Math.max(0, Math.min(rawText.length, Number(s.start) || 0));
                        const end = Math.max(start, Math.min(rawText.length, Number(s.end) || 0));
                        return { ...s, start, end };
                      })
                      .filter((s) => s.end > s.start)
                      // dedupe span trùng hệt nhau giữa các annotator để tránh text bị render đè/lặp
                      .reduce((acc, cur) => {
                        const key = `${cur.start}-${cur.end}-${cur.label}`;
                        if (!acc.some((x) => `${x.start}-${x.end}-${x.label}` === key)) acc.push(cur);
                        return acc;
                      }, [])
                      .sort((a, b) => (a.start - b.start) || (b.end - a.end));

                    if (!spans.length) {
                      return (
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', color: '#e2e8f0' }}>
                          {rawText}
                        </Box>
                      );
                    }

                    const boundaries = new Set([0, rawText.length]);
                    spans.forEach((s) => {
                      boundaries.add(s.start);
                      boundaries.add(s.end);
                    });
                    const points = Array.from(boundaries).sort((a, b) => a - b);

                    const chunks = [];
                    for (let i = 0; i < points.length - 1; i += 1) {
                      const start = points[i];
                      const end = points[i + 1];
                      if (end <= start) continue;
                      const active = spans.filter((s) => s.start <= start && s.end >= end);
                      chunks.push({
                        key: `c-${i}-${start}-${end}`,
                        text: rawText.slice(start, end),
                        active,
                      });
                    }

                    return (
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.8 }}>
                        {chunks.map((chunk) => {
                          if (!chunk.active.length) return <span key={chunk.key}>{chunk.text}</span>;
                          const top = chunk.active[0];
                          const labelColor = getLabelColor(labelSet, top.label, '#3b82f6');
                          const annotatorColor = getAnnotatorColor(top.sourceAnnotator);
                          return (
                            <mark
                              key={chunk.key}
                              title={`${top.label} • ${top.sourceAnnotator}`}
                              style={{
                                backgroundColor: toRgba(labelColor, 0.25),
                                color: '#e2e8f0',
                                borderBottom: `1px solid ${labelColor}`,
                                padding: '0 2px',
                                borderRadius: '2px',
                              }}
                            >
                              {chunk.text}
                              <span
                                style={{
                                  marginLeft: 4,
                                  padding: '0 4px',
                                  borderRadius: 4,
                                  fontSize: '0.72em',
                                  fontWeight: 700,
                                  backgroundColor: toRgba(annotatorColor, 0.22),
                                  color: annotatorColor,
                                  border: `1px solid ${toRgba(annotatorColor, 0.5)}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                [{top.label} • {top.sourceAnnotator}]
                              </span>
                            </mark>
                          );
                        })}
                      </Box>
                    );
                  })()}
                </Box>
              ) : imageUrl ? (
                <ImageViewer
                  imageUrl={imageUrl}
                  annotations={visibleMergedObjects.map((obj) => ({
                      bbox: obj.bbox,
                      label: obj.isPrimary ? `${obj.label} • PRIMARY` : obj.label,
                    }))}
                  labelSet={labelSet}
                  readOnly
                  maxHeight="70vh"
                />
              ) : (
                <Typography sx={{ color: '#94a3b8' }}>Không có dữ liệu để hiển thị.</Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: '#1e293b', border: '1px solid #334155', height: 'fit-content' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#e2e8f0', mb: 2 }}>
              Thông tin nhãn
            </Typography>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>File</Typography>
                <Typography sx={{ color: '#e2e8f0' }}>{item?.dataItem?.filename || item?.filename || 'N/A'}</Typography>
              </Box>
              <Divider sx={{ borderColor: '#334155' }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Số object</Typography>
                <Typography sx={{ color: '#e2e8f0' }}>{mergedObjects.length}</Typography>
              </Box>
              <Divider sx={{ borderColor: '#334155' }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Danh sách nhãn</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {uniqueLabels.length === 0 ? (
                    <Typography sx={{ color: '#94a3b8' }}>Không có nhãn.</Typography>
                  ) : (
                    uniqueLabels.map((label, idx) => {
                      const c = getLabelColor(labelSet, label, '#3b82f6');
                      return (
                        <Chip
                          key={`${label}-${idx}`}
                          label={label}
                          size="small"
                          sx={{ bgcolor: toRgba(c, 0.2), color: c, border: `1px solid ${toRgba(c, 0.45)}`, fontWeight: 700 }}
                        />
                      );
                    })
                  )}
                </Stack>
              </Box>
              <Divider sx={{ borderColor: '#334155' }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Nhãn gốc</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {baseLabels.length === 0 ? (
                    <Typography sx={{ color: '#94a3b8' }}>Không có nhãn.</Typography>
                  ) : (
                    baseLabels.map((label, idx) => {
                      const c = getLabelColor(labelSet, label, '#22c55e');
                      return (
                        <Chip
                          key={`base-${label}-${idx}`}
                          label={label}
                          size="small"
                          sx={{ bgcolor: toRgba(c, 0.2), color: c, border: `1px solid ${toRgba(c, 0.45)}`, fontWeight: 700 }}
                        />
                      );
                    })
                  )}
                </Stack>
              </Box>
              
              {/* Review Results Section */}
              {item?.status === 'approved' || item?.status === 'rejected' ? (
                <>
                  <Divider sx={{ borderColor: '#334155', my: 2 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>
                      Kết quả Review
                    </Typography>
                    <Chip
                      label={item.status === 'approved' ? '✓ Đã phê duyệt' : '✕ Đã từ chối'}
                      size="small"
                      sx={{
                        bgcolor: item.status === 'approved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: item.status === 'approved' ? '#22c55e' : '#ef4444',
                        fontWeight: 700,
                        mb: 2
                      }}
                    />
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reviewer:</Typography>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
                        {reviewerDisplayName}
                      </Typography>
                    </Box>
                    
                    {item.reviewedAt && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Ngày review:</Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
                          {new Date(item.reviewedAt).toLocaleString('vi-VN')}
                        </Typography>
                      </Box>
                    )}
                    

                  </Box>
                </>
              ) : item?.status === 'submitted' ? (
                <>
                  <Divider sx={{ borderColor: '#334155', my: 2 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>
                      Trạng thái
                    </Typography>
                    <Chip
                      label="Chờ review"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(251,191,36,0.2)',
                        color: '#fbbf24',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                </>
              ) : null}
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DatasetItemDetail;
