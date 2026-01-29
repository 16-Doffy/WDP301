<<<<<<< HEAD
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
import { Upload as UploadIcon, Assignment as AssignmentIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon, Settings as SettingsIcon, Download as DownloadIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
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
    questions: [],
    status: 'draft',
  });
  const [qualityStats, setQualityStats] = useState(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditTask, setAuditTask] = useState(null);
  const [previewLabelsOpen, setPreviewLabelsOpen] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAnnotators();
    fetchReviewers();
  }, [id]);

  useEffect(() => {
    if (project) {
      setEditFormData({
        name: project.name || '',
        description: project.description || '',
        guidelines: project.guidelines || '',
        labelSet: project.labelSet || [],
        questions: project.questions || [],
        status: project.status || 'draft',
      });
      setReviewPolicy({
        mode: project.reviewPolicy?.mode || 'full',
        sampleRate: typeof project.reviewPolicy?.sampleRate === 'number' ? project.reviewPolicy.sampleRate : 0.1,
      });
    }
  }, [project]);

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
      await axios.put(`${API_URL}/api/projects/${id}`, editFormData);
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
      const response = await axios.get(`${API_URL}/api/projects/${id}/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_export_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + (error.response?.data?.message || error.message));
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
              <span>📊</span>
              <span>Quality & Stats</span>
            </button>
            <button
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>⬇️</span>
              <span>Export Data</span>
            </button>
            <button
              onClick={() => setEditDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>⚙️</span>
              <span>Project Settings</span>
            </button>
          </div>
        </div>
        
        {/* Project Name and Description */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project?.name || 'Project'}</h1>
          <p className="text-gray-600 italic">{project?.description || 'No description'}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Datasets Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Datasets</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAssignMode('upload');
                    setAssignDialogOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>📋</span>
                  <span>Assign Tasks</span>
                </button>
                <button
                  onClick={() => setUploadDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>⬆️</span>
                  <span>Upload Dataset</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DATASET NAME</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">FILES</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {datasets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                        No datasets found
                      </td>
                    </tr>
                  ) : (
                    datasets.map((dataset) => (
                      <tr key={dataset._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{dataset.name}</td>
                        <td className="px-4 py-3 text-gray-600">{dataset.totalItems || 0}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setAssignMode('existing');
                              setSelectedDataset(dataset._id);
                              setAssignDialogOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            ASSIGN
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tasks Overview Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks Overview</h2>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full font-medium">
                Total {tasks.length}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full font-medium">
                Assigned {tasks.filter(t => t.status === 'assigned').length}
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                In Progress {tasks.filter(t => t.status === 'in_progress').length}
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full font-medium">
                Submitted {tasks.filter(t => t.status === 'submitted').length}
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                Approved {tasks.filter(t => t.status === 'approved').length}
              </span>
              <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full font-medium">
                Rejected {tasks.filter(t => t.status === 'rejected').length}
              </span>
            </div>
          </div>

          {/* Workflow Policy Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔄</span>
              <h2 className="text-lg font-semibold text-gray-900">Workflow Policy</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reviewPolicy"
                  value="full"
                  checked={reviewPolicy.mode === 'full'}
                  onChange={async (e) => {
                    const newPolicy = { ...reviewPolicy, mode: e.target.value };
                    setReviewPolicy(newPolicy);
                    await axios.put(`${API_URL}/api/projects/${id}`, { reviewPolicy: newPolicy });
                    fetchData();
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">100% Review Required</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reviewPolicy"
                  value="sample"
                  checked={reviewPolicy.mode === 'sample'}
                  onChange={async (e) => {
                    const newPolicy = { ...reviewPolicy, mode: e.target.value };
                    setReviewPolicy(newPolicy);
                    await axios.put(`${API_URL}/api/projects/${id}`, { reviewPolicy: newPolicy });
                    fetchData();
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">Sampled Review</span>
              </label>
              {reviewPolicy.mode === 'sample' && (
                <div className="mt-4 pl-7">
                  <label className="block text-sm text-gray-600 mb-2">
                    Sample Rate: {(reviewPolicy.sampleRate * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={(reviewPolicy.sampleRate || 0) * 100}
                    onChange={async (e) => {
                      const rate = parseInt(e.target.value) / 100;
                      const newPolicy = { ...reviewPolicy, sampleRate: rate };
                      setReviewPolicy(newPolicy);
                      await axios.put(`${API_URL}/api/projects/${id}`, { reviewPolicy: newPolicy });
                      fetchData();
                    }}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Tasks Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Tasks</h2>
          
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter tasks..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ANNOTATOR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">FILE ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">STATUS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">REVIEWERS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">SUBMITTED AT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-700">
                              {(task.annotatorId?.fullName || task.annotatorId?.username || 'A')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-900">{task.annotatorId?.fullName || task.annotatorId?.username || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {task.dataItem?.filename ? (
                          task.dataItem.filename.length > 20 
                            ? `${task.dataItem.filename.substring(0, 20)}...` 
                            : task.dataItem.filename
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.status === 'approved' ? 'bg-green-100 text-green-800' :
                          task.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          task.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status?.toUpperCase() || 'ASSIGNED'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.reviewers && task.reviewers.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-xs text-purple-700">
                                {(task.reviewers[0]?.reviewerId?.fullName || task.reviewers[0]?.reviewerId?.username || 'R')[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="text-gray-700 text-sm">
                              {task.reviewers[0]?.reviewerId?.fullName || task.reviewers[0]?.reviewerId?.username || 'Reviewer'}
                              {task.reviewers[0]?.status === 'pending' && ' (Pending)'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xs text-gray-500">👤</span>
                            </div>
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {task.submittedAt
                          ? new Date(task.submittedAt).toLocaleString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }).replace(',', '')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setAuditTask(task);
                            setAuditDialogOpen(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                        >
                          AUDIT
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {tasks.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing 1 to {tasks.length} of {tasks.length} tasks
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Previous
                </button>
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}
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
            Chỉ xuất các tasks đã được phê duyệt (approved)
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
                handleExport('csv');
                setExportDialogOpen(false);
              }}
            >
              CSV Format
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chỉnh sửa Project - Labels & Questions</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Project Name"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={editFormData.description}
            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          {user?.role === 'manager' && (
            <FormControl fullWidth margin="normal">
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
          )}
          <TextField
            fullWidth
            label="Guidelines"
            value={editFormData.guidelines}
            onChange={(e) => setEditFormData({ ...editFormData, guidelines: e.target.value })}
            margin="normal"
            multiline
            rows={5}
            required
            helperText="Hướng dẫn cho Annotator"
          />
          
          <Accordion sx={{ mt: 2 }} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">Bộ nhãn (Labels) - BẮT BUỘC cho Annotator</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                Thêm các nhãn mà Annotator có thể chọn khi khoanh vùng (ví dụ: Dog, Cat, Person...). 
                Nếu không có labels, Annotator sẽ không thể chọn label khi khoanh vùng!
              </Alert>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newLabelSet = [...(editFormData.labelSet || []), { name: '', color: '#1976d2' }];
                  setEditFormData({ ...editFormData, labelSet: newLabelSet });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Label
              </Button>
              {editFormData.labelSet && editFormData.labelSet.length > 0 ? (
                editFormData.labelSet.map((label, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="Tên label"
                      value={label.name}
                      onChange={(e) => {
                        const newLabelSet = [...editFormData.labelSet];
                        newLabelSet[idx].name = e.target.value;
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                      placeholder="Ví dụ: Dog, Cat, Person..."
                    />
                    <TextField
                      size="small"
                      type="color"
                      label="Màu"
                      value={label.color || '#1976d2'}
                      onChange={(e) => {
                        const newLabelSet = [...editFormData.labelSet];
                        newLabelSet[idx].color = e.target.value;
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                      sx={{ width: 100 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newLabelSet = editFormData.labelSet.filter((_, i) => i !== idx);
                        setEditFormData({ ...editFormData, labelSet: newLabelSet });
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))
              ) : (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Chưa có labels nào! Annotator sẽ không thể chọn label khi khoanh vùng.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Câu hỏi và Đáp án - Tùy chọn</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Sau khi Annotator khoanh vùng, họ sẽ trả lời câu hỏi này bằng cách chọn đáp án A hoặc B
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newQuestions = [...(editFormData.questions || []), {
                    question: '',
                    options: [{ key: 'A', value: '' }, { key: 'B', value: '' }],
                  }];
                  setEditFormData({ ...editFormData, questions: newQuestions });
                }}
                sx={{ mt: 1 }}
              >
                Thêm Câu hỏi
              </Button>
              {editFormData.questions && editFormData.questions.map((question, qIdx) => (
                <Box key={qIdx} sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Câu hỏi {qIdx + 1}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newQuestions = editFormData.questions.filter((_, i) => i !== qIdx);
                        setEditFormData({ ...editFormData, questions: newQuestions });
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Câu hỏi"
                    value={question.question}
                    onChange={(e) => {
                      const newQuestions = [...editFormData.questions];
                      newQuestions[qIdx].question = e.target.value;
                      setEditFormData({ ...editFormData, questions: newQuestions });
                    }}
                    margin="normal"
                  />
                  <Box sx={{ mt: 1 }}>
                    {question.options && question.options.map((option, optIdx) => (
                      <TextField
                        key={optIdx}
                        fullWidth
                        size="small"
                        label={`Đáp án ${option.key}`}
                        value={option.value}
                        onChange={(e) => {
                          const newQuestions = [...editFormData.questions];
                          newQuestions[qIdx].options[optIdx].value = e.target.value;
                          setEditFormData({ ...editFormData, questions: newQuestions });
                        }}
                        margin="normal"
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
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

              <Typography variant="subtitle2" sx={{ mt: 1 }}>Review Notes (feedback trên ảnh)</Typography>
              {auditTask.reviewNotes && auditTask.reviewNotes.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {auditTask.reviewNotes.map((n, idx) => (
                    <Card key={idx} variant="outlined">
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          BBox: [{Math.round(n.bbox?.[0] || 0)}%, {Math.round(n.bbox?.[1] || 0)}%] → [{Math.round(n.bbox?.[2] || 0)}%, {Math.round(n.bbox?.[3] || 0)}%]
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Label: {n.label || 'N/A'}
                        </Typography>
                        <Typography variant="body2">
                          Comment: {n.comment}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">Không có ghi chú</Typography>
              )}
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
=======
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
import { Upload as UploadIcon, Assignment as AssignmentIcon, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, ExpandMore as ExpandMoreIcon, Settings as SettingsIcon, Download as DownloadIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
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

  useEffect(() => {
    fetchData();
    fetchAnnotators();
    fetchReviewers();
  }, [id]);

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
              <span>📊</span>
              <span>Quality & Stats</span>
            </button>
            <button
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>⬇️</span>
              <span>Export Data</span>
            </button>
            <button
              onClick={() => setEditDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>⚙️</span>
              <span>Project Settings</span>
            </button>
          </div>
        </div>
        
        {/* Project Name and Description */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project?.name || 'Project'}</h1>
          <p className="text-gray-600 italic">{project?.description || 'No description'}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Datasets Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Datasets</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DATASET NAME</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">FILES</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {datasets.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                        No datasets found
                      </td>
                    </tr>
                  ) : (
                    datasets.map((dataset) => (
                      <tr key={dataset._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{dataset.name}</td>
                        <td className="px-4 py-3 text-gray-600">{dataset.totalItems || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tasks Overview Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks Overview</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'all'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                All {tasks.length}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('assigned')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'assigned'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                Assigned {tasks.filter(t => t.status === 'assigned').length}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-blue-50 text-blue-800 border-blue-100'
                }`}
              >
                In Progress {tasks.filter(t => t.status === 'in_progress').length}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('submitted')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'submitted'
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-yellow-50 text-yellow-800 border-yellow-100'
                }`}
              >
                Submitted {tasks.filter(t => t.status === 'submitted').length}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'approved'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-green-50 text-green-800 border-green-100'
                }`}
              >
                Approved {tasks.filter(t => t.status === 'approved').length}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1 text-sm rounded-full font-medium border ${
                  statusFilter === 'rejected'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 text-red-800 border-red-100'
                }`}
              >
                Rejected {tasks.filter(t => t.status === 'rejected').length}
              </button>
            </div>
          </div>

        </div>

        {/* All Tasks Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Tasks</h2>
          
          {/* Search Bar - Search by Annotator or Reviewer name */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên Annotator hoặc Reviewer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ANNOTATOR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">FILE ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">STATUS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">REVIEWERS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">SUBMITTED AT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Filter tasks by annotator or reviewer name
                  const filteredTasks = tasks.filter((task) => {
                    // Filter by status
                    if (statusFilter !== 'all' && task.status !== statusFilter) {
                      return false;
                    }

                    // Filter by search (annotator / reviewer)
                    if (!searchTerm.trim()) return true;
                    const searchLower = searchTerm.toLowerCase();
                    const annotatorName = (task.annotatorId?.fullName || task.annotatorId?.username || '').toLowerCase();
                    const reviewerNames = (task.reviewers || [])
                      .map(rv => (rv.reviewerId?.fullName || rv.reviewerId?.username || '').toLowerCase())
                      .join(' ');
                    return annotatorName.includes(searchLower) || reviewerNames.includes(searchLower);
                  });

                  if (filteredTasks.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          Không tìm thấy task nào
                        </td>
                      </tr>
                    );
                  }

                  return filteredTasks.map((task) => (
                    <tr key={task._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-700">
                              {(task.annotatorId?.fullName || task.annotatorId?.username || 'A')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-900">{task.annotatorId?.fullName || task.annotatorId?.username || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {task.dataItem?.filename ? (
                          task.dataItem.filename.length > 20 
                            ? `${task.dataItem.filename.substring(0, 20)}...` 
                            : task.dataItem.filename
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.status === 'approved' ? 'bg-green-100 text-green-800' :
                          task.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          task.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status?.toUpperCase() || 'ASSIGNED'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.reviewers && task.reviewers.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {task.reviewers.slice(0, 2).map((rv, idx) => (
                              <span
                                key={rv.reviewerId?._id || idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 text-xs font-medium"
                              >
                                {(rv.reviewerId?.fullName || rv.reviewerId?.username || 'Reviewer')}
                                {rv.status === 'pending' && (
                                  <span className="ml-1 text-[10px] text-yellow-700">(pending)</span>
                                )}
                              </span>
                            ))}
                            {task.reviewers.length > 2 && (
                              <span className="text-xs text-gray-500 ml-1">
                                +{task.reviewers.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xs text-gray-500">👤</span>
                            </div>
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {task.submittedAt
                          ? new Date(task.submittedAt).toLocaleString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }).replace(',', '')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setAuditTask(task);
                            setAuditDialogOpen(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                        >
                          AUDIT
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {tasks.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing 1 to {tasks.length} of {tasks.length} tasks
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Previous
                </button>
                <button className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}
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
>>>>>>> NDuy
