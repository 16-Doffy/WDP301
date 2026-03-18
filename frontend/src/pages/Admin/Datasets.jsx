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
} from '@mui/material';
import {
  Search as SearchIcon,
  Folder as FolderIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  AudioFile as AudioIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AdminDatasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItems, setDetailItems] = useState([]);
  const [detailItemsLoading, setDetailItemsLoading] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    image: 0,
    text: 0,
    audio: 0,
  });

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

  useEffect(() => {
    fetchDatasets();
  }, []);

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
      case 'text': return <TextIcon />;
      case 'audio': return <AudioIcon />;
      default: return <ImageIcon />;
    }
  };

  const getDatasetColor = (type) => {
    switch (type) {
      case 'text': return '#3b82f6';
      case 'audio': return '#8b5cf6';
      default: return '#22c55e';
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
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#e2e8f0', mb: 1 }}>
          Admin Datasets
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
          View and manage all datasets across all managers
        </Typography>
      </Box>

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
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Total Datasets</Typography>
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

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search datasets..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 300, '& .MuiOutlinedInput-root': { bgcolor: '#1e293b' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
          }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDatasets} sx={{ borderColor: '#334155', color: '#94a3b8' }}>
          Refresh
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3, '& .MuiTab-root': { color: '#94a3b8' }, '& .Mui-selected': { color: '#3b82f6' }, '& .MuiTabs-indicator': { bgcolor: '#3b82f6' } }}>
        <Tab label={`All (${datasets.length})`} />
        <Tab label={`Image (${stats.image})`} />
        <Tab label={`Text (${stats.text})`} />
        <Tab label={`Audio (${stats.audio})`} />
      </Tabs>

      <TableContainer component={Paper} sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Dataset</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Project</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Manager</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ color: '#94a3b8', fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDatasets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#64748b' }}>No datasets found</TableCell>
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
                    <Chip label={dataset.type} size="small" sx={{ bgcolor: `${getDatasetColor(dataset.type)}20`, color: getDatasetColor(dataset.type), fontWeight: 600, textTransform: 'capitalize' }} />
                  </TableCell>
                  <TableCell><Typography sx={{ color: '#e2e8f0' }}>{dataset.projectId?.name || 'No Project'}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#94a3b8' }}>{dataset.managerName || 'Unknown'}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#e2e8f0' }}>{dataset.fileCount || 0}</Typography></TableCell>
                  <TableCell><Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>{dataset.createdAt ? new Date(dataset.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</Typography></TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" onClick={() => handleOpenDetail(dataset)} sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}>View Items</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="lg" fullWidth PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid #334155', minHeight: '70vh' } }}>
        <DialogTitle sx={{ borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: selectedDataset ? `${getDatasetColor(selectedDataset.type)}20` : '#334155', color: selectedDataset ? getDatasetColor(selectedDataset.type) : '#94a3b8', display: 'flex' }}>
            {selectedDataset && getDatasetIcon(selectedDataset.type)}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>{selectedDataset?.name}</Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>{selectedDataset?.projectId?.name || 'No Project'} - {selectedDataset?.managerName}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {detailItemsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : detailItems.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}><Typography sx={{ color: '#64748b' }}>No items in this dataset</Typography></Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography sx={{ color: '#94a3b8', mb: 2 }}>Showing items ({detailItems.length})</Typography>
              <Grid container spacing={2}>
                {detailItems.slice(0, 20).map((item, idx) => (
                  <Grid item xs={6} sm={4} md={3} key={item.id || idx}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#0f172a', border: item.status === 'approved' ? '2px solid #22c55e' : '1px solid #334155', '&:hover': { borderColor: '#3b82f6' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</Typography>
                        {item.status === 'approved' && <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {item.annotations?.slice(0, 3).map((ann, i) => (
                          <Chip key={i} label={ann.annotator} size="small" sx={{ fontSize: '0.7rem', height: 20, bgcolor: '#3b82f620', color: '#60a5fa' }} />
                        ))}
                        {(item.annotations?.length || 0) > 3 && <Chip label={`+${item.annotations.length - 3}`} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              {detailItems.length > 20 && <Typography sx={{ color: '#94a3b8', mt: 2, textAlign: 'center' }}>And {detailItems.length - 20} more items...</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
          <Button onClick={handleCloseDetail} sx={{ color: '#94a3b8' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDatasets;
