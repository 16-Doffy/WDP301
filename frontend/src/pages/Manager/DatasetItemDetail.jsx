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

  const annotations = (item?.annotations || []).filter(a => a.status === 'approved');
  const primaryAnnotations = annotations.filter(a => a.primaryForItem);
  const annotatorNames = annotations.map(a => a.annotator).filter(Boolean);
  const uniqueAnnotatorNames = Array.from(new Set(annotatorNames));

  const normalizedAnnotations = annotations.map((ann, idx) => ({
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

  const mergedObjects = normalizedAnnotations.flatMap(ann => {
    if (!visibleAnnotators[ann.id]) return [];
    return (ann.labels?.objects || []).map(obj => ({
      ...obj,
      label: obj.label || 'Unknown',
      sourceAnnotator: ann.name,
      isPrimary: primaryAnnotations.some((p) => p.id === ann.id || p.annotator === ann.name),
    }));
  });

  const mergedLabels = mergedObjects.map(obj => obj.label).filter(Boolean);
  const uniqueLabels = Array.from(new Set(mergedLabels));

  useEffect(() => {
    if (resolvedItem || !datasetId) return;
    const fetchItem = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const resp = await axios.get(`${API_URL}/api/datasets/${datasetId}/items`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const items = resp.data?.items || [];
        const decodedId = itemId ? decodeURIComponent(itemId) : '';
        const found = items.find((it) => it.id?.toString?.() === decodedId || it.path === decodedId || it.imageUrl === decodedId);
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
                Không có dữ liệu item để hiển thị. Vui lòng quay lại và chọn ảnh từ tab Items.
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
                Ảnh gốc + nhãn
              </Typography>
              {uniqueAnnotatorNames.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {uniqueAnnotatorNames.map((name) => {
                    const isPrimary = primaryAnnotations.some((ann) => ann.annotator === name || ann.name === name);
                    return (
                      <Chip
                        key={name}
                        label={isPrimary ? `${name} • PRIMARY` : name}
                        size="small"
                        sx={{
                          bgcolor: isPrimary ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.2)',
                          color: isPrimary ? '#fbbf24' : '#60a5fa',
                          fontWeight: 700,
                          border: isPrimary ? '1px solid rgba(245,158,11,0.6)' : '1px solid transparent',
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
            </Stack>

            {normalizedAnnotations.length > 0 && (
              <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {normalizedAnnotations.map((ann) => {
                  const isPrimary = primaryAnnotations.some((p) => p.id === ann.id || p.annotator === ann.name);
                  return (
                    <FormControlLabel
                      key={ann.id}
                      control={
                        <Switch
                          checked={Boolean(visibleAnnotators[ann.id])}
                          onChange={(e) => {
                            setVisibleAnnotators((prev) => ({
                              ...prev,
                              [ann.id]: e.target.checked,
                            }));
                          }}
                          color="primary"
                        />
                      }
                      label={isPrimary ? `Hiển thị nhãn: ${ann.name} (PRIMARY)` : `Hiển thị nhãn: ${ann.name}`}
                      sx={{ color: isPrimary ? '#fbbf24' : '#cbd5e1', fontWeight: isPrimary ? 700 : 500 }}
                    />
                  );
                })}
              </Stack>
            )}

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
              ) : (
                <Typography sx={{ color: '#94a3b8' }}>Không có ảnh để hiển thị.</Typography>
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
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DatasetItemDetail;
