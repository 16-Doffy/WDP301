import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  InputAdornment,
  Avatar,
  Badge,
  Tooltip,
  LinearProgress,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Folder as FolderIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  AudioFile as AudioIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as PendingIcon,
  RateReview as InReviewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  Error as ErrorIcon,
  Comment as CommentIcon,
  HowToVote as VoteIcon,
  Label as LabelIcon,
  Person as PersonIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

// ─────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:        { label: 'Chưa xử lý',   color: '#94a3b8', bg: '#94a3b820',   icon: <PendingIcon fontSize="small" /> },
  in_review:      { label: 'Đang review',  color: '#f59e0b', bg: '#f59e0b20',   icon: <InReviewIcon fontSize="small" /> },
  approved:       { label: 'Đã duyệt',     color: '#22c55e', bg: '#22c55e20',   icon: <CheckCircleIcon fontSize="small" /> },
  rejected:       { label: 'Từ chối',       color: '#ef4444', bg: '#ef444420',   icon: <CancelIcon fontSize="small" /> },
};

// Error categories
const ERROR_CATEGORIES = {
  wrong_label:       { label: 'Sai nhãn',          color: '#ef4444' },
  missing_object:     { label: 'Thiếu object',      color: '#f97316' },
  extra_object:       { label: 'Thừa object',       color: '#eab308' },
  inaccurate_bbox:    { label: 'Bounding box sai',  color: '#06b6d4' },
  ambiguous_text:     { label: 'Văn bản mơ hồ',     color: '#8b5cf6' },
  other:             { label: 'Lỗi khác',           color: '#6b7280' },
};

const AdminDatasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItems, setDetailItems] = useState([]);
  const [detailItemsLoading, setDetailItemsLoading] = useState(false);

  // Item-level detail modal
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [stats, setStats] = useState({ total: 0, image: 0, text: 0, audio: 0 });

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/datasets`);
      const data = response.data || [];
      setDatasets(data);
      setStats({
        total: data.length,
        image: data.filter(d => d.type === 'image').length,
        text: data.filter(d => d.type === 'text').length,
        audio: data.filter(d => d.type === 'audio').length,
      });
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDatasets(); }, []);

  const filteredDatasets = useMemo(() => {
    let filtered = datasets;
    if (tabValue === 1) filtered = filtered.filter(d => d.type === 'image');
    else if (tabValue === 2) filtered = filtered.filter(d => d.type === 'text');
    else if (tabValue === 3) filtered = filtered.filter(d => d.type === 'audio');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.name?.toLowerCase().includes(term) ||
        d.projectId?.name?.toLowerCase().includes(term) ||
        d.managerName?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [datasets, tabValue, searchTerm]);

  const getDatasetIcon = (type) => {
    switch (type) {
      case 'text':  return <TextIcon />;
      case 'audio': return <AudioIcon />;
      default:     return <ImageIcon />;
    }
  };

  const getDatasetColor = (type) => {
    switch (type) {
      case 'text':  return '#3b82f6';
      case 'audio': return '#8b5cf6';
      default:     return '#22c55e';
    }
  };

  const handleOpenDetail = async (dataset) => {
    setSelectedDataset(dataset);
    setDetailOpen(true);
    setDetailItemsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/datasets/${dataset._id}/items`);
      setDetailItems(response.data?.items || []);
    } catch (error) {
      console.error('Error fetching dataset items:', error);
      setDetailItems([]);
    } finally {
      setDetailItemsLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDataset(null);
    setDetailItems([]);
    setExpandedAnnotations({});
  };

  const handleOpenItemDetail = (item) => {
    setSelectedItem(item);
    setItemDetailOpen(true);
  };

  const handleCloseItemDetail = () => {
    setItemDetailOpen(false);
    setSelectedItem(null);
  };

  // Expandable annotations in item detail
  const [expandedAnnotations, setExpandedAnnotations] = useState({});
  const toggleAnnotation = (idx) => {
    setExpandedAnnotations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Filter items by status in detail modal
  const [itemStatusFilter, setItemStatusFilter] = useState('all');

  const filteredDetailItems = useMemo(() => {
    if (itemStatusFilter === 'all') return detailItems;
    return detailItems.filter(item => item.status === itemStatusFilter);
  }, [detailItems, itemStatusFilter]);

  // Item count by status
  const itemStatusCounts = useMemo(() => ({
    all:       detailItems.length,
    pending:   detailItems.filter(i => i.status === 'pending').length,
    in_review: detailItems.filter(i => i.status === 'in_review').length,
    approved:  detailItems.filter(i => i.status === 'approved').length,
    rejected:  detailItems.filter(i => i.status === 'rejected').length,
  }), [detailItems]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 1 }}>
          Admin Datasets
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
          Quản lý và giám sát toàn bộ datasets của tất cả managers trong hệ thống
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#3b82f620', color: '#3b82f6' }}>
                  <FolderIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.total}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Tổng Datasets</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#22c55e20', color: '#22c55e' }}>
                  <ImageIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.image}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Image</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#3b82f620', color: '#3b82f6' }}>
                  <TextIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.text}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Text</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#8b5cf620', color: '#8b5cf6' }}>
                  <AudioIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: '#e2e8f0' }}>{stats.audio}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Audio</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search & Refresh */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Tìm kiếm dataset..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 300, '& .MuiOutlinedInput-root': { bgcolor: '#1e293b' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
          }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDatasets}
          sx={{ borderColor: '#334155', color: '#94a3b8' }}>
          Refresh
        </Button>
      </Box>

      {/* Type Tabs */}
      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3,
        '& .MuiTab-root': { color: '#94a3b8' },
        '& .Mui-selected': { color: '#3b82f6' },
        '& .MuiTabs-indicator': { bgcolor: '#3b82f6' } }}>
        <Tab label={`Tất cả (${datasets.length})`} />
        <Tab label={`Image (${stats.image})`} />
        <Tab label={`Text (${stats.text})`} />
        <Tab label={`Audio (${stats.audio})`} />
      </Tabs>

      {/* Datasets Table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Dataset</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Loại</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Project</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Manager</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Ngày tạo</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDatasets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#64748b' }}>
                  Không tìm thấy dataset nào
                </TableCell>
              </TableRow>
            ) : (
              filteredDatasets.map((dataset) => (
                <TableRow key={dataset._id} sx={{ '&:hover': { bgcolor: '#33415520' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: `${getDatasetColor(dataset.type)}20`, color: getDatasetColor(dataset.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getDatasetIcon(dataset.type)}
                      </Box>
                      <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>{dataset.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={dataset.type} size="small"
                      sx={{ bgcolor: `${getDatasetColor(dataset.type)}20`, color: getDatasetColor(dataset.type), fontWeight: 600, textTransform: 'capitalize' }} />
                  </TableCell>
                  <TableCell><Typography sx={{ color: '#e2e8f0' }}>{dataset.projectId?.name || '—'}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#94a3b8' }}>{dataset.managerName || 'Unknown'}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#e2e8f0' }}>{dataset.fileCount || dataset.files?.length || 0}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    {dataset.createdAt ? new Date(dataset.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </Typography></TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleOpenDetail(dataset)}
                      sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
                      Chi tiết
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ───────────────────────────────────────── */}
      {/* Detail Modal - Dataset Items */}
      {/* ───────────────────────────────────────── */}
      <Dialog
        open={detailOpen}
        onClose={handleCloseDetail}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e293b',
            border: '1px solid #334155',
            minHeight: '80vh',
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #334155', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.2, borderRadius: 1.5,
              bgcolor: selectedDataset ? `${getDatasetColor(selectedDataset.type)}20` : '#334155',
              color: selectedDataset ? getDatasetColor(selectedDataset.type) : '#94a3b8',
              display: 'flex'
            }}>
              {selectedDataset && getDatasetIcon(selectedDataset.type)}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                {selectedDataset?.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {selectedDataset?.projectId?.name || 'Không thuộc project'} · {selectedDataset?.managerName}
                {selectedDataset?.type && ` · ${selectedDataset.type.toUpperCase()}`}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {detailItemsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : detailItems.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ color: '#64748b' }}>
                Dataset này chưa có item nào hoặc chưa có task nào được tạo
              </Typography>
            </Box>
          ) : (
            <>
              {/* Status Filter Tabs */}
              <Box sx={{ px: 3, pt: 2, borderBottom: '1px solid #334155', bgcolor: '#0f172a' }}>
                <Tabs
                  value={itemStatusFilter}
                  onChange={(e, v) => setItemStatusFilter(v)}
                  sx={{
                    minHeight: 40,
                    '& .MuiTab-root': { color: '#64748b', minHeight: 40, fontSize: '0.8rem', textTransform: 'none', fontWeight: 600 },
                    '& .Mui-selected': { color: '#fff' },
                    '& .MuiTabs-indicator': { height: 2 },
                  }}
                >
                  <Tab value="all" label={`Tất cả (${itemStatusCounts.all})`} />
                  <Tab value="pending"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PendingIcon sx={{ fontSize: 14 }} />
                        Chưa xử lý ({itemStatusCounts.pending})
                      </Box>
                    }
                  />
                  <Tab value="in_review"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InReviewIcon sx={{ fontSize: 14 }} />
                        Đang review ({itemStatusCounts.in_review})
                      </Box>
                    }
                  />
                  <Tab value="approved"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleIcon sx={{ fontSize: 14 }} />
                        Đã duyệt ({itemStatusCounts.approved})
                      </Box>
                    }
                  />
                  <Tab value="rejected"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CancelIcon sx={{ fontSize: 14 }} />
                        Từ chối ({itemStatusCounts.rejected})
                      </Box>
                    }
                  />
                </Tabs>
              </Box>

              {/* Items Grid */}
              <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
                <Typography sx={{ color: '#64748b', mb: 2, fontSize: '0.8rem' }}>
                  Hiển thị {filteredDetailItems.length} / {detailItems.length} items
                </Typography>

                {filteredDetailItems.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: '#475569' }}>Không có item nào ở trạng thái này</Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {filteredDetailItems.map((item) => {
                      const sCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      return (
                        <Grid item xs={12} sm={6} md={4} key={item.id || item.filename || Math.random()}>
                          <Box
                            onClick={() => handleOpenItemDetail(item)}
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: '#0f172a',
                              border: `2px solid ${item.status === 'approved' ? '#22c55e' : item.status === 'rejected' ? '#ef4444' : '#334155'}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: '#3b82f6',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 20px rgba(59,130,246,0.15)',
                              },
                            }}
                          >
                            {/* Filename */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                              <Typography
                                sx={{
                                  color: '#e2e8f0',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  mr: 1,
                                }}
                                title={item.originalName || item.filename}
                              >
                                {item.originalName || item.filename || 'Unknown'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {item.status === 'approved' && <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />}
                                {item.status === 'rejected' && <CancelIcon sx={{ color: '#ef4444', fontSize: 18 }} />}
                              </Box>
                            </Box>

                            {/* Status Badge */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                              <Chip
                                icon={sCfg.icon}
                                label={sCfg.label}
                                size="small"
                                sx={{
                                  bgcolor: sCfg.bg,
                                  color: sCfg.color,
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  height: 24,
                                  '& .MuiChip-icon': { color: sCfg.color },
                                }}
                              />
                              {/* Vote count */}
                              {item.totalVotes > 0 && (
                                <Tooltip title={`${item.approvedCount} duyệt / ${item.rejectedCount} từ chối / ${item.totalVotes} tổng`}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#94a3b8', fontSize: '0.75rem' }}>
                                    <VoteIcon sx={{ fontSize: 14 }} />
                                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                      {item.approvedCount}/{item.rejectedCount}/{item.totalVotes}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>

                            {/* Vote Progress Bar */}
                            {item.totalVotes > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={item.totalVotes > 0 ? (item.approvedCount / item.totalVotes) * 100 : 0}
                                  sx={{
                                    height: 4,
                                    borderRadius: 2,
                                    bgcolor: '#334155',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: item.approvedCount > item.rejectedCount ? '#22c55e' : item.rejectedCount > item.approvedCount ? '#ef4444' : '#f59e0b',
                                      borderRadius: 2,
                                    },
                                  }}
                                />
                              </Box>
                            )}

                            {/* Label */}
                            <Box sx={{ mb: 1 }}>
                              <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.3, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LabelIcon sx={{ fontSize: 12 }} /> Nhãn gán
                              </Typography>
                              <Typography sx={{
                                color: item.displayLabel && item.displayLabel !== 'Chưa có nhãn' ? '#93c5fd' : '#475569',
                                fontSize: '0.8rem',
                                fontWeight: item.displayLabel && item.displayLabel !== 'Chưa có nhãn' ? 600 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {item.displayLabel || 'Chưa có nhãn'}
                              </Typography>
                            </Box>

                            {/* Annotators */}
                            {item.annotations && item.annotations.length > 0 && (
                              <Box>
                                <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PersonIcon sx={{ fontSize: 12 }} /> Người gán nhãn ({item.annotations.length})
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {item.annotations.slice(0, 3).map((ann, idx) => {
                                    const annStatus = ann.status;
                                    const dotColor = annStatus === 'approved' ? '#22c55e' : annStatus === 'rejected' ? '#ef4444' : '#f59e0b';
                                    return (
                                      <Chip
                                        key={idx}
                                        label={ann.annotator}
                                        size="small"
                                        sx={{
                                          fontSize: '0.68rem',
                                          height: 20,
                                          bgcolor: '#1e293b',
                                          border: `1px solid ${dotColor}40`,
                                          color: '#94a3b8',
                                          '& .MuiChip-label': { px: 1 },
                                        }}
                                        icon={
                                          <Box sx={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            bgcolor: dotColor, ml: 0.5,
                                          }} />
                                        }
                                      />
                                    );
                                  })}
                                  {item.annotations.length > 3 && (
                                    <Chip
                                      label={`+${item.annotations.length - 3}`}
                                      size="small"
                                      sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#334155', color: '#94a3b8' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            )}

                            {/* Error info for rejected */}
                            {item.status === 'rejected' && item.reviewIssues && item.reviewIssues.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {item.reviewIssues.slice(0, 2).map((issue, idx) => {
                                  const eCfg = ERROR_CATEGORIES[issue] || ERROR_CATEGORIES.other;
                                  return (
                                    <Chip
                                      key={idx}
                                      label={eCfg.label}
                                      size="small"
                                      sx={{ fontSize: '0.68rem', height: 20, bgcolor: `${eCfg.color}20`, color: eCfg.color }}
                                      icon={<ErrorIcon sx={{ fontSize: 11, color: eCfg.color }} />}
                                    />
                                  );
                                })}
                                {item.reviewIssues.length > 2 && (
                                  <Chip label={`+${item.reviewIssues.length - 2}`} size="small"
                                    sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#334155', color: '#94a3b8' }} />
                                )}
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
          <Button onClick={handleCloseDetail} sx={{ color: '#94a3b8' }}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* ───────────────────────────────────────── */}
      {/* Item Detail Modal - Full annotation info */}
      {/* ───────────────────────────────────────── */}
      <Dialog
        open={itemDetailOpen}
        onClose={handleCloseItemDetail}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#1e293b', border: '1px solid #334155', maxHeight: '90vh' }
        }}
      >
        {selectedItem && (
          <>
            <DialogTitle sx={{ borderBottom: '1px solid #334155', pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  p: 1, borderRadius: 1,
                  bgcolor: STATUS_CONFIG[selectedItem.status]?.bg || '#334155',
                  color: STATUS_CONFIG[selectedItem.status]?.color || '#94a3b8',
                  display: 'flex',
                }}>
                  {STATUS_CONFIG[selectedItem.status]?.icon || <PendingIcon />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                    {selectedItem.originalName || selectedItem.filename || 'Unknown Item'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {selectedDataset?.name} · {selectedDataset?.type?.toUpperCase()} ·{' '}
                    {selectedItem.status && STATUS_CONFIG[selectedItem.status]?.label}
                  </Typography>
                </Box>
                <Chip
                  label={STATUS_CONFIG[selectedItem.status]?.label}
                  sx={{
                    bgcolor: STATUS_CONFIG[selectedItem.status]?.bg,
                    color: STATUS_CONFIG[selectedItem.status]?.color,
                    fontWeight: 700,
                  }}
                />
              </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* ── Section 1: Item Preview ── */}
                <Box sx={{ p: 3, borderBottom: '1px solid #334155' }}>
                  <Typography variant="subtitle2" sx={{ color: '#64748b', mb: 2, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Xem trước dữ liệu
                  </Typography>

                  {selectedItem.type === 'image' && selectedItem.imageUrl ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Box
                        component="img"
                        src={`${API_URL}/${selectedItem.imageUrl}`}
                        alt={selectedItem.filename}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: 300,
                          borderRadius: 2,
                          border: '1px solid #334155',
                          objectFit: 'contain',
                          bgcolor: '#0f172a',
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </Box>
                  ) : selectedItem.type === 'text' && selectedItem.text ? (
                    <Box sx={{
                      p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155',
                      maxHeight: 200, overflowY: 'auto',
                    }}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {selectedItem.text}
                      </Typography>
                    </Box>
                  ) : selectedItem.type === 'audio' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#0f172a', borderRadius: 2, border: '1px solid #334155' }}>
                      <AudioIcon sx={{ color: '#8b5cf6', fontSize: 40 }} />
                      <Box>
                        <Typography sx={{ color: '#e2e8f0' }}>{selectedItem.filename}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>File audio · {selectedItem.mimeType}</Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#0f172a', borderRadius: 2, border: '1px solid #334155' }}>
                      <Typography sx={{ color: '#475569' }}>Không có preview cho item này</Typography>
                    </Box>
                  )}

                  {/* File info */}
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>Tên file</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {selectedItem.filename || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>Tên gốc</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {selectedItem.originalName || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>Loại</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {selectedItem.type?.toUpperCase() || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>Đường dẫn</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {selectedItem.path || '—'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>

                {/* ── Section 2: Label Summary ── */}
                <Box sx={{ p: 3, borderBottom: '1px solid #334155' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LabelIcon sx={{ color: '#3b82f6', fontSize: 18 }} />
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Nhãn gán cho item
                    </Typography>
                  </Box>

                  {selectedItem.displayLabel && selectedItem.displayLabel !== 'Chưa có nhãn' ? (
                    <Box sx={{
                      p: 2, borderRadius: 2, bgcolor: '#22c55e10', border: '1px solid #22c55e40',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <CheckCircleIcon sx={{ color: '#22c55e' }} />
                      <Box>
                        <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>Nhãn chính thức</Typography>
                        <Typography sx={{ color: '#22c55e', fontWeight: 700, fontSize: '1rem' }}>
                          {selectedItem.displayLabel}
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#334155', border: '1px solid #475569', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <PendingIcon sx={{ color: '#64748b' }} />
                      <Typography sx={{ color: '#64748b' }}>Chưa có nhãn nào được gán</Typography>
                    </Box>
                  )}

                  {/* Vote Summary */}
                  {selectedItem.totalVotes > 0 && (
                    <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#0f172a', border: '1px solid #334155' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <VoteIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                          Tổng kết phiếu bầu
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />
                          <Typography sx={{ color: '#22c55e', fontSize: '0.8rem' }}>
                            Duyệt: {selectedItem.approvedCount}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                          <Typography sx={{ color: '#ef4444', fontSize: '0.8rem' }}>
                            Từ chối: {selectedItem.rejectedCount}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                          <Typography sx={{ color: '#f59e0b', fontSize: '0.8rem' }}>
                            Chờ: {selectedItem.totalVotes - selectedItem.approvedCount - selectedItem.rejectedCount}
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={selectedItem.totalVotes > 0 ? (selectedItem.approvedCount / selectedItem.totalVotes) * 100 : 0}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: '#334155',
                          '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
                            borderRadius: 3,
                          },
                        }}
                      />
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem', mt: 0.5 }}>
                        {selectedItem.totalVotes} người đã gán nhãn cho item này
                      </Typography>
                    </Box>
                  )}

                  {/* Label Set from project */}
                  {selectedItem.labelSet && selectedItem.labelSet.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ color: '#475569', fontSize: '0.72rem', mb: 1 }}>
                        Label set của project
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {selectedItem.labelSet.map((label, idx) => (
                          <Chip
                            key={idx}
                            label={typeof label === 'string' ? label : label.name || label.value || JSON.stringify(label)}
                            size="small"
                            sx={{
                              fontSize: '0.72rem', height: 22,
                              bgcolor: '#3b82f610', color: '#60a5fa',
                              border: '1px solid #3b82f640',
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* ── Section 3: Annotations List ── */}
                {selectedItem.annotations && selectedItem.annotations.length > 0 && (
                  <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <PersonIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
                      <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Chi tiết annotation ({selectedItem.annotations.length})
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {selectedItem.annotations.map((ann, idx) => {
                        const annStatusCfg = ann.status === 'approved'
                          ? { color: '#22c55e', bg: '#22c55e10', border: '#22c55e30', label: 'Đã duyệt', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> }
                          : ann.status === 'rejected'
                          ? { color: '#ef4444', bg: '#ef444410', border: '#ef444430', label: 'Từ chối', icon: <CancelIcon sx={{ fontSize: 14 }} /> }
                          : { color: '#f59e0b', bg: '#f59e0b10', border: '#f59e0b30', label: 'Chờ duyệt', icon: <PendingIcon sx={{ fontSize: 14 }} /> };

                        const isExpanded = expandedAnnotations[idx];
                        const hasReviewInfo = ann.reviewComments || ann.errorCategory || ann.reviewIssues?.length > 0;

                        return (
                          <Box key={idx} sx={{
                            borderRadius: 2, border: `1px solid ${annStatusCfg.border}`,
                            bgcolor: annStatusCfg.bg, overflow: 'hidden',
                          }}>
                            {/* Annotation header */}
                            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: '#334155', fontSize: '0.72rem', color: '#94a3b8' }}>
                                {(ann.annotator || 'A').substring(0, 2).toUpperCase()}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 600 }}>
                                    {ann.annotator || 'Unknown'}
                                  </Typography>
                                  {ann.primaryForItem && (
                                    <Chip icon={<StarIcon sx={{ fontSize: 11 }} />} label="Primary"
                                      size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f59e0b20', color: '#f59e0b', '& .MuiChip-icon': { color: '#f59e0b' } }} />
                                  )}
                                </Box>
                                {ann.reviewedAt && (
                                  <Typography sx={{ color: '#475569', fontSize: '0.72rem' }}>
                                    {new Date(ann.reviewedAt).toLocaleString('vi-VN')}
                                  </Typography>
                                )}
                              </Box>
                              <Chip
                                icon={annStatusCfg.icon}
                                label={annStatusCfg.label}
                                size="small"
                                sx={{ bgcolor: annStatusCfg.bg, color: annStatusCfg.color, fontWeight: 700, fontSize: '0.72rem' }}
                              />
                              {hasReviewInfo && (
                                <IconButton size="small" onClick={() => toggleAnnotation(idx)}
                                  sx={{ color: '#64748b' }}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              )}
                            </Box>

                            {/* Labels from this annotation */}
                            {ann.labels && (
                              <Box sx={{ px: 2, pb: 1.5 }}>
                                <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.5 }}>
                                  Labels gán:
                                </Typography>
                                {typeof ann.labels === 'object' ? (
                                  <Box sx={{ pl: 1, borderLeft: '2px solid #334155' }}>
                                    {ann.labels.label && (
                                      <Typography sx={{ color: '#93c5fd', fontSize: '0.8rem', mb: 0.3 }}>
                                        • Classification: <strong>{ann.labels.label}</strong>
                                      </Typography>
                                    )}
                                    {ann.labels.objects && ann.labels.objects.length > 0 && (
                                      <Typography sx={{ color: '#93c5fd', fontSize: '0.8rem', mb: 0.3 }}>
                                        • Objects ({ann.labels.objects.length}):
                                        {' '}
                                        {ann.labels.objects.slice(0, 5).map((obj, oi) => (
                                          <Chip key={oi} label={obj.label || 'unknown'} size="small"
                                            sx={{ mr: 0.5, mb: 0.3, fontSize: '0.68rem', height: 18, bgcolor: '#1e293b', color: '#93c5fd' }} />
                                        ))}
                                        {ann.labels.objects.length > 5 && (
                                          <Typography component="span" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                            +{ann.labels.objects.length - 5} more
                                          </Typography>
                                        )}
                                      </Typography>
                                    )}
                                    {ann.labels.spans && ann.labels.spans.length > 0 && (
                                      <Typography sx={{ color: '#93c5fd', fontSize: '0.8rem', mb: 0.3 }}>
                                        • Spans ({ann.labels.spans.length}):
                                        {' '}
                                        {ann.labels.spans.slice(0, 5).map((span, si) => (
                                          <Chip key={si} label={`${span.label || '?'}: "${span.text?.substring(0, 20) || ''}..."`}
                                            size="small"
                                            sx={{ mr: 0.5, mb: 0.3, fontSize: '0.68rem', height: 18, bgcolor: '#1e293b', color: '#93c5fd' }} />
                                        ))}
                                        {ann.labels.spans.length > 5 && (
                                          <Typography component="span" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                            +{ann.labels.spans.length - 5} more
                                          </Typography>
                                        )}
                                      </Typography>
                                    )}
                                    {/* Show raw keys if nothing above matched */}
                                    {(!ann.labels.label && !ann.labels.objects && !ann.labels.spans) && (
                                      <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                                        {JSON.stringify(ann.labels, null, 2).substring(0, 200)}
                                      </Typography>
                                    )}
                                  </Box>
                                ) : (
                                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>{String(ann.labels)}</Typography>
                                )}
                              </Box>
                            )}

                            {/* Review info - collapsible */}
                            <Collapse in={isExpanded}>
                              <Box sx={{ px: 2, pb: 2, borderTop: '1px solid #33415520', pt: 1.5 }}>
                                {/* Error category */}
                                {ann.errorCategory && (
                                  <Box sx={{ mb: 1.5 }}>
                                    <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <ErrorIcon sx={{ fontSize: 12 }} /> Loại lỗi
                                    </Typography>
                                    <Chip
                                      label={ERROR_CATEGORIES[ann.errorCategory]?.label || ann.errorCategory}
                                      size="small"
                                      sx={{
                                        fontSize: '0.72rem', height: 22,
                                        bgcolor: `${ERROR_CATEGORIES[ann.errorCategory]?.color || '#6b7280'}20`,
                                        color: ERROR_CATEGORIES[ann.errorCategory]?.color || '#6b7280',
                                      }}
                                    />
                                  </Box>
                                )}

                                {/* Review issues */}
                                {ann.reviewIssues && ann.reviewIssues.length > 0 && (
                                  <Box sx={{ mb: 1.5 }}>
                                    <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.5 }}>
                                      Issues được ghi nhận
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                      {ann.reviewIssues.map((issue, ii) => {
                                        const eCfg = ERROR_CATEGORIES[issue] || ERROR_CATEGORIES.other;
                                        return (
                                          <Chip key={ii} label={eCfg.label} size="small"
                                            sx={{ fontSize: '0.68rem', height: 20, bgcolor: `${eCfg.color}20`, color: eCfg.color }} />
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                )}

                                {/* Review comments */}
                                {ann.reviewComments && (
                                  <Box>
                                    <Typography sx={{ color: '#475569', fontSize: '0.7rem', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <CommentIcon sx={{ fontSize: 12 }} /> Bình luận từ reviewer
                                    </Typography>
                                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: '#0f172a', border: '1px solid #334155' }}>
                                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                                        {ann.reviewComments}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
              <Button onClick={handleCloseItemDetail} sx={{ color: '#94a3b8' }}>
                Đóng
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminDatasets;
