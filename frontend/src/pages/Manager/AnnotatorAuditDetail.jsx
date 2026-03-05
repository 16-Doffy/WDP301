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
import AudioAnnotator from '../../components/AudioAnnotator';
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
    const mimeType = (task.dataItem?.mimeType || '').toLowerCase();
    const filename = (task.dataItem?.filename || '').toLowerCase();
    const path = (task.dataItem?.path || '').toLowerCase();

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';

    const source = `${filename} ${path}`;
    if (/\.(png|jpe?g|jfif|gif|webp|bmp|svg)$/.test(source)) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(source)) return 'audio';
    if (/\.(txt|json|csv|md|log|xml)$/.test(source)) return 'text';

    return 'other';
  };

  const getDataItemUrl = (task) => {
    const p = task?.dataItem?.path;
    if (!p) return '';
    return `${API_URL}/${String(p).replace(/^\/+/, '')}`;
  };

  const getAnnotatorImageObjects = (task) => {
    const objects = task?.labels?.objects;
    if (!Array.isArray(objects)) return [];

    return objects
      .map((obj, idx) => ({
        id: obj?.id || idx,
        label: obj?.label || '-',
        bbox: Array.isArray(obj?.bbox) ? obj.bbox.map((v) => Number(v)) : null,
        confidence: obj?.confidence,
      }))
      .filter((obj) => Array.isArray(obj.bbox) && obj.bbox.length === 4 && obj.bbox.every((v) => Number.isFinite(v)));
  };

  const getLabelColor = (label = '') => {
    const palette = ['#1976d2', '#16a34a', '#ea580c', '#9333ea', '#0f766e', '#dc2626', '#2563eb'];
    const key = String(label);
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };

  const getNormalizedAudioSegments = (task) => {
    const segments = task?.labels?.segments;
    if (!Array.isArray(segments)) return [];
    return segments
      .map((seg, idx) => ({
        id: seg?.id || `segment_${idx + 1}`,
        start: Number(seg?.start ?? seg?.startTime ?? 0),
        end: Number(seg?.end ?? seg?.endTime ?? 0),
        label: seg?.label || 'unknown',
        note: seg?.note || '',
      }))
      .filter((seg) => Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.end > seg.start);
  };

  const getSpanText = (span) => {
    if (span?.text) return span.text;
    if (!textContent) return '';
    if (typeof span?.start !== 'number' || typeof span?.end !== 'number') return '';
    return textContent.slice(span.start, span.end);
  };

  const renderAnnotatorLabels = (task) => {
    const labels = task?.labels;
    if (!labels || (typeof labels === 'object' && Object.keys(labels).length === 0)) {
      return <div className="text-sm text-gray-500">Annotator chưa khoanh/gán label.</div>;
    }

    if (getTaskKind(task) === 'audio') {
      const segments = getNormalizedAudioSegments(task);
      return (
        <div className="space-y-3">
          {segments.length > 0 ? (
            segments.map((seg, idx) => (
              <div key={seg.id || idx} className="text-sm text-gray-800 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div><strong>Segment:</strong> #{idx + 1}</div>
                <div><strong>Label:</strong> {seg.label}</div>
                <div><strong>Range:</strong> {seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s</div>
                {!!seg.note && <div><strong>Note:</strong> {seg.note}</div>}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">Không có segment audio.</div>
          )}
          {!!labels.note && <div className="text-sm text-gray-700"><strong>Note:</strong> {labels.note}</div>}
        </div>
      );
    }

    if (Array.isArray(labels.spans) && labels.spans.length > 0) {
      return (
        <div className="space-y-2">
          {labels.spans.map((span, idx) => (
            <div key={idx} className="text-sm text-gray-800 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div><strong>Label:</strong> {span?.label || '-'}</div>
              {typeof span?.start === 'number' && typeof span?.end === 'number' && (
                <div><strong>Range:</strong> {span.start} - {span.end}</div>
              )}
              {!!getSpanText(span) && <div><strong>Text:</strong> {getSpanText(span)}</div>}
            </div>
          ))}
        </div>
      );
    }

    if (typeof labels.label === 'string') {
      return <div className="text-sm text-gray-800"><strong>Label:</strong> {labels.label}</div>;
    }

    return <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(labels, null, 2)}</pre>;
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
                {getTaskKind(selectedTask) === 'image' && selectedTask.dataItem?.path ? (
                  <div className="relative inline-block max-h-[520px] max-w-full overflow-auto border border-gray-200 rounded">
                    <img
                      src={getDataItemUrl(selectedTask)}
                      alt={selectedTask.dataItem?.filename || 'Task preview'}
                      className="max-h-[500px] w-auto max-w-full object-contain block"
                    />
                    {getAnnotatorImageObjects(selectedTask).map((obj) => {
                      const [x1, y1, x2, y2] = obj.bbox;
                      const left = Math.min(x1, x2);
                      const top = Math.min(y1, y2);
                      const width = Math.max(Math.abs(x2 - x1), 1);
                      const height = Math.max(Math.abs(y2 - y1), 1);
                      const color = getLabelColor(obj.label);
                      return (
                        <div
                          key={obj.id}
                          className="absolute"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            border: `2px solid ${color}`,
                            backgroundColor: `${color}22`,
                            boxSizing: 'border-box',
                          }}
                        >
                          <div
                            className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: color }}
                          >
                            {obj.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : getTaskKind(selectedTask) === 'audio' && selectedTask.dataItem?.path ? (
                  <div className="w-full">
                    <AudioAnnotator
                      audioUrl={getDataItemUrl(selectedTask)}
                      labelSet={selectedTask?.projectId?.labelSet || []}
                      initialSegments={getNormalizedAudioSegments(selectedTask)}
                      readOnly
                    />
                  </div>
                ) : getTaskKind(selectedTask) === 'text' ? (
                  <div className="w-full text-sm text-gray-700 whitespace-pre-wrap">{textContent || 'No content'}</div>
                ) : (
                  <div className="text-gray-500">Không có preview cho loại dữ liệu này.</div>
                )}
              </div>

              <div>
                <div className="mb-2 inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 border border-slate-700 shadow-sm">
                  <Typography variant="subtitle2" className="!text-slate-100 !font-bold tracking-wide">Annotator Results</Typography>
                </div>
                <Paper className="p-4 bg-gray-50 space-y-3 mb-4">
                  <div className="rounded border border-gray-200 bg-white p-3">
                    {renderAnnotatorLabels(selectedTask)}
                  </div>
                </Paper>

                <div className="mb-2 inline-flex items-center rounded-md bg-blue-700 px-3 py-1.5 border border-blue-600 shadow-sm">
                  <Typography variant="subtitle2" className="!text-white !font-bold tracking-wide">Reviewer Results (chi tiết chấm bài)</Typography>
                </div>
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
