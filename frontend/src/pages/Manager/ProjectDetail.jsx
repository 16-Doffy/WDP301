import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Alert,
} from '@mui/material';
import { Upload as UploadIcon, Assignment as AssignmentIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon, Settings as SettingsIcon, Download as DownloadIcon, Assessment as AssessmentIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerProjectDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [selectedReviewers, setSelectedReviewers] = useState([]);
  const [annotatorSpecialtyFilter, setAnnotatorSpecialtyFilter] = useState('all');
  const [reviewerSpecialtyFilter, setReviewerSpecialtyFilter] = useState('all');
  const [reviewPolicy, setReviewPolicy] = useState({ mode: 'full', sampleRate: 0.1 });
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [assignMode, setAssignMode] = useState('existing'); // 'existing' or 'upload'
  const [assignFiles, setAssignFiles] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    guidelines: '',
    labelSet: [],
    status: 'draft',
    deadline: '',
    exportFormat: 'JSON',
  });
  const [currentAnnotators, setCurrentAnnotators] = useState([]);
  const [currentReviewers, setCurrentReviewers] = useState([]);
  const [qualityStats, setQualityStats] = useState(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditTask, setAuditTask] = useState(null);
  const [previewLabelsOpen, setPreviewLabelsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | assigned | in_progress | submitted | approved | rejected
  const [expandedAnnotators, setExpandedAnnotators] = useState({}); // annotatorId -> bool

  useEffect(() => {
    fetchData();
    fetchAnnotators();
    fetchReviewers();
    fetchQualityStats();
  }, [id]);

  const fetchQualityStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/quality`);
      setQualityStats(response.data);
    } catch (error) {
      console.error('Error fetching quality stats:', error);
    }
  };

  useEffect(() => {
    if (project) {
      setEditFormData({
        name: project.name || '',
        description: project.description || '',
        guidelines: project.guidelines || '',
        labelSet: project.labelSet || [],
        status: project.status || 'draft',
        deadline: project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : '',
        exportFormat: project.exportFormat || 'JSON',
      });
      setReviewPolicy({
        mode: project.reviewPolicy?.mode || 'full',
        sampleRate: typeof project.reviewPolicy?.sampleRate === 'number' ? project.reviewPolicy.sampleRate : 0.1,
      });
    }
  }, [project]);

  useEffect(() => {
    // Get current assigned annotators and reviewers from tasks
    if (tasks.length > 0) {
      const annotatorIds = [...new Set(tasks.map(t => t.annotatorId?._id || t.annotatorId).filter(Boolean))];
      const reviewerIds = [...new Set(
        tasks.flatMap(t => 
          (t.reviewers || []).map(r => r.reviewerId?._id || r.reviewerId).filter(Boolean)
        )
      )];
      setCurrentAnnotators(annotatorIds);
      setCurrentReviewers(reviewerIds);
    } else {
      setCurrentAnnotators([]);
      setCurrentReviewers([]);
    }
  }, [tasks]);

  const fetchData = async () => {
    try {
      const [projectRes, datasetsRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/${id}`),
        axios.get(`${API_URL}/api/datasets/project/${id}`),
        axios.get(`${API_URL}/api/tasks/my-tasks`),
      ]);

      setProject(projectRes.data.project);
      setDatasets(datasetsRes.data);
      setTasks(tasksRes.data.filter(t => t.projectId._id === id));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotators = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      console.log('Annotators response:', response.data);
      
      // Backend already filters annotators for managers, but we keep filter for safety
      let annotatorsList = [];
      if (Array.isArray(response.data)) {
        annotatorsList = response.data
          .filter(u => u.role === 'annotator' && u.isActive)
          .map(u => ({ ...u, specialty: u.specialty || 'general' }));
      } else {
        annotatorsList = (response.data || []).map(u => ({ ...u, specialty: u.specialty || 'general' }));
      }
      
      setAnnotators(annotatorsList);
      
      if (annotatorsList.length === 0) {
        console.warn('No annotators found');
      }
    } catch (error) {
      console.error('Error fetching annotators:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Show error message to user
      const errorMsg = error.response?.data?.message || error.message || 'Không thể tải danh sách annotators';
      alert(`Lỗi: ${errorMsg}\n\nVui lòng kiểm tra:\n1. Backend server đã chạy chưa?\n2. Đã đăng nhập với quyền Manager chưa?`);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      let reviewerList = [];
      if (Array.isArray(response.data)) {
        reviewerList = response.data
          .filter(u => u.role === 'reviewer' && u.isActive)
          .map(u => ({ ...u, specialty: u.specialty || 'general' }));
      } else {
        reviewerList = (response.data || []).map(u => ({ ...u, specialty: u.specialty || 'general' }));
      }
      setReviewers(reviewerList);
    } catch (error) {
      console.error('Error fetching reviewers:', error);
    }
  };

  const handleFileUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('projectId', id);
      formData.append('name', datasetName || `Dataset ${new Date().toLocaleString()}`);
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      await axios.post(`${API_URL}/api/datasets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setDatasetName('');
      fetchData();
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedAnnotators || selectedAnnotators.length === 0) {
      alert('Vui lòng chọn ít nhất một annotator');
      return;
    }
    if (!selectedReviewers || selectedReviewers.length === 0) {
      alert('Vui lòng chọn ít nhất một reviewer');
      return;
    }

    try {
      let datasetId = selectedDataset;

      // Nếu chọn upload mới, tạo dataset trước
      if (assignMode === 'upload') {
        if (!assignFiles || assignFiles.length === 0) {
          alert('Vui lòng chọn ít nhất một file ảnh');
          return;
        }

        const formData = new FormData();
        formData.append('projectId', id);
        formData.append('name', datasetName || `Dataset ${new Date().toLocaleString()}`);
        assignFiles.forEach(file => {
          formData.append('files', file);
        });

        const datasetRes = await axios.post(`${API_URL}/api/datasets`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        datasetId = datasetRes.data._id;
      } else {
        // Chế độ chọn dataset có sẵn
        if (!selectedDataset) {
          alert('Vui lòng chọn dataset hoặc upload files mới');
          return;
        }
      }

      // Validate data before sending
      if (!Array.isArray(selectedReviewers) || selectedReviewers.length === 0) {
        alert('Vui lòng chọn ít nhất một reviewer');
        return;
      }
      if (!Array.isArray(selectedAnnotators) || selectedAnnotators.length === 0) {
        alert('Vui lòng chọn ít nhất một annotator');
        return;
      }

      console.log('Assigning tasks with:', {
        projectId: id,
        datasetId,
        annotatorIds: selectedAnnotators,
        reviewerIds: selectedReviewers,
      });

      // Assign tasks với dataset (mới hoặc có sẵn)
      const response = await axios.post(`${API_URL}/api/tasks/assign`, {
        projectId: id,
        datasetId: datasetId,
        annotatorIds: selectedAnnotators,
        reviewerIds: selectedReviewers,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      alert(response.data.message || 'Phân công thành công!');
      setAssignDialogOpen(false);
      setSelectedDataset('');
      setSelectedAnnotators([]);
      setSelectedReviewers([]);
      setAssignFiles([]);
      setDatasetName('');
      setAssignMode('existing');
      setReviewerSpecialtyFilter('all');
      setAnnotatorSpecialtyFilter('all');
      fetchData();
    } catch (error) {
      console.error('Error assigning tasks:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Có lỗi xảy ra khi phân công tasks';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errorMessage = error.response.data.errors.map(e => e.msg || e.message).join(', ');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Lỗi: ${errorMessage}`);
    }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(`${API_URL}/api/projects/${id}`, {
        ...editFormData,
        deadline: editFormData.deadline || undefined,
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Cập nhật project thành công!');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Lỗi khi cập nhật project: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      // Check if all tasks are approved (required for export)
      const totalTasks = tasks.length;
      const approvedTasks = tasks.filter(t => t.status === 'approved');
      const pendingTasks = tasks.filter(t => t.status === 'submitted' || t.status === 'in_progress' || t.status === 'assigned');
      const rejectedTasks = tasks.filter(t => t.status === 'rejected');

      if (totalTasks === 0) {
        alert('Không có task nào trong project này.');
        return;
      }

      if (approvedTasks.length === 0) {
        alert('Không có task nào đã được phê duyệt. Vui lòng đợi reviewer đánh giá và phê duyệt các tasks trước khi export.');
        return;
      }

      // Check if all tasks are approved (strict requirement)
      if (pendingTasks.length > 0 || rejectedTasks.length > 0) {
        const pendingMsg = pendingTasks.length > 0 ? `${pendingTasks.length} task(s) đang chờ đánh giá` : '';
        const rejectedMsg = rejectedTasks.length > 0 ? `${rejectedTasks.length} task(s) bị từ chối` : '';
        const messages = [pendingMsg, rejectedMsg].filter(Boolean).join(' và ');
        
        alert(`Không thể export: Chưa phê duyệt tất cả tasks.\n\n` +
              `Tổng số: ${totalTasks} tasks\n` +
              `Đã phê duyệt: ${approvedTasks.length} tasks\n` +
              `Còn lại: ${messages}\n\n` +
              `Vui lòng phê duyệt TẤT CẢ tasks trước khi export.`);
        return;
      }

      const response = await axios.get(`${API_URL}/api/projects/${id}/export?format=${format}`, {
        responseType: ['csv', 'yolo', 'voc'].includes(format.toLowerCase()) ? 'blob' : 'json'
      });
      
      // Determine file extension and MIME type
      let fileExtension = 'json';
      let mimeType = 'application/json';
      
      switch (format.toLowerCase()) {
        case 'csv':
          fileExtension = 'csv';
          mimeType = 'text/csv';
          break;
        case 'yolo':
          fileExtension = 'txt';
          mimeType = 'text/plain';
          break;
        case 'voc':
          fileExtension = 'xml';
          mimeType = 'application/xml';
          break;
        case 'coco':
          fileExtension = 'json';
          mimeType = 'application/json';
          break;
        default:
          fileExtension = 'json';
          mimeType = 'application/json';
      }

      if (['csv', 'yolo', 'voc'].includes(format.toLowerCase())) {
        // Handle blob responses
        const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.${fileExtension}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        // Handle JSON responses
        const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: mimeType });
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.${fileExtension}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      
      alert(`Đã xuất ${approvedTasks.length} tasks đã được phê duyệt thành công!`);
    } catch (error) {
      console.error('Error exporting data:', error);
      const errorMessage = error.response?.data?.message || error.message;
      const errorStats = error.response?.data?.stats;
      
      let fullMessage = 'Lỗi khi xuất dữ liệu: ' + errorMessage;
      if (errorStats) {
        fullMessage += `\n\nChi tiết:\n` +
          `- Tổng số tasks: ${errorStats.total}\n` +
          `- Đã phê duyệt: ${errorStats.approved}\n` +
          `- Đang chờ: ${errorStats.pending || 0}\n` +
          `- Bị từ chối: ${errorStats.rejected || 0}\n` +
          (errorStats.other > 0 ? `- Trạng thái khác: ${errorStats.other}\n` : '');
      }
      
      alert(fullMessage);
    }
  };

  const handleViewQuality = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${id}/quality`);
      setQualityStats(response.data);
      setQualityDialogOpen(true);
    } catch (error) {
      console.error('Error fetching quality stats:', error);
      alert('Lỗi khi tải thống kê chất lượng: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredAnnotators = annotatorSpecialtyFilter === 'all'
    ? annotators
    : annotators.filter(a => (a.specialty || 'general') === annotatorSpecialtyFilter);

  const filteredReviewers = reviewerSpecialtyFilter === 'all'
    ? reviewers
    : reviewers.filter(r => (r.specialty || 'general') === reviewerSpecialtyFilter);

  const annotatorSpecialties = Array.from(new Set(annotators.map(a => a.specialty || 'general')));
  const reviewerSpecialties = Array.from(new Set(reviewers.map(r => r.specialty || 'general')));

  const annotatorWorkload = (uid) =>
    tasks.filter(t => t.annotatorId?._id === uid && ['assigned', 'in_progress', 'submitted'].includes(t.status)).length;
  const reviewerWorkload = (uid) =>
    tasks.filter(t =>
      (t.reviewers || []).some(rv => rv.reviewerId?._id === uid && ['pending', 'rejected', 'approved'].includes(rv.status)) ||
      t.reviewerId?._id === uid
    ).length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header with Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => navigate('/manager/projects')} className="hover:text-blue-600">
              Projects
            </button>
            <span>/</span>
            <span className="text-gray-900 font-medium">{project?.name}</span>
            {project?.status === 'active' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleViewQuality}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <AssessmentIcon fontSize="small" />
              <span>Analytics</span>
            </button>
            <button
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <DownloadIcon fontSize="small" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setEditDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <SettingsIcon fontSize="small" />
              <span>Settings</span>
            </button>
          </div>
        </div>
        
        {/* Project Name and Description */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project?.name || 'Project'}</h1>
          <p className="text-gray-600">
            {project?.description || 'No description provided for this project.'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 relative">
        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Team Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {currentAnnotators.length + currentReviewers.length} Members
            </div>
            <div className="text-sm text-gray-500">Active Team</div>
          </div>

          {/* Overall Progress Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {tasks.length > 0 
                ? Math.round((tasks.filter(t => ['submitted', 'approved'].includes(t.status)).length / tasks.length) * 100)
                : 0}%
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div 
                className="h-2 bg-orange-500 rounded-full"
                style={{ 
                  width: `${tasks.length > 0 
                    ? Math.round((tasks.filter(t => ['submitted', 'approved'].includes(t.status)).length / tasks.length) * 100)
                    : 0}%` 
                }}
              ></div>
            </div>
            <div className="text-sm text-gray-500">Overall Progress</div>
          </div>

          {/* Avg Quality Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {qualityStats?.approvalRate ? parseFloat(qualityStats.approvalRate).toFixed(2) : '0.00'}%
            </div>
            <div className="text-sm text-gray-500">Avg Quality</div>
          </div>

          {/* Daily Throughput Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {(() => {
                // Calculate tasks approved today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const approvedToday = tasks.filter(t => {
                  if (t.status !== 'approved') return false;
                  if (!t.reviewedAt) return false;
                  const reviewedDate = new Date(t.reviewedAt);
                  reviewedDate.setHours(0, 0, 0, 0);
                  return reviewedDate.getTime() === today.getTime();
                }).length;
                return approvedToday;
              })()} tasks/day
            </div>
            <div className="text-sm text-gray-500">Daily Throughput</div>
          </div>
        </div>

        {/* Team Performance & Activity - Grouped by Annotator */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Performance &amp; Activity</h2>
              <p className="text-xs text-gray-500 mt-1">
                Grouped by annotator for efficient oversight. Click a row to xem chi tiết các tasks.
              </p>
            </div>
            <div className="w-80">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by annotator or reviewer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left">Annotator</th>
                  <th className="px-4 py-3 text-left">Assigned Tasks</th>
                  <th className="px-4 py-3 text-left">Assigned Reviewers</th>
                  <th className="px-4 py-3 text-left">Workload Progress</th>
                  <th className="px-4 py-3 text-left">Avg Quality</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(() => {
                  // 1) Filter tasks by status + search
                  const filteredTasks = tasks.filter((task) => {
                    if (statusFilter !== 'all' && task.status !== statusFilter) {
                      return false;
                    }
                    if (!searchTerm.trim()) return true;
                    const q = searchTerm.toLowerCase();
                    const annotatorName = (task.annotatorId?.fullName || task.annotatorId?.username || '').toLowerCase();
                    const reviewerNames = (task.reviewers || [])
                      .map(rv => (rv.reviewerId?.fullName || rv.reviewerId?.username || '').toLowerCase())
                      .join(' ');
                    return annotatorName.includes(q) || reviewerNames.includes(q);
                  });

                  if (filteredTasks.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Không tìm thấy task nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    );
                  }

                  // 2) Group by annotator
                  const groupsMap = new Map();
                  filteredTasks.forEach((task) => {
                    const key = task.annotatorId?._id || 'unassigned';
                    if (!groupsMap.has(key)) {
                      groupsMap.set(key, {
                        key,
                        annotatorId: key,
                        annotatorName: task.annotatorId?.fullName || task.annotatorId?.username || 'Unassigned',
                        tasks: [],
                        total: 0,
                        done: 0, // submitted + approved
                        approved: 0,
                        rejected: 0,
                        reviewerNames: new Set(),
                      });
                    }
                    const group = groupsMap.get(key);
                    group.tasks.push(task);
                    group.total += 1;
                    if (task.status === 'approved') {
                      group.approved += 1;
                      group.done += 1;
                    } else if (task.status === 'rejected') {
                      group.rejected += 1;
                    } else if (task.status === 'submitted') {
                      group.done += 1;
                    }
                    (task.reviewers || []).forEach((rv) => {
                      const name = rv.reviewerId?.fullName || rv.reviewerId?.username;
                      if (name) group.reviewerNames.add(name);
                    });
                  });

                  const groups = Array.from(groupsMap.values());

                  const rows = groups.map((group) => {
                    const reviewed = group.approved + group.rejected;
                    const progress = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0;
                    const quality = reviewed > 0 ? Math.round((group.approved / reviewed) * 100) : 0;
                    const qualityColor =
                      quality >= 90 ? 'text-green-600' :
                      quality >= 70 ? 'text-yellow-600' :
                      'text-red-600';
                    const progressBarColor =
                      progress >= 80 ? 'bg-green-500' :
                      progress >= 40 ? 'bg-yellow-400' :
                      'bg-red-400';

                    const reviewers = Array.from(group.reviewerNames);
                    const isExpanded = !!expandedAnnotators[group.key];

                    return (
                      <React.Fragment key={group.key}>
                        {/* Summary row per annotator */}
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            setExpandedAnnotators((prev) => ({
                              ...prev,
                              [group.key]: !prev[group.key],
                            }))
                          }
                        >
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {isExpanded ? '▾' : '▸'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                                {(group.annotatorName || 'A')[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{group.annotatorName}</span>
                                <span className="text-[11px] text-gray-500">
                                  {reviewed} reviewed · {group.total} total
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {group.total} tasks
                          </td>
                          <td className="px-4 py-3">
                            {reviewers.length === 0 ? (
                              <span className="text-xs text-gray-400 italic">Unassigned</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {reviewers.slice(0, 2).map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 text-xs font-medium"
                                  >
                                    {name}
                                  </span>
                                ))}
                                {reviewers.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{reviewers.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{progress}%</span>
                                <span>
                                  {group.done}/{group.total} done
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${progressBarColor}`}
                                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${qualityColor}`}>
                              {quality}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/manager/projects/${id}/annotator/${group.annotatorId}`);
                              }}
                            >
                              DETAILS
                            </button>
                          </td>
                        </tr>

                        {/* Expanded row with task list for this annotator */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 px-4 pb-4 pt-1">
                              <div className="border border-gray-200 rounded-xl bg-white shadow-sm mt-2 overflow-hidden">
                                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    Tasks for {group.annotatorName}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {group.tasks.length} task(s)
                                  </span>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase text-gray-500">
                                      <tr>
                                        <th className="px-3 py-2 text-left">File</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-left">Reviewers</th>
                                        <th className="px-3 py-2 text-left">Submitted At</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {group.tasks.map((task) => (
                                        <tr key={task._id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-gray-700">
                                            {task.dataItem?.filename
                                              ? task.dataItem.filename.length > 28
                                                ? `${task.dataItem.filename.substring(0, 28)}...`
                                                : task.dataItem.filename
                                              : '-'}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                                                task.status === 'approved'
                                                  ? 'bg-green-100 text-green-800'
                                                  : task.status === 'rejected'
                                                  ? 'bg-red-100 text-red-800'
                                                  : task.status === 'submitted'
                                                  ? 'bg-yellow-100 text-yellow-800'
                                                  : task.status === 'in_progress'
                                                  ? 'bg-blue-100 text-blue-800'
                                                  : 'bg-gray-100 text-gray-800'
                                              }`}
                                            >
                                              {task.status?.toUpperCase() || 'ASSIGNED'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">
                                            {task.reviewers && task.reviewers.length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {task.reviewers.slice(0, 3).map((rv, idx) => (
                                                  <span
                                                    key={rv.reviewerId?._id || idx}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 text-[11px] font-medium"
                                                  >
                                                    {rv.reviewerId?.fullName || rv.reviewerId?.username || 'Reviewer'}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-[11px] text-gray-400 italic">
                                                Unassigned
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">
                                            {task.submittedAt
                                              ? new Date(task.submittedAt).toLocaleString('en-GB', {
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  day: '2-digit',
                                                  month: '2-digit',
                                                  year: 'numeric',
                                                }).replace(',', '')
                                              : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <button
                                              type="button"
                                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/manager/projects/${id}/annotator/${group.annotatorId}`);
                                              }}
                                            >
                                              VIEW AUDIT
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  });

                  return rows;
                })()}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
            <span>
              Showing {currentAnnotators.length} active annotators out of {annotators.length}
            </span>
            <span>
              Tip: dùng màu sắc của Avg Quality để phát hiện annotator có tỷ lệ rejected cao.
            </span>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Dataset</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Dataset Name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            margin="normal"
          />
          <input
            type="file"
            multiple
            onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
            style={{ marginTop: 16 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFileUpload} variant="contained">
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => {
        setAssignDialogOpen(false);
        setAssignMode('existing');
        setAssignFiles([]);
        setDatasetName('');
      }} maxWidth="md" fullWidth>
        <DialogTitle>Phân công Tasks - Upload ảnh & Gán Team</DialogTitle>
        <DialogContent>
          {/* Chọn chế độ: Dataset có sẵn hoặc Upload mới */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Chế độ</InputLabel>
            <Select
              value={assignMode}
              onChange={(e) => {
                setAssignMode(e.target.value);
                if (e.target.value === 'existing') {
                  setAssignFiles([]);
                  setDatasetName('');
                } else {
                  setSelectedDataset('');
                }
              }}
            >
              <MenuItem value="existing">Chọn Dataset có sẵn</MenuItem>
              <MenuItem value="upload">Upload ảnh mới</MenuItem>
            </Select>
          </FormControl>

          {assignMode === 'existing' ? (
            <FormControl fullWidth margin="normal">
              <InputLabel>Dataset</InputLabel>
              <Select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                {datasets.length === 0 ? (
                  <MenuItem disabled>Chưa có dataset nào. Vui lòng chọn "Upload ảnh mới"</MenuItem>
                ) : (
                  datasets.map((dataset) => (
                    <MenuItem key={dataset._id} value={dataset._id}>
                      {dataset.name} ({dataset.totalItems} files)
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          ) : (
            <>
              <TextField
                fullWidth
                label="Tên Dataset"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                margin="normal"
                placeholder="Ví dụ: Dataset động vật tháng 1"
              />
              <Box sx={{ mt: 2 }}>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setAssignFiles(Array.from(e.target.files))}
                  style={{ width: '100%', padding: '8px' }}
                />
                {assignFiles.length > 0 && (
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Đã chọn {assignFiles.length} file(s)
                  </Typography>
                )}
              </Box>
            </>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>Annotators</InputLabel>
            <Select
              multiple
              value={selectedAnnotators}
              onChange={(e) => setSelectedAnnotators(e.target.value)}
            >
              {filteredAnnotators.map((annotator) => (
                <MenuItem key={annotator._id} value={annotator._id}>
                  {annotator.fullName} {annotator.specialty ? `(${annotator.specialty})` : ''} · WL: {annotatorWorkload(annotator._id)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Annotator Specialty</InputLabel>
            <Select
              value={annotatorSpecialtyFilter}
              onChange={(e) => setAnnotatorSpecialtyFilter(e.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              {annotatorSpecialties.map(spec => (
                <MenuItem key={spec} value={spec}>{spec}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Reviewers</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Reviewer Specialty</InputLabel>
                  <Select
                    value={reviewerSpecialtyFilter}
                    onChange={(e) => {
                      setReviewerSpecialtyFilter(e.target.value);
                      // Reset reviewers khi đổi specialty
                      if (e.target.value !== reviewerSpecialtyFilter) {
                        setSelectedReviewers([]);
                      }
                    }}
                  >
                    <MenuItem value="all">Tất cả</MenuItem>
                    {reviewerSpecialties.map(spec => (
                      <MenuItem key={spec} value={spec}>{spec}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Reviewers</InputLabel>
                  <Select
                    multiple
                    value={selectedReviewers}
                    onChange={(e) => setSelectedReviewers(e.target.value)}
                  >
                    {filteredReviewers.map((rv) => (
                      <MenuItem key={rv._id} value={rv._id}>
                        {(rv.fullName || rv.username) + (rv.specialty ? ` (${rv.specialty})` : '')} · WL: {reviewerWorkload(rv._id)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {selectedReviewers.length > 0 && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Đã chọn {selectedReviewers.length} reviewer(s)
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAssignDialogOpen(false);
            setSelectedDataset('');
            setSelectedAnnotators([]);
            setSelectedReviewers([]);
            setReviewerSpecialtyFilter('all');
            setAnnotatorSpecialtyFilter('all');
            setAssignMode('existing');
            setAssignFiles([]);
            setDatasetName('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            variant="contained"
            disabled={
              (assignMode === 'existing' && !selectedDataset) ||
              (assignMode === 'upload' && assignFiles.length === 0) ||
              selectedAnnotators.length === 0 ||
              selectedReviewers.length === 0
            }
          >
            Phân công & Tạo Tasks
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quality Statistics Dialog */}
      <Dialog open={qualityDialogOpen} onClose={() => setQualityDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Chất lượng & Thống kê Labeling</DialogTitle>
        <DialogContent>
          {qualityStats && (
            <Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{qualityStats.total}</Typography>
                    <Typography variant="body2" color="textSecondary">Tổng Tasks</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                    <Typography variant="h4">{qualityStats.approved}</Typography>
                    <Typography variant="body2" color="textSecondary">Đã phê duyệt</Typography>
                    <Typography variant="caption">({qualityStats.approvalRate}%)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                    <Typography variant="h4">{qualityStats.rejected}</Typography>
                    <Typography variant="body2" color="textSecondary">Bị từ chối</Typography>
                    <Typography variant="caption">({qualityStats.rejectionRate}%)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                    <Typography variant="h4">{qualityStats.submitted}</Typography>
                    <Typography variant="body2" color="textSecondary">Đang chờ review</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {Object.keys(qualityStats.errorCategories).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Phân loại lỗi</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Loại lỗi</TableCell>
                          <TableCell>Số lượng</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(qualityStats.errorCategories).map(([category, count]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell>{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {Object.keys(qualityStats.annotatorStats).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Thống kê theo Annotator</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Annotator</TableCell>
                          <TableCell>Tổng</TableCell>
                          <TableCell>Đã duyệt</TableCell>
                          <TableCell>Bị từ chối</TableCell>
                          <TableCell>Tỷ lệ duyệt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(qualityStats.annotatorStats).map(([annotator, stats]) => (
                          <TableRow key={annotator}>
                            <TableCell>{annotator}</TableCell>
                            <TableCell>{stats.total}</TableCell>
                            <TableCell>{stats.approved}</TableCell>
                            <TableCell>{stats.rejected}</TableCell>
                            <TableCell>{stats.approvalRate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQualityDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Export Format Selection Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chọn định dạng xuất dữ liệu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            <strong>Yêu cầu:</strong> TẤT CẢ tasks phải được phê duyệt (approved) trước khi export.<br/>
            Tổng số tasks: {tasks.length}<br/>
            Đã phê duyệt: {tasks.filter(t => t.status === 'approved').length}<br/>
            {tasks.filter(t => t.status !== 'approved').length > 0 && (
              <>
                <span style={{ color: '#d32f2f' }}>
                  Còn lại: {tasks.filter(t => t.status !== 'approved').length} task(s) chưa được phê duyệt
                </span>
              </>
            )}
            {tasks.filter(t => t.status === 'approved').length === tasks.length && tasks.length > 0 && (
              <span style={{ color: '#2e7d32' }}>
                ✓ Tất cả tasks đã được phê duyệt, có thể export
              </span>
            )}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('json');
                setExportDialogOpen(false);
              }}
            >
              JSON Format
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('yolo');
                setExportDialogOpen(false);
              }}
            >
              YOLO Format (for object detection)
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('voc');
                setExportDialogOpen(false);
              }}
            >
              VOC Format (Pascal VOC XML)
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('coco');
                setExportDialogOpen(false);
              }}
            >
              COCO Format (for object detection)
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                handleExport('csv');
                setExportDialogOpen(false);
              }}
            >
              CSV Format
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle sx={{ flexShrink: 0 }}>Chỉnh sửa Project</DialogTitle>
        <DialogContent 
          dividers 
          sx={{ 
            overflowY: 'auto', 
            overflowX: 'hidden',
            flex: 1,
            '&::-webkit-scrollbar': {
              width: '10px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '5px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '5px',
              '&:hover': {
                background: '#555',
              },
            },
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project Name *"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Guidelines *"
                value={editFormData.guidelines}
                onChange={(e) => setEditFormData({ ...editFormData, guidelines: e.target.value })}
                multiline
                rows={5}
                required
                helperText="Hướng dẫn cho Annotator"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Deadline"
                type="datetime-local"
                value={editFormData.deadline}
                onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
                InputLabelProps={{
                  shrink: true,
                }}
                helperText="Set project deadline (optional)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={editFormData.exportFormat || 'JSON'}
                  label="Export Format"
                  onChange={(e) => setEditFormData({ ...editFormData, exportFormat: e.target.value })}
                >
                  <MenuItem value="JSON">JSON (Default)</MenuItem>
                  <MenuItem value="YOLO">YOLO</MenuItem>
                  <MenuItem value="VOC">VOC (Pascal VOC)</MenuItem>
                  <MenuItem value="COCO">COCO</MenuItem>
                  <MenuItem value="CSV">CSV</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {user?.role === 'manager' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editFormData.status || 'draft'}
                    label="Status"
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            {/* Label Set */}
            <Grid item xs={12}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Label Set</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      const newLabel = {
                        name: '',
                        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                        description: ''
                      };
                      setEditFormData({
                        ...editFormData,
                        labelSet: [...(editFormData.labelSet || []), newLabel]
                      });
                    }}
                  >
                    Add Label
                  </Button>
                </Box>
                
                {editFormData.labelSet && editFormData.labelSet.length > 0 ? (
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 2,
                      maxHeight: '500px',
                      minHeight: '200px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      pr: 2,
                      pb: 2,
                      border: '2px solid #e0e0e0',
                      borderRadius: 2,
                      p: 2,
                      backgroundColor: '#fafafa',
                      '&::-webkit-scrollbar': {
                        width: '12px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#e0e0e0',
                        borderRadius: '6px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '6px',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          background: '#555',
                        },
                      },
                    }}
                  >
                    {editFormData.labelSet.map((label, idx) => (
                      <Card key={idx} variant="outlined" sx={{ flexShrink: 0 }}>
                        <CardContent>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Label Name *"
                                value={label.name || ''}
                                onChange={(e) => {
                                  const newLabelSet = [...editFormData.labelSet];
                                  newLabelSet[idx].name = e.target.value;
                                  setEditFormData({ ...editFormData, labelSet: newLabelSet });
                                }}
                                placeholder="e.g., Car, Person, Dog"
                                required
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <input
                                  type="color"
                                  value={label.color || '#000000'}
                                  onChange={(e) => {
                                    const newLabelSet = [...editFormData.labelSet];
                                    newLabelSet[idx].color = e.target.value;
                                    setEditFormData({ ...editFormData, labelSet: newLabelSet });
                                  }}
                                  style={{
                                    width: '50px',
                                    height: '40px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                />
                                <TextField
                                  size="small"
                                  value={label.color || '#000000'}
                                  onChange={(e) => {
                                    const newLabelSet = [...editFormData.labelSet];
                                    newLabelSet[idx].color = e.target.value;
                                    setEditFormData({ ...editFormData, labelSet: newLabelSet });
                                  }}
                                  placeholder="#000000"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Description (Optional)"
                                value={label.description || ''}
                                onChange={(e) => {
                                  const newLabelSet = [...editFormData.labelSet];
                                  newLabelSet[idx].description = e.target.value;
                                  setEditFormData({ ...editFormData, labelSet: newLabelSet });
                                }}
                                placeholder="Brief description"
                              />
                            </Grid>
                            <Grid item xs={12} sm={1}>
                              <IconButton
                                color="error"
                                onClick={() => {
                                  const newLabelSet = editFormData.labelSet.filter((_, i) => i !== idx);
                                  setEditFormData({ ...editFormData, labelSet: newLabelSet });
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">
                    Chưa có label nào. Vui lòng thêm ít nhất một label để annotator có thể chọn khi gán nhãn.
                  </Alert>
                )}
              </Box>
            </Grid>

            {/* Datasets Info */}
            <Grid item xs={12}>
              <Box>
                <Typography variant="h6" gutterBottom>Datasets</Typography>
                {datasets.length === 0 ? (
                  <Alert severity="info">Chưa có dataset nào</Alert>
                ) : (
                  <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                    {datasets.map((dataset) => (
                      <Card key={dataset._id} sx={{ mb: 1 }}>
                        <CardContent sx={{ py: 1.5 }}>
                          <Typography variant="body2" fontWeight="bold">{dataset.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {dataset.totalItems || 0} files
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Team Assignment Info */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="h6" gutterBottom>Assigned Annotators</Typography>
                {currentAnnotators.length === 0 ? (
                  <Alert severity="info">Chưa có annotator nào được gán</Alert>
                ) : (
                  <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                    {annotators.filter(a => currentAnnotators.includes(a._id)).map((ann) => (
                      <Chip
                        key={ann._id}
                        label={ann.fullName || ann.username}
                        sx={{ m: 0.5 }}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="h6" gutterBottom>Assigned Reviewers</Typography>
                {currentReviewers.length === 0 ? (
                  <Alert severity="info">Chưa có reviewer nào được gán</Alert>
                ) : (
                  <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                    {reviewers.filter(r => currentReviewers.includes(r._id)).map((rev) => (
                      <Chip
                        key={rev._id}
                        label={rev.fullName || rev.username}
                        sx={{ m: 0.5 }}
                        color="success"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleUpdateProject} variant="contained">
            Lưu thay đổi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog open={auditDialogOpen} onClose={() => setAuditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Audit Trail</DialogTitle>
        <DialogContent dividers>
          {auditTask ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1">File: {auditTask.dataItem?.filename}</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label={`Status: ${auditTask.status}`} />
                {auditTask.submittedAt && <Chip label={`Submitted: ${new Date(auditTask.submittedAt).toLocaleString()}`} />}
                {auditTask.reviewedAt && <Chip label={`Reviewed: ${new Date(auditTask.reviewedAt).toLocaleString()}`} />}
              </Box>
              <Typography variant="subtitle2">Reviewers</Typography>
              {auditTask.reviewers && auditTask.reviewers.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {auditTask.reviewers.map((rv, idx) => (
                    <Chip
                      key={rv.reviewerId?._id || idx}
                      label={`${rv.reviewerId?.fullName || rv.reviewerId?.username || 'Reviewer'} - ${rv.status || 'pending'}`}
                      variant="outlined"
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">Chưa gán reviewer</Typography>
              )}

              <Typography variant="subtitle2" sx={{ mt: 1 }}>Review Comments</Typography>
              <Typography variant="body2">{auditTask.reviewComments || 'Không có'}</Typography>
            </Box>
          ) : (
            <Typography>Không có dữ liệu audit.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDialogOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Labels */}
      <Dialog open={previewLabelsOpen} onClose={() => setPreviewLabelsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Label Preview</DialogTitle>
        <DialogContent dividers>
          {project?.labelSet && project.labelSet.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {project.labelSet.map((label, idx) => (
                <Chip
                  key={idx}
                  label={label.name}
                  sx={{
                    bgcolor: label.color || '#1976d2',
                    color: 'white'
                  }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">Chưa có label nào</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewLabelsOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default ManagerProjectDetail;
