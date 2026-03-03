import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';

const AnnotatorAuditDetail = () => {
  const { projectId, annotatorId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [annotator, setAnnotator] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [project, setProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    fetchData();
  }, [projectId, annotatorId]);

  useEffect(() => {
    if (selectedTask && getTaskKind(selectedTask) === 'text' && selectedTask.dataItem?.path) {
      fetchTextContent(selectedTask.dataItem.path);
    } else {
      setTextContent('');
    }
  }, [selectedTask]);

  const fetchTextContent = async (path) => {
    try {
      const response = await axios.get(`${API_URL}/${path}`, { responseType: 'text' });
      setTextContent(response.data);
    } catch {
      setTextContent('Không thể tải nội dung file.');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectRes, annotatorRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${projectId}`),
        axios.get(`${API_URL}/api/users/${annotatorId}`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      setProject(projectRes.data.project);
      setAnnotator(annotatorRes.data);
      const projectTasks = (tasksRes.data || []).filter(
        (t) => t.projectId?._id === projectId && (t.annotatorId?._id === annotatorId || t.annotatorId === annotatorId)
      );
      setTasks(projectTasks);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="text-green-600" fontSize="small" />;
      case 'rejected':
        return <CancelIcon className="text-red-600" fontSize="small" />;
      case 'submitted':
      case 'pending':
        return <PendingIcon className="text-yellow-600" fontSize="small" />;
      default:
        return null;
    }
  };

  const getTaskKind = (task) => {
    const mimeType = task.dataItem?.mimeType || '';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'other';
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (reviewFilter !== 'all') {
      if (reviewFilter === 'approved' && task.status !== 'approved') return false;
      if (reviewFilter === 'rejected' && task.status !== 'rejected') return false;
      if (reviewFilter === 'pending' && !['submitted', 'pending'].includes(task.status)) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const taskId = task._id?.toLowerCase() || '';
      const filename = (task.dataItem?.filename || '').toLowerCase();
      return taskId.includes(term) || filename.includes(term);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-200">
      <div className="border-b border-slate-700 px-6 py-4 bg-slate-800">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(`/manager/projects/${projectId}`)} className="p-2 hover:bg-slate-700 rounded-lg">
            <ArrowBackIcon />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Projects</span>
              <span>/</span>
              <span>{project?.name || 'Project'}</span>
              <span>/</span>
              <span className="text-slate-200 font-medium">Annotator Audit</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">Annotator Audit: {annotator?.fullName || annotator?.username || 'Unknown'}</h1>
          </div>
        </div>

        <Paper className="p-4" sx={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}>
          <div className="flex items-center gap-4">
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {(annotator?.fullName || annotator?.username || 'A')[0].toUpperCase()}
            </Avatar>
            <div>
              <Typography variant="h6">{annotator?.fullName || annotator?.username || 'Unknown'}</Typography>
              <Typography variant="body2" color="#94a3b8">Task count: {tasks.length}</Typography>
            </div>
          </div>
        </Paper>
      </div>

      <div className="p-6">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <TextField size="small" placeholder="Search by Task ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
            <FormControl size="small" className="w-48">
              <InputLabel>Annotator Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Annotator Status">
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="assigned">Assigned</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="submitted">Submitted</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" className="w-48">
              <InputLabel>Review Results</InputLabel>
              <Select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)} label="Review Results">
                <MenuItem value="all">All Results</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="pending">Pending Review</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        <TableContainer component={Paper} sx={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Table>
            <TableHead>
              <TableRow className="bg-slate-900">
                <TableCell>TASK ID / PREVIEW</TableCell>
                <TableCell>LABEL TYPE</TableCell>
                <TableCell>ANNOTATOR STATUS</TableCell>
                <TableCell>REVIEWER RESULT</TableCell>
                <TableCell>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" className="py-8 text-slate-400">No tasks found</TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const kind = getTaskKind(task);
                  return (
                    <TableRow key={task._id} hover>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-xs">{kind === 'image' ? '🖼️' : kind === 'text' ? '📄' : kind === 'audio' ? '🎵' : '📎'}</div>
                          <span className="text-sm">#{task._id.slice(-6)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{kind === 'image' ? 'BBox Annotation' : kind === 'text' ? 'Text Span' : kind === 'audio' ? 'Audio Label' : 'Other'}</TableCell>
                      <TableCell><Chip label={task.status?.toUpperCase() || 'ASSIGNED'} size="small" /></TableCell>
                      <TableCell><div className="flex items-center gap-1">{getStatusIcon(task.status)}<span className="text-sm">{task.status === 'approved' ? 'Approved' : task.status === 'rejected' ? 'Rejected' : 'Pending Review'}</span></div></TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" onClick={() => { setSelectedTask(task); setQuickViewOpen(true); }}>
                          View Review Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {quickViewOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setQuickViewOpen(false); setSelectedTask(null); }}></div>
          <div className="relative bg-slate-100 w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Chi tiết task #{selectedTask._id.slice(-6)} ({getTaskKind(selectedTask).toUpperCase()})</h2>
                <p className="text-xs text-gray-500 mt-1">Hiển thị đầy đủ kết quả reviewer đã chấm: vote, comment và lỗi.</p>
              </div>
              <IconButton onClick={() => { setQuickViewOpen(false); setSelectedTask(null); }}>✕</IconButton>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-white rounded-lg p-4 min-h-[180px] flex items-center justify-center">
                {getTaskKind(selectedTask) === 'audio' && selectedTask.dataItem?.path ? (
                  <audio controls className="w-full max-w-md">
                    <source src={`${API_URL}/${selectedTask.dataItem.path}`} type={selectedTask.dataItem?.mimeType || 'audio/mpeg'} />
                  </audio>
                ) : getTaskKind(selectedTask) === 'text' ? (
                  <div className="w-full text-sm text-gray-700 whitespace-pre-wrap">{textContent || 'No content'}</div>
                ) : (
                  <div className="text-gray-500">Preview available in original task type UI.</div>
                )}
              </div>

              <div>
                <Typography variant="subtitle2" className="mb-2">Reviewer Results (chi tiết chấm bài)</Typography>
                <Paper className="p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip
                      size="small"
                      label={selectedTask.status?.toUpperCase() || 'ASSIGNED'}
                      color={selectedTask.status === 'approved' ? 'success' : selectedTask.status === 'rejected' ? 'error' : 'warning'}
                    />
                    <span className="text-xs text-gray-500">
                      Reviewed at: {selectedTask.reviewedAt ? new Date(selectedTask.reviewedAt).toLocaleString('vi-VN') : 'Chưa review'}
                    </span>
                  </div>

                  <div className="rounded border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Overall Reviewer Comment</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{selectedTask.reviewComments || 'Không có comment tổng quan.'}</div>
                  </div>

                  <div className="rounded border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Reviewer Votes</div>
                    {Array.isArray(selectedTask.reviewers) && selectedTask.reviewers.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTask.reviewers.map((rv, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                            <div>
                              <div className="font-medium text-gray-800">{rv.reviewerId?.fullName || rv.reviewerId?.username || 'Reviewer'}</div>
                              <div className="text-xs text-gray-500">{rv.reviewedAt ? new Date(rv.reviewedAt).toLocaleString('vi-VN') : 'Pending'}</div>
                              {!!rv.comment && <div className="text-xs text-gray-600 mt-1">{rv.comment}</div>}
                            </div>
                            <Chip
                              size="small"
                              label={(rv.status || 'pending').toUpperCase()}
                              color={rv.status === 'approved' ? 'success' : rv.status === 'rejected' ? 'error' : 'warning'}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Chưa có reviewer votes.</div>
                    )}
                  </div>

                  <div className="rounded border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Issue Category</div>
                    <div className="text-sm text-gray-800">{selectedTask.errorCategory || 'Không có phân loại lỗi.'}</div>
                  </div>

                  {Array.isArray(selectedTask.reviewNotes) && selectedTask.reviewNotes.length > 0 && (
                    <div className="rounded border border-gray-200 bg-white p-3">
                      <div className="text-xs font-semibold text-gray-500 mb-2">Object / Segment Notes</div>
                      <div className="space-y-2">
                        {selectedTask.reviewNotes.map((note, idx) => (
                          <div key={idx} className="text-sm text-gray-800 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                            <div><strong>Label:</strong> {note.label || '-'}</div>
                            {Array.isArray(note.bbox) && <div><strong>BBox:</strong> [{note.bbox.join(', ')}]</div>}
                            <div><strong>Comment:</strong> {note.comment || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Paper>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotatorAuditDetail;
