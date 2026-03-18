import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Chip, Divider, Stack, Typography, Switch, FormControlLabel, CircularProgress } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import axios from 'axios';
import ImageViewer from '../../components/ImageViewer';
import { API_URL } from '../../config/api';

const getFullImageUrl = (dataItem) => {
  const baseUrl = API_URL.replace(/\/+$/, '');
  const rawPath = dataItem?.path || '';
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

const DatasetItemDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { datasetId } = useParams();
  const itemId = useMemo(() => {
    const raw = (location.pathname.split(`/manager/datasets/${datasetId}/items/`)[1] || '').trim();
    return raw;
  }, [location.pathname, datasetId]);
  const state = location.state || {};

  const [resolvedItem, setResolvedItem] = useState(state.item || null);
  const [resolvedDatasetName, setResolvedDatasetName] = useState(state.datasetName || 'Dataset');
  const [resolvedLabelSet, setResolvedLabelSet] = useState(normalizeLabelSet(state.labelSet || []));
  const [loading, setLoading] = useState(false);

  const item = resolvedItem;
  const datasetName = resolvedDatasetName;
  const labelSet = resolvedLabelSet;
  const imageUrl = useMemo(() => getFullImageUrl(item?.dataItem || item), [item]);

  const annotations = (item?.annotations || []);
  const primaryAnnotations = annotations.filter(a => a.primaryForItem);
  const approvedAnnotations = annotations.filter(a => a.status === 'approved');
  // For display: use primary if exists, otherwise use approved, otherwise use first one
  const displayAnnotations = primaryAnnotations.length > 0 
    ? primaryAnnotations 
    : approvedAnnotations.length > 0 
      ? approvedAnnotations 
      : (annotations.length > 0 ? [annotations[0]] : []);
  const annotatorNames = annotations.map(a => a.annotator).filter(Boolean);
  const uniqueAnnotatorNames = Array.from(new Set(annotatorNames));

  const normalizedAnnotations = displayAnnotations.map((ann, idx) => ({
    ...ann,
    id: ann.annotatorId || ann.annotator || `annotator-${idx}`,
    name: ann.annotator || 'Unknown annotator',
    labels: ann.labels || {},
  }));

  const [visibleAnnotators, setVisibleAnnotators] = useState(() => {
    const initial = {};
    normalizedAnnotations.forEach(a => {
      initial[a.id] = true;
    });
    return initial;
  });

  // Determine the actual data type
  const dataType = item?.type || 
    (item?.mimeType?.startsWith('image/') ? 'image' : 
     item?.mimeType?.startsWith('audio/') ? 'audio' : 
     item?.mimeType?.startsWith('text/') || item?.dataItem?.mimeType?.startsWith('text/') || item?.text || item?.dataItem?.text ? 'text' : 'image');

  const mergedObjects = useMemo(() => {
    if (!item) return [];
    
    // Handle text data type
    if (dataType === 'text') {
      const spans = displayAnnotations[0]?.labels?.spans || displayAnnotations[0]?.labels?.sentences || [];
      return spans.map((span, idx) => ({
        id: `span_${idx}`,
        text: span.text || span.sentence || '',
        label: span.label || 'Unknown',
        start: span.start,
        end: span.end,
        sourceAnnotator: displayAnnotations[0]?.annotator || 'Unknown',
      }));
    }
    
    // Handle audio data type
    if (dataType === 'audio') {
      const segments = displayAnnotations[0]?.labels?.segments || [];
      return segments.map((seg, idx) => ({
        id: `segment_${idx}`,
        start: seg.start ?? seg.startTime ?? 0,
        end: seg.end ?? seg.endTime ?? 0,
        label: seg.label || 'unknown',
        note: seg.note || '',
        sourceAnnotator: displayAnnotations[0]?.annotator || 'Unknown',
      }));
    }
    
    // Handle image data type - show all annotations for comparison
    const allAnnotations = annotations.length > 0 ? annotations : displayAnnotations;
    return allAnnotations.flatMap(ann => {
      const isPrimary = ann.primaryForItem;
      const annColor = getAnnotatorColor(ann.annotator);
      return (ann.labels?.objects || []).map((obj, objIdx) => ({
        ...obj,
        id: `${ann.annotator}-${objIdx}`,
        label: `${obj.label || 'Unknown'}`,
        originalLabel: obj.label,
        sourceAnnotator: ann.annotator,
        isPrimary: isPrimary,
        color: annColor,
      }));
    });
  }, [item, annotations, displayAnnotations, dataType]);

  // Get unique labels based on data type
  const uniqueLabels = useMemo(() => {
    if (!item) return [];
    
    if (dataType === 'text' || dataType === 'audio') {
      return Array.from(new Set(mergedObjects.map(obj => obj.label).filter(Boolean)));
    }
    
    // For image: get unique labels (just the label name without annotator)
    return Array.from(new Set(mergedObjects.map(obj => obj.originalLabel || obj.label).filter(Boolean)));
  }, [item, mergedObjects, dataType]);

  // Base labels without annotator name
  const baseLabels = useMemo(() => {
    if (!item) return [];
    
    if (dataType === 'text' || dataType === 'audio') {
      return Array.from(new Set(mergedObjects.map(obj => obj.label?.split(' • ')[0]).filter(Boolean)));
    }
    
    // For image: just use original labels
    return Array.from(new Set(
      mergedObjects.map(obj => obj.originalLabel || obj.label).filter(Boolean)
    ));
  }, [item, mergedObjects, dataType]);

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
          setResolvedLabelSet(normalizeLabelSet(found.labelSet || resolvedLabelSet));
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
              {uniqueAnnotatorNames.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
                  {uniqueAnnotatorNames.map((name) => {
                    const isPrimary = primaryAnnotations.some((ann) => ann.annotator === name || ann.name === name);
                    const annColor = getAnnotatorColor(name);
                    // Hiển thị tất cả annotator với màu riêng và icon sao cho primary
                    return (
                      <Chip
                        key={name}
                        label={isPrimary ? `★ ${name}` : name}
                        size="small"
                        sx={{
                          bgcolor: `${annColor}30`,
                          color: annColor,
                          fontWeight: 700,
                          border: isPrimary ? `2px solid ${annColor}` : `1px solid ${annColor}80`,
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
              {imageUrl ? (
                dataType === 'audio' ? (
                  <Box sx={{ textAlign: 'center', p: 4 }}>
                    <Typography sx={{ color: '#94a3b8', mb: 2 }}>Audio File</Typography>
                    <audio controls src={imageUrl} style={{ maxWidth: '100%' }}>
                      Your browser does not support the audio element.
                    </audio>
                    <Typography sx={{ color: '#64748b', mt: 2, fontSize: '0.875rem' }}>
                      {item?.dataItem?.filename || item?.filename || 'Unknown audio file'}
                    </Typography>
                  </Box>
                ) : dataType === 'text' ? (
                  <Box sx={{ p: 3, width: '100%', maxHeight: '70vh', overflow: 'auto' }}>
                    <Typography sx={{ color: '#94a3b8', mb: 2, fontWeight: 600 }}>
                      Text Content:
                    </Typography>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: '#0f172a', 
                      border: '1px solid #334155',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: '#e2e8f0'
                    }}>
                      {item?.dataItem?.text || item?.text || 'No text content available'}
                    </Box>
                  </Box>
                ) : (
                  <ImageViewer
                    imageUrl={imageUrl}
                    annotations={mergedObjects.map((obj) => ({
                      bbox: obj.bbox,
                      label: obj.isPrimary ? `${obj.label} • PRIMARY` : obj.label,
                    }))}
                    labelSet={labelSet}
                    readOnly
                    maxHeight="70vh"
                  />
                )
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
                    uniqueLabels.map((label, idx) => (
                      <Chip
                        key={`${label}-${idx}`}
                        label={label}
                        size="small"
                        sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 600 }}
                      />
                    ))
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
                    baseLabels.map((label, idx) => (
                      <Chip
                        key={`base-${label}-${idx}`}
                        label={label}
                        size="small"
                        sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: '#22c55e', fontWeight: 600 }}
                      />
                    ))
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
                    
                    {item.reviewerId && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reviewer:</Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
                          {item.reviewerId?.fullName || item.reviewerId?.username || 'Unknown'}
                        </Typography>
                      </Box>
                    )}
                    
                    {item.reviewedAt && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Ngày review:</Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
                          {new Date(item.reviewedAt).toLocaleString('vi-VN')}
                        </Typography>
                      </Box>
                    )}
                    
                    {item.reviewComments && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Nhận xét:</Typography>
                        <Box sx={{ 
                          p: 1.5, 
                          borderRadius: 1, 
                          bgcolor: '#0f172a', 
                          border: '1px solid #334155',
                          mt: 0.5
                        }}>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem', fontStyle: 'italic' }}>
                            "{item.reviewComments}"
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    
                    {item.errorCategory && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Loại lỗi:</Typography>
                        <Typography sx={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600 }}>
                          {item.errorCategory === 'incorrect_label' && 'Sai nhãn'}
                          {item.errorCategory === 'missing_label' && 'Thiếu nhãn'}
                          {item.errorCategory === 'poor_quality' && 'Chất lượng kém'}
                          {item.errorCategory === 'does_not_follow_guidelines' && 'Không đúng hướng dẫn'}
                          {item.errorCategory === 'other' && 'Khác'}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Detailed Issues */}
                    {item.reviewIssues && item.reviewIssues.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>
                          Chi tiết các lỗi:
                        </Typography>
                        <Stack spacing={1}>
                          {item.reviewIssues.map((issue, idx) => (
                            <Box 
                              key={idx}
                              sx={{ 
                                p: 1.5, 
                                borderRadius: 1, 
                                bgcolor: 'rgba(239,68,68,0.1)', 
                                border: '1px solid rgba(239,68,68,0.3)'
                              }}
                            >
                              <Typography sx={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
                                {idx + 1}. {issue.type}
                              </Typography>
                              {issue.targetDetails && (
                                <Typography sx={{ color: '#fb923c', fontSize: '0.75rem', mt: 0.5 }}>
                                  Target: {issue.targetDetails.label} (Index: {issue.targetDetails.index})
                                </Typography>
                              )}
                              {issue.comment && (
                                <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.5, fontStyle: 'italic' }}>
                                  "{issue.comment}"
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
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
