import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
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
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Pending as PendingIcon, Edit as EditIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const AnnotatorAuditDetail = () => {
  const { projectId, annotatorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [annotator, setAnnotator] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [project, setProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedTask, setSelectedTask] = useState(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    fetchData();
  }, [projectId, annotatorId]);

  useEffect(() => {
    // Fetch text content if task is text type
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
    } catch (error) {
      console.error('Error fetching text content:', error);
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
      const projectTasks = tasksRes.data.filter(t => 
        t.projectId._id === projectId && 
        (t.annotatorId?._id === annotatorId || t.annotatorId === annotatorId)
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

  const calculateQualityScore = (task) => {
    if (task.status === 'approved') return 100;
    if (task.status === 'rejected') return 0;
    return null;
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
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (sortBy === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    return 0;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => ['submitted', 'approved', 'rejected'].includes(t.status)).length,
    approved: tasks.filter(t => t.status === 'approved').length,
    rejected: tasks.filter(t => t.status === 'rejected').length,
    avgQuality: tasks.filter(t => ['approved', 'rejected'].includes(t.status)).length > 0
      ? Math.round((tasks.filter(t => t.status === 'approved').length / 
        (tasks.filter(t => ['approved', 'rejected'].includes(t.status)).length)) * 100)
      : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(`/manager/projects/${projectId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowBackIcon />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Projects</span>
              <span>/</span>
              <span>{project?.name || 'Project'}</span>
              <span>/</span>
              <span className="text-gray-900 font-medium">Annotator Audit</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              Annotator Audit: {annotator?.fullName || annotator?.username || 'Unknown'}
            </h1>
          </div>
        </div>

        {/* Annotator Profile Summary */}
        <Paper className="p-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                {(annotator?.fullName || annotator?.username || 'A')[0].toUpperCase()}
              </Avatar>
              <div>
                <Typography variant="h6">
                  {annotator?.fullName || annotator?.username || 'Unknown'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Senior Annotator • Member since {annotator?.createdAt 
                    ? new Date(annotator.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'N/A'}
                </Typography>
              </div>
            </div>
            <div className="flex gap-2">
              <Chip label="TOP PERFORMER" color="success" size="small" />
              <Chip label="FULL-TIME" color="primary" size="small" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div>
              <Typography variant="caption" color="text.secondary">ASSIGNED REVIEWER</Typography>
              <Typography variant="body2" className="mt-1">
                {tasks[0]?.reviewers?.[0]?.reviewerId?.fullName || 
                 tasks[0]?.reviewers?.[0]?.reviewerId?.username || 
                 'Unassigned'}
              </Typography>
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">TOTAL COMPLETION</Typography>
              <Typography variant="h6" className="mt-1">{stats.completed} tasks</Typography>
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">AVG QUALITY SCORE</Typography>
              <Typography variant="h6" className="mt-1 text-green-600">
                {stats.avgQuality}%
              </Typography>
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">WEEKLY SPEED</Typography>
              <Typography variant="body2" className="mt-1">-- items/hr</Typography>
            </div>
          </div>
        </Paper>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-4">
            <TextField
              size="small"
              placeholder="Search by Task ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <FormControl size="small" className="w-48">
              <InputLabel>Annotator Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Annotator Status"
              >
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
              <Select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
                label="Review Results"
              >
                <MenuItem value="all">All Results</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="pending">Pending Review</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" className="w-48">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort by"
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" color="primary">
              Evaluation Report
            </Button>
          </div>
        </div>

        {/* Tasks Table */}
        <TableContainer component={Paper} className="shadow-sm">
          <Table>
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableCell className="font-semibold">TASK ID / PREVIEW</TableCell>
                <TableCell className="font-semibold">LABEL TYPE</TableCell>
                <TableCell className="font-semibold">ANNOTATOR STATUS</TableCell>
                <TableCell className="font-semibold">REVIEWER RESULT</TableCell>
                <TableCell className="font-semibold">QUALITY SCORE</TableCell>
                <TableCell className="font-semibold">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" className="py-8 text-gray-500">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const kind = getTaskKind(task);
                  const qualityScore = calculateQualityScore(task);
                  return (
                    <TableRow key={task._id} hover>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs">
                            {kind === 'image' ? '🖼️' : kind === 'text' ? '📄' : kind === 'audio' ? '🎵' : '📎'}
                          </div>
                          <span className="text-sm">#{task._id.slice(-6)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {kind === 'image' ? 'BBox Annotation' : 
                         kind === 'text' ? 'Text Span' : 
                         kind === 'audio' ? 'Audio Label' : 'Other'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={task.status?.toUpperCase() || 'ASSIGNED'}
                          size="small"
                          color={
                            task.status === 'approved' ? 'success' :
                            task.status === 'rejected' ? 'error' :
                            task.status === 'submitted' ? 'warning' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(task.status)}
                          <span className="text-sm">
                            {task.status === 'approved' ? 'Approved' :
                             task.status === 'rejected' ? 'Rejected' :
                             'Pending Review'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {qualityScore !== null ? (
                          <span className={`font-semibold ${
                            qualityScore >= 90 ? 'text-green-600' :
                            qualityScore >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {qualityScore}%
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedTask(task);
                            setQuickViewOpen(true);
                          }}
                        >
                          View Audit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredTasks.length} tasks out of {tasks.length} total
        </div>
      </div>

      {/* Quick View Side Panel */}
      {quickViewOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setQuickViewOpen(false);
              setSelectedTask(null);
            }}
          ></div>
          
          {/* Side Panel */}
          <div className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Audit: #{selectedTask._id.slice(-6)} {getTaskKind(selectedTask).toUpperCase()}
                </h2>
              </div>
              <IconButton onClick={() => {
                setQuickViewOpen(false);
                setSelectedTask(null);
              }}>
                ✕
              </IconButton>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Task Visualization */}
              <div className="bg-gray-100 rounded-lg p-4 min-h-[300px] flex items-center justify-center relative">
                {getTaskKind(selectedTask) === 'image' && selectedTask.dataItem?.path ? (
                  <div className="relative w-full max-h-[500px] flex items-center justify-center">
                    <img 
                      src={`${API_URL}/${selectedTask.dataItem.path}`} 
                      alt={selectedTask.dataItem?.filename || 'Task image'}
                      className="max-w-full max-h-[500px] object-contain"
                      id={`quick-view-img-${selectedTask._id}`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none' }} className="text-gray-500">Image not available</div>
                    {/* Render bounding boxes overlay */}
                    {selectedTask.labels?.objects && Array.isArray(selectedTask.labels.objects) && selectedTask.labels.objects.length > 0 && (
                      <svg 
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ maxWidth: '100%', maxHeight: '500px' }}
                      >
                        {selectedTask.labels.objects.map((obj, idx) => {
                          const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
                          const labelInfo = project?.labelSet?.find(l => l.name === obj.label);
                          const color = labelInfo?.color || '#3b82f6';
                          return (
                            <g key={idx}>
                              <rect
                                x={`${x1}%`}
                                y={`${y1}%`}
                                width={`${x2 - x1}%`}
                                height={`${y2 - y1}%`}
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                strokeDasharray="5,5"
                              />
                              <text
                                x={`${x1}%`}
                                y={`${Math.max(y1 - 5, 10)}%`}
                                fill={color}
                                fontSize="12"
                                fontWeight="bold"
                                className="pointer-events-auto"
                              >
                                {obj.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                ) : getTaskKind(selectedTask) === 'text' && selectedTask.dataItem?.path ? (
                  <div className="bg-white p-4 rounded border max-w-full max-h-[500px] overflow-auto w-full">
                    {selectedTask.labels?.spans && Array.isArray(selectedTask.labels.spans) && selectedTask.labels.spans.length > 0 && textContent ? (
                      <div className="text-sm whitespace-pre-wrap">
                        {(() => {
                          const sortedSpans = [...selectedTask.labels.spans].sort((a, b) => a.start - b.start);
                          const parts = [];
                          let lastIndex = 0;
                          sortedSpans.forEach((span) => {
                            if (span.start > lastIndex) {
                              parts.push({ text: textContent.substring(lastIndex, span.start), isSpan: false });
                            }
                            const labelInfo = project?.labelSet?.find(l => l.name === span.label);
                            parts.push({
                              text: textContent.substring(span.start, span.end),
                              isSpan: true,
                              label: span.label,
                              color: labelInfo?.color || '#3b82f6'
                            });
                            lastIndex = span.end;
                          });
                          if (lastIndex < textContent.length) {
                            parts.push({ text: textContent.substring(lastIndex), isSpan: false });
                          }
                          return parts.map((part, idx) => 
                            part.isSpan ? (
                              <mark key={idx} style={{ backgroundColor: part.color + '40', color: part.color, fontWeight: 'bold' }}>
                                {part.text}
                              </mark>
                            ) : (
                              <span key={idx}>{part.text}</span>
                            )
                          );
                        })()}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm">{textContent || 'Loading text content...'}</pre>
                    )}
                  </div>
                ) : getTaskKind(selectedTask) === 'audio' && selectedTask.dataItem?.path ? (
                  <audio controls className="w-full max-w-md">
                    <source src={`${API_URL}/${selectedTask.dataItem.path}`} type={selectedTask.dataItem?.mimeType || 'audio/mpeg'} />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <div className="text-gray-500">Preview not available for this task type</div>
                )}
              </div>

              {/* Audit Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Typography variant="caption" color="text.secondary">ANNOTATOR STATUS</Typography>
                  <Chip
                    label={selectedTask.status?.toUpperCase() || 'ASSIGNED'}
                    size="small"
                    color={
                      selectedTask.status === 'approved' ? 'success' :
                      selectedTask.status === 'rejected' ? 'error' :
                      selectedTask.status === 'submitted' ? 'warning' :
                      'default'
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Typography variant="caption" color="text.secondary">QUALITY SCORE</Typography>
                  <Typography variant="h6" className={selectedTask.status === 'approved' ? 'text-green-600' : 
                    selectedTask.status === 'rejected' ? 'text-red-600' : 'text-gray-400'}>
                    {selectedTask.status === 'approved' ? '100%' : 
                     selectedTask.status === 'rejected' ? '0%' : '--'}
                  </Typography>
                </div>
              </div>

              {/* Annotator's Label */}
              <div>
                <Typography variant="subtitle2" className="mb-2">Annotator's Label</Typography>
                <Paper className="p-4 bg-gray-50">
                  {selectedTask.labels?.objects && Array.isArray(selectedTask.labels.objects) && selectedTask.labels.objects.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTask.labels.objects.map((obj, idx) => (
                        <div key={idx} className="text-sm">
                          <strong style={{ color: project?.labelSet?.find(l => l.name === obj.label)?.color || '#3b82f6' }}>
                            {obj.label}
                          </strong>: BBox [{obj.bbox?.join(', ') || 'N/A'}]
                          {obj.answer && <div className="text-gray-600 mt-1">Answer: {obj.answer}</div>}
                        </div>
                      ))}
                    </div>
                  ) : selectedTask.labels?.spans && Array.isArray(selectedTask.labels.spans) && selectedTask.labels.spans.length > 0 ? (
                    <div className="text-sm space-y-1">
                      {selectedTask.labels.spans.map((span, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: project?.labelSet?.find(l => l.name === span.label)?.color || '#3b82f6' }}>
                            {span.label}:
                          </span>
                          <span>"{span.text || textContent.substring(span.start, span.end)}"</span>
                        </div>
                      ))}
                      {selectedTask.labels.note && (
                        <div className="mt-2 text-gray-600 italic">Note: {selectedTask.labels.note}</div>
                      )}
                    </div>
                  ) : selectedTask.labels?.label ? (
                    <div className="text-sm">
                      <div className="font-semibold">Label: <span style={{ color: project?.labelSet?.find(l => l.name === selectedTask.labels.label)?.color || '#3b82f6' }}>
                        {selectedTask.labels.label}
                      </span></div>
                      {selectedTask.labels.note && (
                        <div className="mt-2 text-gray-600">{selectedTask.labels.note}</div>
                      )}
                    </div>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No labels provided</Typography>
                  )}
                </Paper>
              </div>

              {/* Reviewer's Feedback */}
              {selectedTask.status === 'rejected' && (selectedTask.errorCategory || selectedTask.reviewComments) && (
                <div>
                  <Typography variant="subtitle2" className="mb-2 text-red-600">Reviewer's Feedback</Typography>
                  <Paper className="p-4 bg-red-50 border border-red-200">
                    {selectedTask.errorCategory && (
                      <Typography variant="body2" className="font-semibold text-red-800 mb-1">
                        {selectedTask.errorCategory}
                      </Typography>
                    )}
                    {selectedTask.reviewComments && (
                      <Typography variant="body2" className="text-red-700">
                        {selectedTask.reviewComments}
                      </Typography>
                    )}
                    {selectedTask.reviewNotes && (
                      <Typography variant="body2" className="text-red-600 mt-2 italic">
                        {selectedTask.reviewNotes}
                      </Typography>
                    )}
                  </Paper>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={async () => {
                    try {
                      await axios.put(`${API_URL}/api/tasks/${selectedTask._id}`, {
                        status: 'approved'
                      }, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                      });
                      alert('Task approved successfully');
                      fetchData();
                      setQuickViewOpen(false);
                      setSelectedTask(null);
                    } catch (error) {
                      console.error('Error approving task:', error);
                      alert('Error approving task: ' + (error.response?.data?.message || error.message));
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    alert('Override functionality - to be implemented');
                  }}
                >
                  Override
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // To Discord - placeholder
                    alert('Discord integration - to be implemented');
                  }}
                >
                  To Discord
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // To Slack - placeholder
                    alert('Slack integration - to be implemented');
                  }}
                >
                  To Slack
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotatorAuditDetail;
